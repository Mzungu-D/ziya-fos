import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  authenticatedFetch,
} from "../lib/auth";

interface FraudAlert {
  id: string;
  alertCode: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  riskScore: number;
  sourceType: string;
  sourceId: string | null;
  amount: number | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

interface FraudSummary {
  activeAlerts: number;
  resolvedCases: number;
  riskScore: number;
  systemStatus: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  code?: string;
  message?: string;
}

function getSeverityClasses(
  severity: string
) {
  switch (severity.toUpperCase()) {
    case "HIGH":
      return "bg-red-500/20 text-red-500";

    case "MEDIUM":
      return "bg-yellow-500/20 text-yellow-600";

    case "LOW":
      return "bg-green-500/20 text-green-600";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getStatusClasses(
  status: string
) {
  switch (status.toUpperCase()) {
    case "RESOLVED":
      return "bg-green-500/20 text-green-600";

    case "INVESTIGATING":
      return "bg-yellow-500/20 text-yellow-600";

    case "OPEN":
      return "bg-[#0D9488]/20 text-[#0D9488]";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatSeverity(
  severity: string
) {
  return (
    severity.charAt(0).toUpperCase() +
    severity.slice(1).toLowerCase()
  );
}

function formatStatus(
  status: string
) {
  return (
    status.charAt(0).toUpperCase() +
    status.slice(1).toLowerCase()
  );
}

function formatDate(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-KE",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

export default function FraudDetection() {
  const [alerts, setAlerts] =
    useState<FraudAlert[]>([]);

  const [summary, setSummary] =
    useState<FraudSummary>({
      activeAlerts: 0,
      resolvedCases: 0,
      riskScore: 0,
      systemStatus: "Monitoring",
    });

  const [loading, setLoading] =
    useState(true);

  const [scanning, setScanning] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadFraudData =
    useCallback(async () => {
      try {
        setError(null);

        const [
          alertsResponse,
          summaryResponse,
        ] = await Promise.all([
          authenticatedFetch(
            "/api/fraud-detection"
          ),

          authenticatedFetch(
            "/api/fraud-detection/summary"
          ),
        ]);

        if (!alertsResponse.ok) {
          throw new Error(
            "Fraud alerts could not be loaded."
          );
        }

        if (!summaryResponse.ok) {
          throw new Error(
            "Fraud summary could not be loaded."
          );
        }

        const alertsResult =
          (await alertsResponse.json()) as ApiResponse<
            FraudAlert[]
          >;

        const summaryResult =
          (await summaryResponse.json()) as ApiResponse<
            FraudSummary
          >;

        if (!alertsResult.success) {
          throw new Error(
            alertsResult.message ??
              "Fraud alerts could not be loaded."
          );
        }

        if (!summaryResult.success) {
          throw new Error(
            summaryResult.message ??
              "Fraud summary could not be loaded."
          );
        }

        setAlerts(
          Array.isArray(
            alertsResult.data
          )
            ? alertsResult.data
            : []
        );

        setSummary(
          summaryResult.data
        );
      } catch (err) {
        console.error(
          "[FRAUD UI] Failed to load fraud data:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Fraud data could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadFraudData();
  }, [loadFraudData]);

  async function runScan() {
    try {
      setScanning(true);
      setError(null);

      const response =
        await authenticatedFetch(
          "/api/fraud-detection/scan",
          {
            method: "POST",
          }
        );

      const result =
        (await response.json()) as ApiResponse<
          FraudAlert[]
        >;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ??
            "Fraud detection scan failed."
        );
      }

      await loadFraudData();
    } catch (err) {
      console.error(
        "[FRAUD UI] Fraud scan failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Fraud detection scan failed."
      );
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Fraud Detection
          </h1>

          <p className="text-[#666B84] mt-2">
            Monitor suspicious activities and financial anomalies.
          </p>
        </div>

        <button
          type="button"
          onClick={runScan}
          disabled={scanning || loading}
          className="px-5 py-3 rounded-xl bg-[#20243A] text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {scanning
            ? "Scanning..."
            : "Run Detection Scan"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          <p className="font-medium">
            Unable to load fraud detection data
          </p>

          <p className="text-sm mt-1">
            {error}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Active Alerts
          </p>

          <h2 className="text-3xl font-bold text-red-500 mt-2">
            {loading
              ? "—"
              : summary.activeAlerts}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Resolved Cases
          </p>

          <h2 className="text-3xl font-bold text-green-500 mt-2">
            {loading
              ? "—"
              : summary.resolvedCases}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Risk Score
          </p>

          <h2 className="text-3xl font-bold text-yellow-500 mt-2">
            {loading
              ? "—"
              : `${summary.riskScore}%`}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            System Status
          </p>

          <h2 className="text-2xl font-bold text-green-500 mt-2">
            {loading
              ? "—"
              : summary.systemStatus}
          </h2>
        </div>

      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-hidden">

        <div className="px-6 py-5 border-b border-[#ECECF3]">
          <h2 className="text-lg font-semibold text-[#20243A]">
            Fraud Alerts
          </h2>

          <p className="text-sm text-[#666B84] mt-1">
            Alerts detected within the current organization.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">

            <thead className="bg-[#FAFAFC] text-[#666B84]">
              <tr>
                <th className="text-left p-4 font-medium">
                  Alert ID
                </th>

                <th className="text-left p-4 font-medium">
                  Type
                </th>

                <th className="text-left p-4 font-medium">
                  Description
                </th>

                <th className="text-left p-4 font-medium">
                  Severity
                </th>

                <th className="text-left p-4 font-medium">
                  Risk
                </th>

                <th className="text-left p-4 font-medium">
                  Status
                </th>

                <th className="text-left p-4 font-medium">
                  Detected
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-[#666B84]"
                  >
                    Loading fraud alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-[#666B84]"
                  >
                    No fraud alerts have been detected.
                  </td>
                </tr>
              ) : (
                alerts.map(
                  (alert) => (
                    <tr
                      key={alert.id}
                      className="border-t border-[#ECECF3] hover:bg-[#FAFAFC] transition"
                    >
                      <td className="p-4 text-[#20243A] font-medium">
                        {alert.alertCode}
                      </td>

                      <td className="p-4 text-[#20243A]">
                        {alert.type}
                      </td>

                      <td className="p-4 text-[#666B84] min-w-[300px]">
                        {alert.description}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm ${getSeverityClasses(
                            alert.severity
                          )}`}
                        >
                          {formatSeverity(
                            alert.severity
                          )}
                        </span>
                      </td>

                      <td className="p-4 text-[#20243A] font-medium">
                        {alert.riskScore}%
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm ${getStatusClasses(
                            alert.status
                          )}`}
                        >
                          {formatStatus(
                            alert.status
                          )}
                        </span>
                      </td>

                      <td className="p-4 text-[#666B84] whitespace-nowrap">
                        {formatDate(
                          alert.detectedAt
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>

          </table>
        </div>
      </div>

    </div>
  );
}