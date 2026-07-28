import express from "express";

import {
  login,
  verifyOtp,
} from "../controllers/auth.controller";

import {
  registerOrganization,
} from "../controllers/registration.controller";

const router = express.Router();

/* =========================================================
   PUBLIC AUTHENTICATION ROUTES
========================================================= */

/*
 * Self-service tenant registration.
 *
 * Creates:
 * - isolated Organization
 * - tenant OWNER account
 * - OWNER membership
 *
 * Never creates PLATFORM_ADMIN access.
 */
router.post(
  "/register",
  registerOrganization
);

/*
 * Login.
 *
 * PLATFORM_ADMIN and tenant authentication are resolved
 * by the authentication controller.
 */
router.post(
  "/login",
  login
);

/*
 * OTP verification.
 *
 * Email/phone delivery integration remains dependent
 * on the production OTP provider.
 */
router.post(
  "/verify-otp",
  verifyOtp
);

export default router;