// database.ts
//
// One shared Prisma client for the whole service. Every file that needs
// the database imports from here instead of creating its own client.
//
// Prisma 7 requires an explicit driver adapter — a plain connection
// string constructor no longer works. PrismaPg is the Postgres adapter.

import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
