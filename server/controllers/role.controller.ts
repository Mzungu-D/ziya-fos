import { Response } from "express";

import { AuthRequest } from "../middleware/auth.middleware";
import {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_NAMES,
} from "../config/roleTemplates";

/* =========================================================
   GET TENANT ROLE TEMPLATES

   GET /api/roles

   Returns the standard Ziya FOS tenant roles and the
   permissions controlled by each template.

   OWNER is intentionally excluded because ownership is
   managed separately.

   CUSTOM is included as a selectable role with no
   predefined permissions.
========================================================= */

export const getRoleTemplates = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (
      !req.user?.userId ||
      !req.user.organizationId
    ) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const roles =
      ROLE_TEMPLATE_NAMES.map(
        (role) => ({
          role,
          permissions: [
            ...ROLE_TEMPLATES[role],
          ],
        })
      );

    roles.push({
      role: "CUSTOM" as any,
      permissions: [],
    });

    return res.status(200).json({
      success: true,

      roles,

      rules: {
        ownerProtected: true,
        customRoleAllowed: true,
        platformRolesExcluded: true,
      },
    });
  } catch (error) {
    console.error(
      "[ROLES] Failed to retrieve role templates:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ROLE_TEMPLATE_FETCH_FAILED",
      message:
        "Failed to retrieve role templates.",
    });
  }
};