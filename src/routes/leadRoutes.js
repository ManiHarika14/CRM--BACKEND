const express = require("express");

const {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  assignLead,
  updateLeadStage,
  updateVerificationStatus,
  deleteLead,
} = require("../controllers/leadController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Lead management APIs
 */

/**
 * @swagger
 * /api/leads:
 *   post:
 *     summary: Create a new lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lead_type, assigned_to]
 *             properties:
 *               source:
 *                 type: string
 *                 example: website
 *               source_url:
 *                 type: string
 *                 example: https://example.com/contact
 *               extraction_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-05-15T05:21:01.700Z"
 *               lead_type:
 *                 type: string
 *                 enum: [Customer, Vendor, AlliedSP, BConsultant]
 *                 example: Customer
 *               name:
 *                 type: string
 *                 example: Ahmed Ali
 *               email:
 *                 type: string
 *                 example: ahmed@example.com
 *               phone:
 *                 type: string
 *                 example: "+97333332222"
 *               address:
 *                 type: string
 *                 example: Manama, Bahrain
 *               company_name:
 *                 type: string
 *                 example: ABC Trading
 *               website:
 *                 type: string
 *                 example: https://abctrading.com
 *               verification_status:
 *                 type: string
 *                 enum: [new, pending_verification, verified, not_interested, churned]
 *                 example: new
 *               confidence:
 *                 type: number
 *                 example: 0.85
 *               crm_stage:
 *                 type: string
 *                 enum: [new, contacted, qualified, proposal_sent, converted, lost, onboarded]
 *                 example: new
 *               assigned_to:
 *                 type: string
 *                 example: "4698b086-50d8-48e7-bf32-b1347328e4d1"
 *     responses:
 *       201:
 *         description: Lead created successfully
 */
router.post("/", createLead);

/**
 * @swagger
 * /api/leads:
 *   get:
 *     summary: Get all leads with search, filter, and pagination
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: Ahmed
 *       - in: query
 *         name: lead_type
 *         schema:
 *           type: string
 *           enum: [Customer, Vendor, AlliedSP, BConsultant]
 *       - in: query
 *         name: verification_status
 *         schema:
 *           type: string
 *           enum: [new, pending_verification, verified, not_interested, churned]
 *       - in: query
 *         name: crm_stage
 *         schema:
 *           type: string
 *           enum: [new, contacted, qualified, proposal_sent, converted, lost, onboarded]
 *       - in: query
 *         name: assigned_to
 *         schema:
 *           type: string
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
 *         description: Leads fetched successfully
 */
router.get("/", getLeads);

/**
 * @swagger
 * /api/leads/{id}:
 *   get:
 *     summary: Get lead by ID
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d6eab230-9921-44ab-a7fc-559a86bf66b6"
 *     responses:
 *       200:
 *         description: Lead fetched successfully
 */
router.get("/:id", getLeadById);

/**
 * @swagger
 * /api/leads/{id}:
 *   patch:
 *     summary: Update lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d6eab230-9921-44ab-a7fc-559a86bf66b6"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [comment]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Ahmed Updated
 *               email:
 *                 type: string
 *                 example: updated@example.com
 *               phone:
 *                 type: string
 *                 example: "+97333332222"
 *               company_name:
 *                 type: string
 *                 example: Updated Company
 *               comment:
 *                 type: string
 *                 example: Lead details updated after verification call.
 *     responses:
 *       200:
 *         description: Lead updated successfully
 */
router.patch("/:id", updateLead);

/**
 * @swagger
 * /api/leads/{id}/assign:
 *   patch:
 *     summary: Assign lead to user
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d6eab230-9921-44ab-a7fc-559a86bf66b6"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assigned_to, comment]
 *             properties:
 *               assigned_to:
 *                 type: string
 *                 example: "4698b086-50d8-48e7-bf32-b1347328e4d1"
 *               comment:
 *                 type: string
 *                 example: Lead assigned to admin for follow-up.
 *     responses:
 *       200:
 *         description: Lead assigned successfully
 */
router.patch("/:id/assign", assignLead);

/**
 * @swagger
 * /api/leads/{id}/stage:
 *   patch:
 *     summary: Update lead CRM stage
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d6eab230-9921-44ab-a7fc-559a86bf66b6"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [crm_stage, comment]
 *             properties:
 *               crm_stage:
 *                 type: string
 *                 enum: [new, contacted, qualified, proposal_sent, converted, lost, onboarded]
 *                 example: contacted
 *               comment:
 *                 type: string
 *                 example: Lead contacted by phone and asked for more details.
 *     responses:
 *       200:
 *         description: Lead stage updated successfully
 */
router.patch("/:id/stage", updateLeadStage);

/**
 * @swagger
 * /api/leads/{id}/verification:
 *   patch:
 *     summary: Update lead verification status
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d6eab230-9921-44ab-a7fc-559a86bf66b6"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [verification_status, comment]
 *             properties:
 *               verification_status:
 *                 type: string
 *                 enum: [new, pending_verification, verified, not_interested, churned]
 *                 example: verified
 *               comment:
 *                 type: string
 *                 example: Lead confirmed interest and is ready for onboarding.
 *     responses:
 *       200:
 *         description: Lead verification status updated successfully
 */
router.patch("/:id/verification", updateVerificationStatus);

/**
 * @swagger
 * /api/leads/{id}:
 *   delete:
 *     summary: Delete lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "d6eab230-9921-44ab-a7fc-559a86bf66b6"
 *     responses:
 *       200:
 *         description: Lead deleted successfully
 */
router.delete("/:id", deleteLead);

module.exports = router;