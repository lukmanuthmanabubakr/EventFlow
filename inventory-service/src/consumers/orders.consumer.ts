// consumers/orders.consumer.ts
//
// Reacts to OrderPlaced and OrderCancelled.
//
// OrderPlaced: reserves stock for every line item atomically, or fails the
// whole order, records what was reserved in OrderReservation, then announces
// the outcome (InventoryReserved / InventoryFailed).
//
// OrderCancelled: looks up what THIS order actually reserved (from our own
// OrderReservation record, not from the event payload) and releases exactly
// that, once. Duplicate or stray cancellations are logged and ignored.

import { v4 as uuidv4 } from "uuid";
import prisma from "../config/database";
import { publishEvent, subscribeToEvents } from "../config/rabbitmq";

interface OrderLineItem {
  productId: string;
  quantity: number;
}

interface OrderPlacedPayload {
  correlationId: string;
  data: {
    orderId: string;
    items: OrderLineItem[];
  };
}

interface OrderCancelledPayload {
  correlationId: string;
  data: {
    orderId: string;
  };
}

function isOrderPlacedPayload(payload: unknown): payload is OrderPlacedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "correlationId" in payload &&
    "data" in payload
  );
}

function isOrderCancelledPayload(
  payload: unknown
): payload is OrderCancelledPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { correlationId?: unknown }).correlationId === "string" &&
    typeof (payload as { data?: unknown }).data === "object"
  );
}

// One order may list the same product on several lines. Reserve the total,
// not each line separately, and return the lines sorted by productId. Every
// transaction touches product rows in that same order, so two multi-item
// orders on overlapping products can never wait on each other in a cycle.
function mergeAndSortLines(items: OrderLineItem[]): OrderLineItem[] {
  const totals = new Map<string, number>();

  for (const item of items) {
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  }

  return [...totals.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([productId, quantity]) => ({ productId, quantity }));
}

async function handleOrderPlaced(payload: unknown): Promise<void> {
  if (!isOrderPlacedPayload(payload)) {
    console.error("Malformed OrderPlaced payload, skipping:", payload);
    return;
  }

  const { correlationId, data } = payload;
  const { orderId, items } = data;

  let outcome: "reserved" | "duplicate";

  try {
    const lines = mergeAndSortLines(items);

    outcome = await prisma.$transaction(async (tx) => {
      // If this order already has a reservation, this is a duplicate
      // delivery. Reserving again would double-count the stock, so skip.
      const existing = await tx.orderReservation.findUnique({
        where: { correlationId },
      });

      if (existing) {
        return "duplicate" as const;
      }

      // Check and reserve in ONE statement per product. The WHERE clause
      // makes the stock check part of the UPDATE itself: Postgres locks the
      // row, so a concurrent order waits, then re-checks against the
      // committed value. If the stock is gone it matches zero rows and
      // changes nothing. There is no gap between check and reserve.
      for (const line of lines) {
        const result = await tx.product.updateMany({
          where: {
            id: line.productId,
            quantityAvailable: { gte: line.quantity },
          },
          data: {
            quantityAvailable: { decrement: line.quantity },
            quantityReserved: { increment: line.quantity },
          },
        });

        if (result.count === 0) {
          // Read the product only to explain WHY it failed. Throwing rolls
          // back every earlier line of this order: all-or-nothing.
          const product = await tx.product.findUnique({
            where: { id: line.productId },
          });

          if (!product) {
            throw new Error(`Product ${line.productId} does not exist`);
          }

          throw new Error(
            `Insufficient stock for ${product.name} (${line.productId}): requested ${line.quantity}, available ${product.quantityAvailable}`
          );
        }
      }

      // Record what this order reserved, in the same transaction, so the
      // stock change and its record can never disagree.
      await tx.orderReservation.create({
        data: {
          correlationId,
          orderId,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          status: "reserved",
        },
      });

      return "reserved" as const;
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    console.log(
      `FAIL — order ${orderId} (correlationId ${correlationId}): ${reason}. No stock was changed.`
    );

    await publishEvent("InventoryFailed", {
      eventId: uuidv4(),
      eventType: "InventoryFailed",
      correlationId,
      timestamp: new Date().toISOString(),
      data: { orderId, reason },
    });
    return;
  }

  if (outcome === "duplicate") {
    console.log(
      `DUPLICATE — order ${orderId} (correlationId ${correlationId}) already has a reservation. Ignoring.`
    );
    return;
  }

  console.log(
    `RESERVE — order ${orderId} (correlationId ${correlationId}): all ${items.length} item(s) reserved successfully.`
  );

  // Published outside the transaction and outside the failure handler: if
  // this publish throws, the stock is already (correctly) reserved and
  // must not be reported as a failure.
  await publishEvent("InventoryReserved", {
    eventId: uuidv4(),
    eventType: "InventoryReserved",
    correlationId,
    timestamp: new Date().toISOString(),
    data: { orderId, reservedItems: items },
  });
}

async function handleOrderCancelled(payload: unknown): Promise<void> {
  if (!isOrderCancelledPayload(payload)) {
    console.error("Malformed OrderCancelled payload, skipping:", payload);
    return;
  }

  const { correlationId } = payload;

  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.orderReservation.findUnique({
      where: { correlationId },
    });

    if (!reservation) {
      return "not-found" as const;
    }

    if (reservation.status === "released") {
      return "already-released" as const;
    }

    // Release exactly what this order reserved, taken from our own record.
    const reserved = reservation.items as unknown as OrderLineItem[];

    for (const item of reserved) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          quantityAvailable: { increment: item.quantity },
          quantityReserved: { decrement: item.quantity },
        },
      });
    }

    await tx.orderReservation.update({
      where: { correlationId },
      data: { status: "released" },
    });

    return "released" as const;
  });

  if (result === "not-found") {
    console.log(
      `IGNORED — OrderCancelled for correlationId ${correlationId}: no reservation on record, nothing to release.`
    );
  } else if (result === "already-released") {
    console.log(
      `IGNORED — OrderCancelled for correlationId ${correlationId}: reservation already released.`
    );
  } else {
    console.log(
      `RELEASE — correlationId ${correlationId}: reserved stock returned to available.`
    );
  }
}

export async function startInventoryConsumers(): Promise<void> {
  await subscribeToEvents(
    ["OrderPlaced", "OrderCancelled"],
    async (eventType, payload) => {
      if (eventType === "OrderPlaced") {
        await handleOrderPlaced(payload);
      } else if (eventType === "OrderCancelled") {
        await handleOrderCancelled(payload);
      } else {
        console.log(`Ignoring unrelated event type: ${eventType}`);
      }
    }
  );
}
