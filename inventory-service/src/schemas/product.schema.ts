// schemas/product.schema.ts
//
// Single source of truth for what a valid "create product" request looks
// like. No hardcoded/placeholder values allowed through — price and
// stock must be real, explicit numbers a caller actually provides.

import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "name is required"),
  price: z.number().int().positive("price must be a positive integer (cents)"),
  quantityAvailable: z
    .number()
    .int()
    .nonnegative("quantityAvailable must be zero or a positive integer"),
});

export type CreateProductRequest = z.infer<typeof createProductSchema>;
