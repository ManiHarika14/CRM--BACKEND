const express = require("express");

const {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    convertLeadToCustomer,
    updateCustomerStatus,
    archiveCustomer,
} = require("../controllers/customerController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management and lead conversion APIs
 */

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a customer manually
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_type:
 *                 type: string
 *                 enum: [Customer, Vendor, BConsultant, AlliedSP]
 *                 example: Customer
 *               status:
 *                 type: string
 *                 enum: [active, inactive, blacklisted, archived]
 *                 example: active
 *               name:
 *                 type: string
 *                 example: Ahmed Ali
 *               email:
 *                 type: string
 *                 example: ahmed@example.com
 *               phone:
 *                 type: string
 *                 example: "+97312345678"
 *               address:
 *                 type: string
 *                 example: Manama, Bahrain
 *               company_name:
 *                 type: string
 *                 example: ABC Trading
 *               website:
 *                 type: string
 *                 example: https://example.com
 *               contact_info:
 *                 type: string
 *                 example: Main contact through WhatsApp
 *               comments:
 *                 type: string
 *                 example: Confirmed customer added manually
 *     responses:
 *       201:
 *         description: Customer created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Duplicate customer found
 */
router.post("/", protect, createCustomer);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: Ahmed
 *       - in: query
 *         name: customer_type
 *         schema:
 *           type: string
 *           enum: [Customer, Vendor, BConsultant, AlliedSP]
 *         example: Customer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, blacklisted, archived]
 *         example: active
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
 *         description: Customers fetched successfully
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 */
router.get("/", protect, getCustomers);

/**
 * @swagger
 * /api/customers/convert-lead/{leadId}:
 *   post:
 *     summary: Convert verified lead to customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: string
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comments
 *             properties:
 *               comments:
 *                 type: string
 *                 example: Lead verified and converted to customer.
 *     responses:
 *       201:
 *         description: Lead converted to customer successfully
 *       400:
 *         description: Lead cannot be converted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lead not found
 *       409:
 *         description: Duplicate customer found
 */
router.post("/convert-lead/:leadId", protect, convertLeadToCustomer);

/**
 * @swagger
 * /api/customers/{id}/status:
 *   patch:
 *     summary: Update customer status
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 550e8400-e29b-41d4-a716-446655440000
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
 *                 enum: [active, inactive, blacklisted, archived]
 *                 example: inactive
 *               comments:
 *                 type: string
 *                 example: Customer temporarily marked as inactive.
 *     responses:
 *       200:
 *         description: Customer status updated successfully
 *       400:
 *         description: Invalid customer id or status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 */
router.patch("/:id/status", protect, updateCustomerStatus);

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Archive customer instead of permanently deleting
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comments:
 *                 type: string
 *                 example: Customer archived after becoming inactive.
 *     responses:
 *       200:
 *         description: Customer archived successfully
 *       400:
 *         description: Invalid customer id or customer already archived
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 */
router.delete("/:id", protect, archiveCustomer);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       200:
 *         description: Customer fetched successfully
 *       400:
 *         description: Invalid customer id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 */
router.get("/:id", protect, getCustomerById);

/**
 * @swagger
 * /api/customers/{id}:
 *   patch:
 *     summary: Update customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_type:
 *                 type: string
 *                 enum: [Customer, Vendor, BConsultant, AlliedSP]
 *                 example: Vendor
 *               status:
 *                 type: string
 *                 enum: [active, inactive, blacklisted, archived]
 *                 example: active
 *               name:
 *                 type: string
 *                 example: Updated Customer Name
 *               email:
 *                 type: string
 *                 example: updated@example.com
 *               phone:
 *                 type: string
 *                 example: "+97312345678"
 *               address:
 *                 type: string
 *                 example: Seef, Bahrain
 *               company_name:
 *                 type: string
 *                 example: Updated Company
 *               website:
 *                 type: string
 *                 example: https://updated-company.com
 *               contact_info:
 *                 type: string
 *                 example: Updated contact details
 *               comments:
 *                 type: string
 *                 example: Customer profile updated
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 *       409:
 *         description: Duplicate customer found
 */
router.patch("/:id", protect, updateCustomer);

module.exports = router;