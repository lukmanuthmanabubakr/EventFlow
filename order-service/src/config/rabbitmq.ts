// rabbitmq.ts
//
// Handles the RabbitMQ connection for this service, and exposes a single
// publishEvent() helper. Order Service's routes call this instead of
// touching amqplib directly, so the connection logic lives in one place.

import amqp, { Channel, ChannelModel } from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://eventflow:change_me_locally@127.0.0.1:5672";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

// Every event this service publishes goes through this one exchange.
// Using a "topic" exchange (not the default exchange from the Week 1
// smoke test) means later services can bind only to the event types
// they actually care about, instead of listening to everything.
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
