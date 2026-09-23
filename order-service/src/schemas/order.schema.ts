// schemas/order.schema.ts
//
// Single source of truth for what a valid "create order" request looks
// like. The TypeScript type is derived FROM this schema (z.infer), so
// the validation rule and the type can never drift apart.

import { z } from "zod";

export const productLineSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().positive("quantity must be a positive integer"),
});

export const createOrderSchema = z.object({
  items: z
    .array(productLineSchema)
    .min(1, "items must contain at least one product"),
});

// Derived type — matches ProductLine/CreateOrderInput in types/index.ts,
// generated automatically from the schema above instead of hand-written.
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
