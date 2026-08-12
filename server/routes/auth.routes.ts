import express from "express";

import {
  login,
  verifyOtp,
  logout,
  phoneLogin,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller";

import { registerOrganization } from "../controllers/registration.controller";

const router = express.Router();

router.post("/register",        registerOrganization);
router.post("/login",           login);
router.post("/phone-login",     phoneLogin);
router.post("/verify-otp",      verifyOtp);
router.post("/logout",          logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password",  resetPassword);

export default router;