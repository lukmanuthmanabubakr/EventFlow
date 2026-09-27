// services/orders.service.ts
//
// Business logic for orders. Knows nothing about HTTP — takes plain data
// in, returns plain data out. Talks to the database and publishes events.
// A controller calls this; this never touches req/res directly.

import { v4 as uuidv4 } from "uuid";
import prisma from "../config/database";
import { publishEvent } from "../config/rabbitmq";
import { simulatePayment } from "./payment.service";
import {
  CreateOrderInput,
  OrderPlacedPayload,
  PaymentSucceededPayload,
  PaymentFailedPayload,
} from "../types";

export async function createOrder(input: CreateOrderInput) {
  const correlationId = uuidv4();

  // Save the order as "pending" first — this is the source of truth,
  // written before we ever touch RabbitMQ.
  let order = await prisma.order.create({
    data: {
      correlationId,
      items: input.items as unknown as object,
      status: "pending",
    },
  });

  const orderPlacedPayload: OrderPlacedPayload = {
    eventId: uuidv4(),
    eventType: "OrderPlaced",
    correlationId,
    timestamp: new Date().toISOString(),
    data: {
      orderId: order.id,
      items: input.items,
    },
  };

  await publishEvent("OrderPlaced", orderPlacedPayload);

  // Real total, computed from what the client submitted — each item's
  // unitPrice comes from a real GET /products lookup the client made
  // beforehand. Known limitation: Order Service trusts this price as
  // given, it does not re-verify it against Inventory Service's actual
  // data. Real cross-service price verification would need an event
  // round-trip and overlaps with Week 6's saga work — accepted as a
  // deliberate simplification for now, not silently ignored.
  const totalAmount = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  // Fake payment step — real payment/saga logic replaces this in Week 6.
  const paymentResult = await simulatePayment();

  if (paymentResult.success) {
    const paymentSucceededPayload: PaymentSucceededPayload = {
      eventId: uuidv4(),
      eventType: "PaymentSucceeded",
      correlationId,
      timestamp: new Date().toISOString(),
      data: {
        orderId: order.id,
        amount: totalAmount,
      },
    };

    await publishEvent("PaymentSucceeded", paymentSucceededPayload);
  } else {
    const paymentFailedPayload: PaymentFailedPayload = {
      eventId: uuidv4(),
      eventType: "PaymentFailed",
      correlationId,
      timestamp: new Date().toISOString(),
      data: {
        orderId: order.id,
        reason: paymentResult.reason ?? "Unknown payment failure",
      },
    };

    await publishEvent("PaymentFailed", paymentFailedPayload);

    // No saga/rollback logic yet (that's Week 6) — for now, a failed
    // payment just marks the order failed immediately. Reassign order
    // to the fresh row returned by update() — otherwise the function
    // would return the stale "pending" object from before this update.
    order = await prisma.order.update({
      where: { id: order.id },
      data: { status: "failed" },
    });
  }

  return order;
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
  });
}
