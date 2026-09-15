# EventFlow — Design Doc

## 1. Service Map

Three independent services. RabbitMQ is the only connection between them.
No service ever calls another service directly, over HTTP or otherwise.

```
+------------------------+   +------------------------+   +------------------------+
|     Order Service      |   |   Inventory Service    |   |  Notification Service  |
|    (own PostgreSQL)    |   |    (own PostgreSQL)    |   |    (event log only)    |
+-----------+------------+   +-----------+------------+   +-----------+------------+
            |                            |                            |
            |                            |                            |
            +--------------+-------------+-------------+--------------+
                           |                           |
                           v                           v
                    +------------------------------------------+
                    |                RabbitMQ                  |
                    |             (message broker)             |
                    +------------------------------------------+
```

**Rule:** every line in this diagram terminates at RabbitMQ. There is no
line that goes directly from one service box to another. If Order Service
needs something from Inventory Service, it publishes an event and waits
for a response event — it never calls Inventory Service's API, and it
never reads Inventory Service's database.
## 2. Broker Decision

**Chosen: RabbitMQ.**

Two real options existed for this build: RabbitMQ and Kafka. RabbitMQ was
chosen for three reasons specific to where this project is right now.

1. **The mental model matches what's being learned.** RabbitMQ's exchanges
   and queues map directly onto "who publishes this, who's listening for
   it" — which is exactly the concept this project exists to teach. Kafka's
   model (partitioned logs, consumer groups, offsets) is a different and
   more complex mental model, better tackled once event-driven design
   itself is second nature, not at the same time as learning it.

2. **Kafka is built for a different problem than this one has.** Kafka
   shines at high-throughput event streaming and replaying history at
   scale. EventFlow's actual volume is a handful of test orders. Using
   Kafka here would mean carrying its operational complexity — Zookeeper
   or KRaft, partition planning, consumer group rebalancing — for a
   problem that doesn't need it.

3. **RabbitMQ's routing model fits this project's shape.** With only three
   services and a well-defined event catalog (see Section 3), fanning
   events out to multiple consumers is easily handled with RabbitMQ's
   exchange/queue/binding model, without needing Kafka's log-based
   replay guarantees.

**Deferred, not rejected.** Kafka is the natural sequel project —
rebuilding this same pipeline on Kafka later is a strong way to learn
what specifically changes in consumer behaviour, offset management, and
delivery guarantees when the broker changes underneath the same event
contract.

## 3. Database Boundary Rule

**No service reads or writes another service's database, under any
circumstances. The only way one service learns about another service's
state is through an event it received.**

This is not a style preference. It is the hard constraint the entire
EventFlow project exists to teach and enforce.

Practically, this means:

- Order Service never queries Inventory Service's `products` table
  directly, even for something as simple as checking if a product exists.
  It waits for `InventoryReserved` or `InventoryFailed` to find out.
- Inventory Service never reads Order Service's `orders` table to check
  an order's status. It only knows what it's told via events.
- No service is ever given database credentials for another service's
  database, not even read-only ones. This isn't just discipline, it's
  enforced at the infrastructure level, three separate Postgres
  instances, three separate connection strings, three separate `.env`
  files.
- If a service needs data it doesn't have, that's a signal the event
  catalog is missing a field, not a reason to reach into another
  service's database as a shortcut.

Violating this rule is the single fastest way to turn EventFlow back
into a regular monolith wearing three separate folders. The whole point
is that these services genuinely don't trust or depend on each other's
internal state, only on the events they've agreed to exchange.
