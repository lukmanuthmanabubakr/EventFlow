// types/index.ts
//
// Shared types for Order Service. Matches the shapes agreed in
// docs/event-catalog.json — keep these in sync with that file.

export interface ProductLine {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: ProductLine[];
}

export interface OrderPlacedPayload {
  eventId: string;
  eventType: "OrderPlaced";
  correlationId: string;
  timestamp: string;
  data: {
    orderId: string;
    items: ProductLine[];
  };
}

export interface PaymentSucceededPayload {
  eventId: string;
  eventType: "PaymentSucceeded";
  correlationId: string;
  timestamp: string;
  data: {
    orderId: string;
    amount: number;
  };
}

export interface PaymentFailedPayload {
  eventId: string;
  eventType: "PaymentFailed";
  correlationId: string;
  timestamp: string;
  data: {
    orderId: string;
    reason: string;
  };
}
