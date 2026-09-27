// consumers/orders.consumer.ts
//
// Reacts to OrderPlaced events. Checks stock for every line item, and
// either reserves all of it atomically or fails the whole order — no
// partial reservations. Publishing InventoryReserved/InventoryFailed is
// the next task; for now this proves the decision logic and DB update.

import prisma from "../config/database";
import { subscribeToEvents } from "../config/rabbitmq";

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

function isOrderPlacedPayload(payload: unknown): payload is OrderPlacedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "correlationId" in payload &&
    "data" in payload
  );
}

async function handleOrderPlaced(payload: unknown): Promise<void> {
  if (!isOrderPlacedPayload(payload)) {
    console.error("Malformed OrderPlaced payload, skipping:", payload);
    return;
  }

  const { correlationId, data } = payload;
  const { orderId, items } = data;

  try {
    await prisma.$transaction(async (tx) => {
      // Fetch every referenced product inside the transaction, so the
      // stock numbers we check are the numbers we then update — no gap
      // for another order to sneak in between check and reserve.
      const products = await tx.product.findMany({
        where: { id: { in: items.map((item) => item.productId) } },
      });

      const productById = new Map(products.map((p) => [p.id, p]));

      // Check EVERY item before changing anything. All-or-nothing.
      for (const item of items) {
        const product = productById.get(item.productId);

        if (!product) {
          throw new Error(
            `Product ${item.productId} does not exist`
          );
        }

        if (product.quantityAvailable < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name} (${item.productId}): requested ${item.quantity}, available ${product.quantityAvailable}`
          );
        }
      }

      // Every item passed — reserve all of them together.
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantityAvailable: { decrement: item.quantity },
            quantityReserved: { increment: item.quantity },
          },
        });
      }
    });

    console.log(
      `RESERVE — order ${orderId} (correlationId ${correlationId}): all ${items.length} item(s) reserved successfully.`
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    console.log(
      `FAIL — order ${orderId} (correlationId ${correlationId}): ${reason}. No stock was changed.`
    );
  }
}

export async function startInventoryConsumers(): Promise<void> {
  await subscribeToEvents(["OrderPlaced"], async (eventType, payload) => {
    if (eventType === "OrderPlaced") {
      await handleOrderPlaced(payload);
    } else {
      console.log(`Ignoring unrelated event type: ${eventType}`);
    }
  });
}
