const express = require("express");
const { register, verifyOtp, resendOtp, login, refresh, logout, me } = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: StrongPass@123
 *               role:
 *                 type: string
 *                 example: admin
 *     responses:
 *       201:
 *         description: Registration successful, OTP sent to email
 *       409:
 *         description: Email already registered
 *       400:
 *         description: Validation error
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify email OTP to complete registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified, account active
 *       400:
 *         description: Invalid or expired code
 *       404:
 *         description: User not found
 */
router.post("/verify-otp", verifyOtp);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP verification code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: User already confirmed
 *       404:
 *         description: User not found
 */
router.post("/resend-otp", resendOtp);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: StrongPass@123
 *     responses:
 *       200:
 *         description: Login successful, tokens set in HttpOnly cookies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: integer
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Email not verified or account inactive
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token set in cookie
 *       401:
 *         description: No refresh token or session expired
 */
router.post("/refresh", refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and invalidate Cognito session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully, cookie cleared
 */
router.post("/logout", logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current logged-in user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current logged-in user
 *       401:
 *         description: Not authorized
 */
router.get("/me", protect, me);

module.exports = router;
