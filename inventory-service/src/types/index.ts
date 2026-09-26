// types/index.ts
//
// Shared types for Inventory Service.

export interface CreateProductInput {
  name: string;
  price: number;
  quantityAvailable: number;
}
