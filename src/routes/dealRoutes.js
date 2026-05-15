const express = require("express");

const {
  createDeal,
  getDeals,
  getDealById,
  updateDeal,
  updateDealStatus,
  deleteDeal,
} = require("../controllers/dealController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Deals
 *   description: Deal and sales pipeline management APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Deal:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "c8c1c8e2-6d3a-4c9b-8e7e-8f3b1a2c9d4e"
 *         customer_id:
 *           type: string
 *           example: "d2a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *         offer:
 *           type: string
 *           example: "Website development package for 500 BHD"
 *         status:
 *           type: string
 *           example: "proposal"
 *           enum:
 *             - new
 *             - qualified
 *             - proposal
 *             - negotiation
 *             - won
 *             - lost
 *         comment:
 *           type: string
 *           example: "Offer sent to customer and waiting for response."
 *         created_by:
 *           type: string
 *           example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
 *         updated_by:
 *           type: string
 *           example: "f18e28e7-9349-47ad-b7a3-54b1f645cd83"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/deals:
 *   post:
 *     summary: Create a new deal
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     description: Create a new deal for an existing customer. Deals cannot be created for archived or blacklisted customers.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - offer
 *             properties:
 *               customer_id:
 *                 type: string
 *                 example: "d2a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *               offer:
 *                 type: string
 *                 example: "Website development package for 500 BHD"
 *               status:
 *                 type: string
 *                 example: "new"
 *                 enum:
 *                   - new
 *                   - qualified
 *                   - proposal
 *                   - negotiation
 *                   - won
 *                   - lost
 *               comment:
 *                 type: string
 *                 example: "Initial deal created after customer onboarding."
 *     responses:
 *       201:
 *         description: Deal created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.post("/", protect, createDeal);

/**
 * @swagger
 * /api/deals:
 *   get:
 *     summary: Get all deals
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch deals with optional search, customer, status, and pagination filters.
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: "website"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - new
 *             - qualified
 *             - proposal
 *             - negotiation
 *             - won
 *             - lost
 *         example: "proposal"
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *         example: "d2a4d0f5-9c3b-4b6e-b3f8-3e3f88c7d999"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: Deals fetched successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/", protect, getDeals);

/**
 * @swagger
 * /api/deals/{id}/status:
 *   patch:
 *     summary: Update deal status / pipeline stage
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     description: Update the deal pipeline status such as new, qualified, proposal, negotiation, won, or lost.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "c8c1c8e2-6d3a-4c9b-8e7e-8f3b1a2c9d4e"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: "won"
 *                 enum:
 *                   - new
 *                   - qualified
 *                   - proposal
 *                   - negotiation
 *                   - won
 *                   - lost
 *               comment:
 *                 type: string
 *                 example: "Customer accepted the offer."
 *     responses:
 *       200:
 *         description: Deal status updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Deal not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/status", protect, updateDealStatus);

/**
 * @swagger
 * /api/deals/{id}:
 *   get:
 *     summary: Get deal by ID
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     description: Fetch a single deal by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "c8c1c8e2-6d3a-4c9b-8e7e-8f3b1a2c9d4e"
 *     responses:
 *       200:
 *         description: Deal fetched successfully
 *       400:
 *         description: Invalid deal id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Deal not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", protect, getDealById);

/**
 * @swagger
 * /api/deals/{id}:
 *   patch:
 *     summary: Update deal
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     description: Update deal offer, status, or comment.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "c8c1c8e2-6d3a-4c9b-8e7e-8f3b1a2c9d4e"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               offer:
 *                 type: string
 *                 example: "Updated website development package for 650 BHD"
 *               status:
 *                 type: string
 *                 example: "negotiation"
 *                 enum:
 *                   - new
 *                   - qualified
 *                   - proposal
 *                   - negotiation
 *                   - won
 *                   - lost
 *               comment:
 *                 type: string
 *                 example: "Customer requested a revised offer."
 *     responses:
 *       200:
 *         description: Deal updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Deal not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", protect, updateDeal);

/**
 * @swagger
 * /api/deals/{id}:
 *   delete:
 *     summary: Delete deal
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     description: Delete a deal permanently from the database.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "c8c1c8e2-6d3a-4c9b-8e7e-8f3b1a2c9d4e"
 *     responses:
 *       200:
 *         description: Deal deleted successfully
 *       400:
 *         description: Invalid deal id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Deal not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", protect, deleteDeal);

module.exports = router;