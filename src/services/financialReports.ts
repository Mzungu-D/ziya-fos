export type ReportType =
  | "balance-sheet"
  | "profit-loss"
  | "cash-flow"
  | "trial-balance"
  | "receivables-aging"
  | "payables-aging"
  | "customer-balances"
  | "vendor-payables"
  | "cash-position"
  | "bank-summary"
  | "bank-reconciliation"
  | "mpesa";

const REPORT_ENDPOINTS: Record<ReportType, string> = {
  "balance-sheet": "/api/balance-sheet",
  "profit-loss": "/api/income-statement",
  "cash-flow": "/api/cash-flow",
  "trial-balance": "/api/trial-balance",

  "receivables-aging":
    "/api/financial-reports/receivables-aging",

  "payables-aging":
    "/api/financial-reports/payables-aging",

  "customer-balances":
    "/api/financial-reports/customer-balances",

  "vendor-payables":
    "/api/financial-reports/vendor-payables",

  "cash-position":
    "/api/financial-reports/cash-position",

  "bank-summary":
    "/api/financial-reports/bank-summary",

  "bank-reconciliation":
    "/api/financial-reports/bank-reconciliation",

  mpesa:
    "/api/financial-reports/mpesa",
};

import { authenticatedFetch, getAuthToken } from "../lib/auth";

export const isSupportedReport = (
  reportType: string
): reportType is ReportType => {
  return reportType in REPORT_ENDPOINTS;
};

export const fetchFinancialReport = async (
  reportType: ReportType,
  params?: {
    startDate?: string;
    endDate?: string;
    asOfDate?: string;
  }
): Promise<unknown> => {
  const endpoint = REPORT_ENDPOINTS[reportType];

  const searchParams = new URLSearchParams();

  if (params?.startDate) {
    searchParams.set("startDate", params.startDate);
  }

  if (params?.endDate) {
    searchParams.set("endDate", params.endDate);
  }

  if (params?.asOfDate) {
    searchParams.set("asOfDate", params.asOfDate);
  }

  const query = searchParams.toString();

  const url = query
    ? `${endpoint}?${query}`
    : endpoint;

  const token = getAuthToken();

  const response = await authenticatedFetch(url, {
    method: "GET",

    headers: {
      Accept: "application/json",

      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : `Failed to generate report (${response.status})`;

    throw new Error(message);
  }

  return data;
};
