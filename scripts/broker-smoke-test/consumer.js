// consumer.js
//
// Throwaway script, not part of any service. Run this first, leave it
// running in its own terminal, then run publisher.js in a second terminal.
// If this prints the message publisher.js sent, the broker smoke test
// has passed — RabbitMQ can actually move a message between two
// independent processes.

const amqp = require("amqplib");

const RABBITMQ_URL = "amqp://eventflow:change_me_locally@127.0.0.1:5672";
const QUEUE_NAME = "smoke-test-queue";

async function consume() {
  console.log("Connecting to RabbitMQ...");
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log(`Waiting for messages on "${QUEUE_NAME}"... (Ctrl+C to stop)`);

  channel.consume(QUEUE_NAME, (msg) => {
    if (msg !== null) {
      const content = JSON.parse(msg.content.toString());
      console.log("Received message:", content);
      channel.ack(msg);
    }
  });
}

consume().catch((err) => {
  console.error("Consumer failed:", err.message);
  process.exit(1);
});
