import express from "express";

import {
  login,
  verifyOtp,
  logout,
} from "../controllers/auth.controller";

import { registerOrganization } from "../controllers/registration.controller";

const router = express.Router();

/* =========================================================
   PUBLIC AUTHENTICATION ROUTES
========================================================= */

/*
 * Creates a new tenant organization together with
 * its Owner account.
 */
router.post(
  "/register",
  registerOrganization
);

/*
 * Login
 */
router.post(
  "/login",
  login
);

/*
 * OTP Verification
 */
router.post(
  "/verify-otp",
  verifyOtp
);

/*
 * Logout
 */
router.post(
  "/logout",
  logout
);

export default router;