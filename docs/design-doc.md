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
                    |             (message broker)              |
                    +--------------------------------------------+
```

**Rule:** every line in this diagram terminates at RabbitMQ. There is no
line that goes directly from one service box to another. If Order Service
needs something from Inventory Service, it publishes an event and waits
for a response event — it never calls Inventory Service's API, and it
never reads Inventory Service's database.