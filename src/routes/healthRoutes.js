import express from "express";
import { checkHealth } from "../controllers/healthController.js";

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: Check if CRM backend is running
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Backend is running successfully
 */
router.get("/", checkHealth);

export default router;