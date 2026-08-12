import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  testTenantMpesaConnection,
} from "../services/mpesa.service";
import {
  encryptSecret,
} from "../utils/encryption";

function getOrganizationId(
  req: AuthRequest
): string | null {
  return req.user?.organizationId ?? null;
}

function clean(
  value: unknown
): string {
  return String(value ?? "").trim();
}

export const listMpesaAccounts =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const accounts =
        await prisma.mpesaAccount.findMany({
          where: {
            organizationId,
          },

          select: {
            id: true,
            name: true,
            accountType: true,
            shortcode: true,
            environment: true,
            initiatorName: true,
            resultUrl: true,
            timeoutUrl: true,
            isActive: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true,
          },

          orderBy: [
            {
              isDefault: "desc",
            },
            {
              createdAt: "asc",
            },
          ],
        });

      return res.status(200).json({
        success: true,
        accounts,
      });
    } catch (error) {
      console.error(
        "[MPESA ACCOUNTS] LIST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load M-Pesa accounts.",
      });
    }
  };

export const createMpesaAccount =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const {
        name,
        accountType,
        shortcode,
        environment,
        consumerKey,
        consumerSecret,
        initiatorName,
        securityCredential,
        resultUrl,
        timeoutUrl,
        isDefault,
      } = req.body;

      const cleanName = clean(name);
      const cleanType =
        clean(accountType).toUpperCase();
      const cleanShortcode =
        clean(shortcode);
      const cleanEnvironment =
        clean(environment).toLowerCase();
      const cleanInitiator =
        clean(initiatorName);
      const cleanResultUrl =
        clean(resultUrl);
      const cleanTimeoutUrl =
        clean(timeoutUrl);

      if (!cleanName) {
        return res.status(400).json({
          success: false,
          message:
            "Account name is required.",
        });
      }

      if (
        !["B2C", "B2B", "PAYBILL", "TILL"].includes(
          cleanType
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid M-Pesa account type.",
        });
      }

      if (
        !["sandbox", "production"].includes(
          cleanEnvironment
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Environment must be sandbox or production.",
        });
      }

      if (!/^\d{5,7}$/.test(cleanShortcode)) {
        return res.status(400).json({
          success: false,
          message:
            "M-Pesa shortcode is invalid.",
        });
      }

      if (
        !clean(consumerKey) ||
        !clean(consumerSecret)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Consumer key and consumer secret are required.",
        });
      }

      if (!cleanInitiator) {
        return res.status(400).json({
          success: false,
          message:
            "Initiator name is required.",
        });
      }

      if (!clean(securityCredential)) {
        return res.status(400).json({
          success: false,
          message:
            "Security credential is required.",
        });
      }

      if (!cleanResultUrl) {
        return res.status(400).json({
          success: false,
          message:
            "Result URL is required.",
        });
      }

      if (!cleanTimeoutUrl) {
        return res.status(400).json({
          success: false,
          message:
            "Timeout URL is required.",
        });
      }

      const duplicate =
        await prisma.mpesaAccount.findFirst({
          where: {
            organizationId,
            OR: [
              {
                name: cleanName,
              },
              {
                shortcode:
                  cleanShortcode,
              },
            ],
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "An M-Pesa account with this name or shortcode already exists.",
        });
      }

      const makeDefault =
        Boolean(isDefault);

      const account =
        await prisma.$transaction(
          async (tx) => {
            if (makeDefault) {
              await tx.mpesaAccount.updateMany({
                where: {
                  organizationId,
                },
                data: {
                  isDefault: false,
                },
              });
            }

            return tx.mpesaAccount.create({
              data: {
                organizationId,
                name: cleanName,
                accountType: cleanType,
                shortcode:
                  cleanShortcode,
                environment:
                  cleanEnvironment,

                consumerKeyEncrypted:
                  encryptSecret(
                    clean(consumerKey)
                  ),

                consumerSecretEncrypted:
                  encryptSecret(
                    clean(consumerSecret)
                  ),

                initiatorName:
                  cleanInitiator,

                securityCredentialEncrypted:
                  encryptSecret(
                    clean(securityCredential)
                  ),

                resultUrl:
                  cleanResultUrl,

                timeoutUrl:
                  cleanTimeoutUrl,

                isActive: false,

                isDefault:
                  makeDefault,
              },

              select: {
                id: true,
                name: true,
                accountType: true,
                shortcode: true,
                environment: true,
                initiatorName: true,
                resultUrl: true,
                timeoutUrl: true,
                isActive: true,
                isDefault: true,
                createdAt: true,
                updatedAt: true,
              },
            });
          }
        );

      return res.status(201).json({
        success: true,
        message:
          "M-Pesa account saved successfully. Test the connection before activating it.",
        account,
      });
    } catch (error) {
      console.error(
        "[MPESA ACCOUNTS] CREATE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to save M-Pesa account.",
      });
    }
  };

export const testMpesaAccount =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const id =
        clean(req.params.id);

      const account =
        await prisma.mpesaAccount.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!account) {
        return res.status(404).json({
          success: false,
          message:
            "M-Pesa account not found.",
        });
      }

      const result =
        await testTenantMpesaConnection(
          organizationId
        );

      return res.status(200).json({
        success: true,
        message:
          "M-Pesa credentials are valid and Safaricom authentication succeeded.",
        result,
      });
    } catch (error) {
      console.error(
        "[MPESA ACCOUNTS] TEST ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "M-Pesa connection test failed.",
      });
    }
  };

export const activateMpesaAccount =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const id =
        clean(req.params.id);

      const account =
        await prisma.mpesaAccount.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!account) {
        return res.status(404).json({
          success: false,
          message:
            "M-Pesa account not found.",
        });
      }

      if (
        account.accountType !== "B2C"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only B2C accounts can currently be activated for batch payments.",
        });
      }

      await testTenantMpesaConnection(
        organizationId
      );

      const updated =
        await prisma.$transaction(
          async (tx) => {
            await tx.mpesaAccount.updateMany({
              where: {
                organizationId,
              },
              data: {
                isDefault: false,
              },
            });

            return tx.mpesaAccount.update({
              where: {
                id: account.id,
              },
              data: {
                isActive: true,
                isDefault: true,
              },
              select: {
                id: true,
                name: true,
                accountType: true,
                shortcode: true,
                environment: true,
                initiatorName: true,
                resultUrl: true,
                timeoutUrl: true,
                isActive: true,
                isDefault: true,
                createdAt: true,
                updatedAt: true,
              },
            });
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "M-Pesa account activated successfully.",
        account: updated,
      });
    } catch (error) {
      console.error(
        "[MPESA ACCOUNTS] ACTIVATE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to activate M-Pesa account.",
      });
    }
  };