// services/products.service.ts
//
// Business logic for products. Knows nothing about HTTP — takes plain
// data in, returns plain data out.

import prisma from "../config/database";
import { CreateProductInput } from "../types";

export async function createProduct(input: CreateProductInput) {
  return prisma.product.create({
    data: {
      name: input.name,
      price: input.price,
      quantityAvailable: input.quantityAvailable,
    },
  });
}

export async function listProducts() {
  return prisma.product.findMany({
    orderBy: { createdAt: "asc" },
  });
}
