// services/orders.service.ts
//
// Business logic for orders. Knows nothing about HTTP — takes plain data
// in, returns plain data out. Talks to the database and publishes events.
// A controller calls this; this never touches req/res directly.

import { v4 as uuidv4 } from "uuid";
import prisma from "../config/database";
import { publishEvent } from "../config/rabbitmq";
import { CreateOrderInput, OrderPlacedPayload } from "../types";

export async function createOrder(input: CreateOrderInput) {
  const correlationId = uuidv4();

  // Save the order as "pending" first — this is the source of truth,
  // written before we ever touch RabbitMQ.
  const order = await prisma.order.create({
    data: {
      correlationId,
      items: input.items as unknown as object,
      status: "pending",
    },
  });

  const eventPayload: OrderPlacedPayload = {
    eventId: uuidv4(),
    eventType: "OrderPlaced",
    correlationId,
    timestamp: new Date().toISOString(),
    data: {
      orderId: order.id,
      items: input.items,
    },
  };

  await publishEvent("OrderPlaced", eventPayload);

  return order;
}
