import type { Response } from "express-serve-static-core";

import type { AuthRequest } from "../middleware/auth.middleware";

import {
  generateFinancialForecast,
  generateCompletedMonthForecast,
  getForecastReadiness,
  FORECASTING_CONFIG,
} from "../services/ai/forecasting.service";

const DEFAULT_HISTORY_MONTHS =
  FORECASTING_CONFIG.defaultHistoryMonths;

const DEFAULT_FORECAST_MONTHS =
  FORECASTING_CONFIG.defaultForecastMonths;

const MAX_HISTORY_MONTHS =
  FORECASTING_CONFIG.maximumHistoryMonths;

const MAX_FORECAST_MONTHS =
  FORECASTING_CONFIG.maximumForecastMonths;

const DEFAULT_CONFIDENCE =
  FORECASTING_CONFIG.defaultConfidenceLevel;

function getTenantOrganizationId(
  req: AuthRequest
): string {
  const sessionType =
    req.user?.sessionType;

  const organizationId =
    req.user?.organizationId;

  /*
   * AI financial data is available only inside a
   * tenant session.
   *
   * Platform sessions must never be allowed to
   * query tenant financial information.
   */
  if (
    sessionType !== "TENANT"
  ) {
    throw new Error(
      "AI_TENANT_SESSION_REQUIRED"
    );
  }

  if (
    typeof organizationId !==
      "string" ||
    !organizationId.trim()
  ) {
    throw new Error(
      "AI_ORGANIZATION_CONTEXT_REQUIRED"
    );
  }

  return organizationId.trim();
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  fieldName: string
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(
          String(value).trim()
        );

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    throw new Error(
      `AI_INVALID_${fieldName.toUpperCase()}`
    );
  }

  if (parsed > maximum) {
    throw new Error(
      `AI_${fieldName.toUpperCase()}_EXCEEDS_LIMIT`
    );
  }

  return parsed;
}

function parseConfidence(
  value: unknown
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return DEFAULT_CONFIDENCE;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(
          String(value).trim()
        );

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    parsed >= 1
  ) {
    throw new Error(
      "AI_INVALID_CONFIDENCE"
    );
  }

  if (
    parsed <
      FORECASTING_CONFIG.minimumConfidence ||
    parsed >
      FORECASTING_CONFIG.maximumConfidence
  ) {
    throw new Error(
      "AI_CONFIDENCE_OUT_OF_RANGE"
    );
  }

  return parsed;
}

function parseDate(
  value: unknown
): Date | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const raw =
    String(value).trim();

  const parsed =
    new Date(raw);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    throw new Error(
      "AI_INVALID_END_DATE"
    );
  }

  return parsed;
}

