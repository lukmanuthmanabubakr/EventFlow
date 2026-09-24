// rabbitmq.ts
//
// Handles the RabbitMQ connection for this service, and exposes
// publishEvent() and subscribeToEvents() helpers. Order Service's
// routes/consumers call these instead of touching amqplib directly.

import amqp, { Channel, ChannelModel } from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://eventflow:change_me_locally@127.0.0.1:5672";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

// Every event this service publishes goes through this one exchange.
const EXCHANGE_NAME = "eventflow.events";

export async function connectRabbitMQ(): Promise<void> {
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
  console.log("Connected to RabbitMQ, exchange ready:", EXCHANGE_NAME);
}

// eventType becomes the routing key, e.g. "OrderPlaced" — this is what
// a consumer will bind to later, in Inventory/Notification Service.
export async function publishEvent<T extends object>(
  eventType: string,
  payload: T
): Promise<void> {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialised — call connectRabbitMQ() first");
  }

  channel.publish(
    EXCHANGE_NAME,
    eventType,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  );

  console.log(`Published ${eventType}:`, payload);
}

// This service's own permanent queue — unlike the Week 1 smoke test's
// throwaway queue, this one is real and durable. Order Service listens
// on it for events other services publish about orders it created.
const ORDER_SERVICE_QUEUE = "order-service.inventory-events";

// Subscribes to one or more event types (routing keys) on the shared
// exchange. onMessage receives the routing key and the parsed payload —
// it decides what to actually do; this function only handles the
// RabbitMQ plumbing (queue, binding, ack).
export async function subscribeToEvents(
  eventTypes: string[],
  onMessage: (eventType: string, payload: unknown) => Promise<void>
): Promise<void> {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialised — call connectRabbitMQ() first");
  }

  await channel.assertQueue(ORDER_SERVICE_QUEUE, { durable: true });

  for (const eventType of eventTypes) {
    await channel.bindQueue(ORDER_SERVICE_QUEUE, EXCHANGE_NAME, eventType);
  }

  console.log(
    `Listening on "${ORDER_SERVICE_QUEUE}" for:`,
    eventTypes.join(", ")
  );

  channel.consume(ORDER_SERVICE_QUEUE, async (msg) => {
    if (!msg || !channel) return;

    const eventType = msg.fields.routingKey;

    try {
      const payload = JSON.parse(msg.content.toString());
      await onMessage(eventType, payload);
      channel.ack(msg);
    } catch (err) {
      // A malformed or unhandleable message would loop forever if
      // requeued. Log it and acknowledge anyway — Week 5's idempotency
      // work will make this more sophisticated (dead-letter handling).
      console.error(`Failed to process ${eventType} event:`, err);
      channel.ack(msg);
    }
  });
}
