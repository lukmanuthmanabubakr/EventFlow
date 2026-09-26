// prisma/seed.ts
//
// Populates real products with real stock and real prices, so Inventory
// Service has something genuine to check against once real request
// handling exists (Task 2/3). Run with: npx tsx prisma/seed.ts

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const products = [
    { name: "Wireless Mouse", price: 2499, quantityAvailable: 50 },
    { name: "Mechanical Keyboard", price: 8999, quantityAvailable: 20 },
    { name: "USB-C Hub", price: 3499, quantityAvailable: 5 },
    { name: "27-inch Monitor", price: 24999, quantityAvailable: 0 }, // deliberately out of stock, for testing
  ];

  for (const product of products) {
    const created = await prisma.product.create({ data: product });
    console.log(`Seeded: ${created.name} (${created.id}) — $${(created.price / 100).toFixed(2)}, stock: ${created.quantityAvailable}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
