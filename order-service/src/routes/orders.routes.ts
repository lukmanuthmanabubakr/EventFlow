// routes/orders.routes.ts
//
// Maps URLs to controller functions. Nothing else lives here.

import { Router } from "express";
import { createOrderHandler } from "../controllers/orders.controller";

const router = Router();

router.post("/orders", createOrderHandler);

export default router;