function sendError(
  res: Response,
  error: unknown
): Response {
  const code =
    error instanceof Error
      ? error.message
      : "AI_REQUEST_FAILED";

  switch (code) {
    case "AI_TENANT_SESSION_REQUIRED":
      return res.status(403).json({
        success: false,
        error: "TENANT_SESSION_REQUIRED",
        message:
          "AI financial services are available only within an organization session.",
      });

    case "AI_ORGANIZATION_CONTEXT_REQUIRED":
      return res.status(403).json({
        success: false,
        error:
          "ORGANIZATION_CONTEXT_REQUIRED",
        message:
          "No valid organization context is available for this session.",
      });

    case "AI_INVALID_HISTORY_MONTHS":
      return res.status(400).json({
        success: false,
        error:
          "INVALID_HISTORY_MONTHS",
        message:
          "historyMonths must be a positive integer.",
      });

    case "AI_HISTORYMONTHS_EXCEEDS_LIMIT":
    case "AI_HISTORY_MONTHS_EXCEEDS_LIMIT":
      return res.status(400).json({
        success: false,
        error:
          "HISTORY_MONTHS_EXCEEDS_LIMIT",
        message:
          `historyMonths cannot exceed ${MAX_HISTORY_MONTHS}.`,
      });

    case "AI_INVALID_FORECAST_MONTHS":
      return res.status(400).json({
        success: false,
        error:
          "INVALID_FORECAST_MONTHS",
        message:
          "forecastMonths must be a positive integer.",
      });

    case "AI_FORECASTMONTHS_EXCEEDS_LIMIT":
    case "AI_FORECAST_MONTHS_EXCEEDS_LIMIT":
      return res.status(400).json({
        success: false,
        error:
          "FORECAST_MONTHS_EXCEEDS_LIMIT",
        message:
          `forecastMonths cannot exceed ${MAX_FORECAST_MONTHS}.`,
      });

    case "AI_INVALID_CONFIDENCE":
      return res.status(400).json({
        success: false,
        error:
          "INVALID_CONFIDENCE",
        message:
          "confidenceLevel must be a number between 0 and 1.",
      });

    case "AI_CONFIDENCE_OUT_OF_RANGE":
      return res.status(400).json({
        success: false,
        error:
          "CONFIDENCE_OUT_OF_RANGE",
        message:
          `confidenceLevel must be between ${FORECASTING_CONFIG.minimumConfidence} and ${FORECASTING_CONFIG.maximumConfidence}.`,
      });

    case "AI_INVALID_END_DATE":
      return res.status(400).json({
        success: false,
        error:
          "INVALID_END_DATE",
        message:
          "endDate must be a valid date.",
      });

    case "AI_FINANCIAL_DATA_ORGANIZATION_REQUIRED":
      return res.status(400).json({
        success: false,
        error:
          "ORGANIZATION_REQUIRED",
        message:
          "A valid organization context is required.",
      });

    case "AI_FINANCIAL_DATA_ORGANIZATION_NOT_FOUND":
      return res.status(404).json({
        success: false,
        error:
          "ORGANIZATION_NOT_FOUND",
        message:
          "The organization associated with this session could not be found.",
      });

    case "FORECAST_ORGANIZATION_REQUIRED":
      return res.status(400).json({
        success: false,
        error:
          "ORGANIZATION_REQUIRED",
        message:
          "A valid organization context is required.",
      });

    case "FORECAST_FINANCIAL_DATA_REQUIRED":
    case "FORECAST_INVALID_FINANCIAL_DATA":
      return res.status(422).json({
        success: false,
        error:
          "FINANCIAL_DATA_UNAVAILABLE",
        message:
          "Financial data required for forecasting is unavailable.",
      });

    default:
      console.error(
        "[AI] Controller error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "AI_REQUEST_FAILED",
        message:
          "The AI financial service could not complete the request.",
      });
  }
}

/**
 * GET /api/ai/data-readiness
 *
 * Determines whether the authenticated tenant has enough
 * posted/approved financial history for forecasting.
 *
 * IMPORTANT:
 * organizationId is deliberately NOT accepted from
 * query parameters.
 */
