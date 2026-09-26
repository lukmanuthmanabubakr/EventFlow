// controllers/products.controller.ts
//
// Thin HTTP layer. Reads req/res, validates with Zod, calls the service,
// sends the response. No business logic lives here.

import { Request, Response } from "express";
import { createProduct, listProducts } from "../services/products.service";
import { createProductSchema } from "../schemas/product.schema";

export async function createProductHandler(req: Request, res: Response) {
  const parsed = createProductSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid request body",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const product = await createProduct(parsed.data);
    return res.status(201).json({ status: "ok", product });
  } catch (err) {
    console.error("Failed to create product:", err);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong creating the product.",
    });
  }
}

export async function listProductsHandler(req: Request, res: Response) {
  try {
    const products = await listProducts();
    return res.status(200).json({ status: "ok", products });
  } catch (err) {
    console.error("Failed to list products:", err);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong fetching products.",
    });
  }
}
