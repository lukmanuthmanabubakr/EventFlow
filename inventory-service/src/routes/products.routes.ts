// routes/products.routes.ts
//
// Maps URLs to controller functions. Nothing else lives here.

import { Router } from "express";
import { createProductHandler, listProductsHandler } from "../controllers/products.controller";

const router = Router();

router.post("/products", createProductHandler);
router.get("/products", listProductsHandler);

export default router;
