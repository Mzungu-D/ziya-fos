import { Response } from "express";

import {
  detectFraudAlerts,
  getFraudAlerts,
  getFraudSummary,
} from "../services/fraudDetection.service";

import { AuthRequest } from "../middleware/auth.middleware";

export async function runFraudDetection(
  req: AuthRequest,
  res: Response
) {
  try {
    const organizationId =
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        code:
          "ORGANIZATION_REQUIRED",
        message:
          "An organization context is required.",
      });
    }

    const alerts =
      await detectFraudAlerts(
        organizationId
      );

    return res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error(
      "[FRAUD] Detection failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "FRAUD_DETECTION_FAILED",
      message:
        "Fraud detection could not be completed.",
    });
  }
}

export async function listFraudAlerts(
  req: AuthRequest,
  res: Response
) {
  try {
    const organizationId =
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        code:
          "ORGANIZATION_REQUIRED",
        message:
          "An organization context is required.",
      });
    }

    const alerts =
      await getFraudAlerts(
        organizationId
      );

    return res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error(
      "[FRAUD] Alert retrieval failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "FRAUD_ALERTS_FAILED",
      message:
        "Fraud alerts could not be loaded.",
    });
  }
}

export async function fraudSummary(
  req: AuthRequest,
  res: Response
) {
  try {
    const organizationId =
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        code:
          "ORGANIZATION_REQUIRED",
        message:
          "An organization context is required.",
      });
    }

    const summary =
      await getFraudSummary(
        organizationId
      );

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error(
      "[FRAUD] Summary failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "FRAUD_SUMMARY_FAILED",
      message:
        "Fraud summary could not be loaded.",
    });
  }
}