export async function getAIDataReadiness(
  req: AuthRequest,
  res: Response
): Promise<Response> {
  try {
    const organizationId =
      getTenantOrganizationId(
        req
      );

    const historyMonths =
      parsePositiveInteger(
        req.query.historyMonths,
        DEFAULT_HISTORY_MONTHS,
        MAX_HISTORY_MONTHS,
        "historyMonths"
      );

    const endDate =
      parseDate(
        req.query.endDate
      );

    const readiness =
      await getForecastReadiness(
        organizationId,
        {
          historyMonths,
          endDate,
        }
      );

    return res.status(200).json({
      success: true,

      data: readiness,

      meta: {
        organizationScoped:
          true,

        organizationId,

        model:
          FORECASTING_CONFIG.model,

        modelVersion:
          FORECASTING_CONFIG.modelVersion,

        minimumTrainingMonths:
          FORECASTING_CONFIG.minimumTrainingMonths,

        requestedHistoryMonths:
          historyMonths,

        accountingSource:
          FORECASTING_CONFIG.accountingSource,

        effectiveJournalStatuses:
          FORECASTING_CONFIG
            .effectiveJournalStatuses,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}

/**
 * GET /api/ai/forecast
 *
 * Generates a forecast for the authenticated tenant.
 *
 * Supported query parameters:
 *
 * historyMonths
 * forecastMonths
 * confidenceLevel
 * endDate
 * completedMonthsOnly
 */
export async function getAIForecast(
  req: AuthRequest,
  res: Response
): Promise<Response> {
  try {
    const organizationId =
      getTenantOrganizationId(
        req
      );

    const historyMonths =
      parsePositiveInteger(
        req.query.historyMonths,
        DEFAULT_HISTORY_MONTHS,
        MAX_HISTORY_MONTHS,
        "historyMonths"
      );

    const forecastMonths =
      parsePositiveInteger(
        req.query.forecastMonths,
        DEFAULT_FORECAST_MONTHS,
        MAX_FORECAST_MONTHS,
        "forecastMonths"
      );

    const confidenceLevel =
      parseConfidence(
        req.query.confidenceLevel
      );

    const endDate =
      parseDate(
        req.query.endDate
      );

    const completedMonthsOnly =
      String(
        req.query.completedMonthsOnly ??
          "false"
      ).toLowerCase() ===
      "true";

    const forecast =
      await generateFinancialForecast(
        organizationId,
        {
          historyMonths,
          forecastMonths,
          confidenceLevel,
          endDate,
          completedMonthsOnly,
        }
      );

    return res.status(200).json({
      success: true,

      data: forecast,

      meta: {
        organizationScoped:
          true,

        organizationId,

        model:
          FORECASTING_CONFIG.model,

        modelVersion:
          FORECASTING_CONFIG.modelVersion,

        currency:
          FORECASTING_CONFIG.currency,

        historyMonths,

        forecastMonths,

        confidenceLevel,

        completedMonthsOnly,

        accountingSource:
          FORECASTING_CONFIG.accountingSource,

        effectiveJournalStatuses:
          FORECASTING_CONFIG
            .effectiveJournalStatuses,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}

/**
 * GET /api/ai/forecast/completed
 *
 * Production-oriented forecast that excludes the current
 * incomplete accounting month.
 *
 * This is suitable for scheduled reporting and executive
 * dashboards where partial current-month data could distort
 * the forecast.
 */
export async function getCompletedAIForecast(
  req: AuthRequest,
  res: Response
): Promise<Response> {
  try {
    const organizationId =
      getTenantOrganizationId(
        req
      );

    const historyMonths =
      parsePositiveInteger(
        req.query.historyMonths,
        DEFAULT_HISTORY_MONTHS,
        MAX_HISTORY_MONTHS,
        "historyMonths"
      );

    const forecastMonths =
      parsePositiveInteger(
        req.query.forecastMonths,
        DEFAULT_FORECAST_MONTHS,
        MAX_FORECAST_MONTHS,
        "forecastMonths"
      );

    const confidenceLevel =
      parseConfidence(
        req.query.confidenceLevel
      );

    const forecast =
      await generateCompletedMonthForecast(
        organizationId,
        {
          historyMonths,
          forecastMonths,
          confidenceLevel,
        }
      );

    return res.status(200).json({
      success: true,

      data: forecast,

      meta: {
        organizationScoped:
          true,

        organizationId,

        model:
          FORECASTING_CONFIG.model,

        modelVersion:
          FORECASTING_CONFIG.modelVersion,

        currency:
          FORECASTING_CONFIG.currency,

        historyMonths,

        forecastMonths,

        confidenceLevel,

        completedMonthsOnly:
          true,

        accountingSource:
          FORECASTING_CONFIG.accountingSource,

        effectiveJournalStatuses:
          FORECASTING_CONFIG
            .effectiveJournalStatuses,
      },
    });
  } catch (error) {
    return sendError(
      res,
      error
    );
  }
}

/**
 * GET /api/ai/config
 *
 * Returns non-sensitive forecasting configuration.
 *
 * This endpoint does NOT expose organization data.
 */
export async function getAIConfiguration(
  _req: AuthRequest,
  res: Response
): Promise<Response> {
  return res.status(200).json({
    success: true,

    data: {
      model:
        FORECASTING_CONFIG.model,

      modelVersion:
        FORECASTING_CONFIG.modelVersion,

      currency:
        FORECASTING_CONFIG.currency,

      minimumTrainingMonths:
        FORECASTING_CONFIG.minimumTrainingMonths,

      defaultHistoryMonths:
        FORECASTING_CONFIG.defaultHistoryMonths,

      maximumHistoryMonths:
        FORECASTING_CONFIG.maximumHistoryMonths,

      defaultForecastMonths:
        FORECASTING_CONFIG.defaultForecastMonths,

      maximumForecastMonths:
        FORECASTING_CONFIG.maximumForecastMonths,

      defaultConfidenceLevel:
        FORECASTING_CONFIG.defaultConfidenceLevel,

      minimumConfidence:
        FORECASTING_CONFIG.minimumConfidence,

      maximumConfidence:
        FORECASTING_CONFIG.maximumConfidence,

      accountingSource:
        FORECASTING_CONFIG.accountingSource,

      effectiveJournalStatuses:
        FORECASTING_CONFIG
          .effectiveJournalStatuses,

      tenantIsolation:
        FORECASTING_CONFIG.tenantIsolation,
    },
  });
}