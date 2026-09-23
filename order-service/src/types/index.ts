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
