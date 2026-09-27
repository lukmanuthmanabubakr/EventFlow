// rabbitmq.ts
//
// Handles the RabbitMQ connection for this service, and exposes
// publishEvent() and subscribeToEvents() helpers — same pattern as
// order-service's config/rabbitmq.ts, kept consistent across services.

import amqp, { Channel, ChannelModel } from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://eventflow:change_me_locally@127.0.0.1:5672";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

// Every event in the system goes through this one shared exchange —
// same exchange order-service publishes to.
const EXCHANGE_NAME = "eventflow.events";

export async function connectRabbitMQ(): Promise<void> {
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
  console.log("Connected to RabbitMQ, exchange ready:", EXCHANGE_NAME);
}

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

// This service's own permanent queue, listening for order-related events.
const INVENTORY_SERVICE_QUEUE = "inventory-service.order-events";

export async function subscribeToEvents(
  eventTypes: string[],
  onMessage: (eventType: string, payload: unknown) => Promise<void>
): Promise<void> {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialised — call connectRabbitMQ() first");
  }

  await channel.assertQueue(INVENTORY_SERVICE_QUEUE, { durable: true });

  for (const eventType of eventTypes) {
    await channel.bindQueue(INVENTORY_SERVICE_QUEUE, EXCHANGE_NAME, eventType);
  }

  console.log(
    `Listening on "${INVENTORY_SERVICE_QUEUE}" for:`,
    eventTypes.join(", ")
  );

  channel.consume(INVENTORY_SERVICE_QUEUE, async (msg) => {
    if (!msg || !channel) return;

    const eventType = msg.fields.routingKey;

    try {
      const payload = JSON.parse(msg.content.toString());
      await onMessage(eventType, payload);
      channel.ack(msg);
    } catch (err) {
      console.error(`Failed to process ${eventType} event:`, err);
      channel.ack(msg);
    }
  });
}
