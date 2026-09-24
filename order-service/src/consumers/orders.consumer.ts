// consumers/orders.consumer.ts
//
// Reacts to events other services publish about orders. Knows nothing
// about RabbitMQ plumbing (that's config/rabbitmq.ts's job) — just takes
// an event type + payload and decides what should happen to the order.

import prisma from "../config/database";
import { subscribeToEvents } from "../config/rabbitmq";

interface InventoryReservedPayload {
  correlationId: string;
  data: { orderId: string };
}

interface InventoryFailedPayload {
  correlationId: string;
  data: { orderId: string; reason: string };
}

function isInventoryEventPayload(
  payload: unknown
): payload is InventoryReservedPayload | InventoryFailedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "correlationId" in payload &&
    "data" in payload
  );
}

async function handleInventoryReserved(payload: unknown): Promise<void> {
  if (!isInventoryEventPayload(payload)) {
    console.error("Malformed InventoryReserved payload, skipping:", payload);
    return;
  }

  const { correlationId } = payload;

  const updated = await prisma.order.updateMany({
    where: { correlationId },
    data: { status: "confirmed" },
  });

  if (updated.count === 0) {
    console.error(
      `InventoryReserved received for unknown correlationId: ${correlationId}`
    );
    return;
  }

  console.log(`Order ${correlationId} -> confirmed`);
}

async function handleInventoryFailed(payload: unknown): Promise<void> {
  if (!isInventoryEventPayload(payload)) {
    console.error("Malformed InventoryFailed payload, skipping:", payload);
    return;
  }

  const { correlationId } = payload;

  const updated = await prisma.order.updateMany({
    where: { correlationId },
    data: { status: "failed" },
  });

  if (updated.count === 0) {
    console.error(
      `InventoryFailed received for unknown correlationId: ${correlationId}`
    );
    return;
  }

  console.log(`Order ${correlationId} -> failed`);
}

export async function startOrderConsumers(): Promise<void> {
  await subscribeToEvents(
    ["InventoryReserved", "InventoryFailed"],
    async (eventType, payload) => {
      if (eventType === "InventoryReserved") {
        await handleInventoryReserved(payload);
      } else if (eventType === "InventoryFailed") {
        await handleInventoryFailed(payload);
      } else {
        console.log(`Ignoring unrelated event type: ${eventType}`);
      }
    }
  );
}
