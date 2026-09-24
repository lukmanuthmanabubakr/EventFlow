// routes/orders.routes.ts
//
// Maps URLs to controller functions. Nothing else lives here.

import { Router } from "express";
import { createOrderHandler, getOrderHandler } from "../controllers/orders.controller";

const router = Router();

router.post("/orders", createOrderHandler);
router.get("/orders/:id", getOrderHandler);

export default router;
