// shared-events/src/index.ts
//
// TypeScript mirror of docs/event-catalog.json. This is the actual
// contract all three services import from. If you add or change an
// event, update event-catalog.json AND this file together, they must
// never drift apart.

export type ProductLine = {
  productId: string;
  quantity: number;
};

// ---------- Base shape every event shares ----------
interface BaseEvent<TType extends string, TData> {
  eventId: string;        // unique per event instance — used for Week 5 idempotency checks
  eventType: TType;
  correlationId: string;  // ties every event about one order together — used for Week 4 tracing
  timestamp: string;      // ISO8601
  data: TData;
}

// ---------- Order Service events ----------
export type OrderPlaced = BaseEvent<
  "OrderPlaced",
  { orderId: string; items: ProductLine[] }
>;

export type PaymentSucceeded = BaseEvent<
  "PaymentSucceeded",
  { orderId: string; amount: number }
>;

export type PaymentFailed = BaseEvent<
  "PaymentFailed",
  { orderId: string; reason: string }
>;

export type PaymentRefunded = BaseEvent<
  "PaymentRefunded",
  { orderId: string; amount: number }
>;

export type OrderCancelled = BaseEvent<
  "OrderCancelled",
  { orderId: string; reason: string }
>;

// ---------- Inventory Service events ----------
export type InventoryReserved = BaseEvent<
  "InventoryReserved",
  { orderId: string; reservedItems: ProductLine[] }
>;

export type InventoryFailed = BaseEvent<
  "InventoryFailed",
  { orderId: string; reason: string }
>;

export type ReservationExpired = BaseEvent<
  "ReservationExpired",
  { orderId: string }
>;

export type OrderPartiallyFulfilled = BaseEvent<
  "OrderPartiallyFulfilled",
  {
    orderId: string;
    fulfilledItems: ProductLine[];
    backorderedItems: ProductLine[];
  }
>;

// ---------- Union of every event in the system ----------
// Useful for Notification Service, which listens to all of them.
export type EventFlowEvent =
  | OrderPlaced
  | PaymentSucceeded
  | PaymentFailed
  | PaymentRefunded
  | OrderCancelled
  | InventoryReserved
  | InventoryFailed
  | ReservationExpired
  | OrderPartiallyFulfilled;