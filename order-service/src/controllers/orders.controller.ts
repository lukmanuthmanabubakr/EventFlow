// controllers/orders.controller.ts
//
// Thin HTTP layer. Reads req/res, validates the shape of what came in
// using the Zod schema, calls the service for the actual work, sends
// the response. No business logic lives here.

import { Request, Response } from "express";
import { createOrder, getOrderById } from "../services/orders.service";
import { createOrderSchema, orderIdParamSchema } from "../schemas/order.schema";

export async function createOrderHandler(req: Request, res: Response) {
  const parsed = createOrderSchema.safeParse(req.body);

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
    const order = await createOrder(parsed.data);

    return res.status(201).json({
      status: "ok",
      order: {
        id: order.id,
        correlationId: order.correlationId,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    console.error("Failed to create order:", err);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong creating the order.",
    });
  }
}

export async function getOrderHandler(req: Request, res: Response) {
  const parsed = orderIdParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid order id",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const order = await getOrderById(parsed.data.id);

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    return res.status(200).json({
      status: "ok",
      order,
    });
  } catch (err) {
    console.error("Failed to fetch order:", err);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong fetching the order.",
    });
  }
}
