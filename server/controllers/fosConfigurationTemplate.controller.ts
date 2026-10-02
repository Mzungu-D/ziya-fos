import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";
import {
  bootstrapDemoAsFosTemplate,
  getFosTemplateStatus,
  publishFosTemplate,
  reconcileAllTenantsFromLatestFosTemplate,
  setFosTemplateSource,
} from "../services/fosConfigurationTemplate.service";

export async function bootstrap(req: AuthRequest, res: Response) {
  try {
    const { demoOrganizationId } = req.body as { demoOrganizationId?: string };
    if (!demoOrganizationId?.trim()) {
      return res.status(400).json({ success: false, error: "demoOrganizationId is required" });
    }

    const template = await bootstrapDemoAsFosTemplate(
      prisma,
      demoOrganizationId.trim(),
      req.user?.userId,
    );

    return res.json({ success: true, template });
  } catch (error) {
    console.error("FOS template bootstrap failed", error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Bootstrap failed",
    });
  }
}

export async function publish(req: AuthRequest, res: Response) {
  try {
    const { sourceOrganizationId } = req.body as { sourceOrganizationId?: string };

    if (!sourceOrganizationId?.trim()) {
      return res.status(400).json({
        success: false,
        error: "sourceOrganizationId is required",
      });
    }

    await setFosTemplateSource(prisma, sourceOrganizationId.trim());

    const template = await publishFosTemplate(
      prisma,
      sourceOrganizationId.trim(),
      req.user?.userId,
    );

    return res.json({ success: true, template });
  } catch (error) {
    console.error("FOS template publish failed", error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Publish failed",
    });
  }
}

export async function reconcile(_req: AuthRequest, res: Response) {
  try {
    return res.json({
      success: true,
      ...(await reconcileAllTenantsFromLatestFosTemplate(prisma)),
    });
  } catch (error) {
    console.error("FOS template reconciliation failed", error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Reconciliation failed",
    });
  }
}

export async function status(_req: AuthRequest, res: Response) {
  try {
    return res.json({
      success: true,
      ...(await getFosTemplateStatus(prisma)),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Status failed",
    });
  }
}
