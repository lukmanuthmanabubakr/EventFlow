// publisher.js
//
// Throwaway script, not part of any service. This exists purely to prove
// RabbitMQ can actually receive and hold a message. Run consumer.js first,
// leave it running, then run this in a second terminal.

const amqp = require("amqplib");

const RABBITMQ_URL = "amqp://eventflow:change_me_locally@localhost:5672";
const QUEUE_NAME = "smoke-test-queue";

async function publish() {
  console.log("Connecting to RabbitMQ...");
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });

  const message = {
    text: "Hello from publisher.js",
    sentAt: new Date().toISOString(),
  };

  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });

  console.log("Sent message:", message);

  setTimeout(() => {
    connection.close();
    process.exit(0);
  }, 500);
}

publish().catch((err) => {
  console.error("Publisher failed:", err.message);
  process.exit(1);
});
