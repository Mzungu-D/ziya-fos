import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "../lib/auth";

type AuditLog = {
  id: string;
  date: string;
  user: string;
  action: string;
  module: string;
  details: string;
};

type AuditTrailResponse = {
  success?: boolean;
  data?: AuditLog[];
  totals?: {
    auditEvents?: number;
    users?: number;
    modules?: number;
  };
  message?: string;
};

export default function AuditTrails() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(
    []
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =========================================================
     LOAD AUDIT TRAILS
  ========================================================= */

  const loadAuditTrails = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await authenticatedFetch(
          "/api/financial-reports/audit-trail"
        );

      const payload =
        (await response.json()) as AuditTrailResponse;

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "Failed to load audit trails."
        );
      }

      if (
        !payload.success ||
        !Array.isArray(payload.data)
      ) {
        throw new Error(
          "Invalid audit trail response."
        );
      }

      setAuditLogs(payload.data);
    } catch (err) {
      console.error(
        "AUDIT TRAIL LOAD ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load audit trails."
      );

      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    void loadAuditTrails();
  }, []);

  /* =========================================================
     SUMMARY DATA
  ========================================================= */

  const summary = useMemo(() => {
    const today =
      new Date();

    const todayYear =
      today.getFullYear();

    const todayMonth =
      today.getMonth();

    const todayDate =
      today.getDate();

    const todayLogs =
      auditLogs.filter(
        (log) => {
          const logDate =
            new Date(log.date);

          return (
            logDate.getFullYear() ===
              todayYear &&
            logDate.getMonth() ===
              todayMonth &&
            logDate.getDate() ===
              todayDate
          );
        }
      );

    const activeUsers =
      new Set(
        auditLogs.map(
          (log) => log.user
        )
      ).size;

    /*
     * The current AuditTrail model does not contain
     * a severity or critical-event field.
     *
     * We therefore do not invent a critical-event
     * calculation. This remains zero until the
     * audit model defines what constitutes a
     * critical event.
     */
    const criticalEvents = 0;

    return {
      todayActivities:
        todayLogs.length,

      activeUsers,

      criticalEvents,
    };
  }, [auditLogs]);

  /* =========================================================
     FORMAT DATE
  ========================================================= */

  const formatDateTime = (
    value: string
  ) => {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString(
      "en-KE",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-6">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div>
        <h1 className="text-3xl font-bold text-[#20243A]">
          Audit Trails
        </h1>

        <p className="text-[#666B84] mt-2">
          Track every action performed within Ziya FOS.
        </p>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-600">
            {error}
          </p>
        </div>
      )}

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="grid grid-cols-4 gap-6">

        {/* Today's Activities */}

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Today's Activities
          </p>

          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            {loading
              ? "—"
              : summary.todayActivities}
          </h2>
        </div>

        {/* Active Users */}

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Active Users
          </p>

          <h2 className="text-3xl font-bold text-green-400 mt-2">
            {loading
              ? "—"
              : summary.activeUsers}
          </h2>
        </div>

        {/* Critical Events */}

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Critical Events
          </p>

          <h2 className="text-3xl font-bold text-red-400 mt-2">
            {loading
              ? "—"
              : summary.criticalEvents}
          </h2>
        </div>

        {/* System Integrity */}

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            System Integrity
          </p>

          <h2
            className={`text-2xl font-bold mt-2 ${
              error
                ? "text-red-400"
                : "text-green-400"
            }`}
          >
            {loading
              ? "Checking..."
              : error
              ? "Attention"
              : "Healthy"}
          </h2>
        </div>

      </div>

      {/* =====================================================
          AUDIT LOG TABLE
      ===================================================== */}

      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-hidden">

        <table className="w-full">

          <thead className="bg-white text-[#666B84]">
            <tr>

              <th className="text-left p-4">
                Time
              </th>

              <th className="text-left p-4">
                User
              </th>

              <th className="text-left p-4">
                Action
              </th>

              <th className="text-left p-4">
                Module
              </th>

              <th className="text-left p-4">
                Details
              </th>

            </tr>
          </thead>

          <tbody>

            {/* =================================================
                LOADING
            ================================================= */}

            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-[#666B84]"
                >
                  Loading audit trails...
                </td>
              </tr>
            )}

            {/* =================================================
                EMPTY STATE
            ================================================= */}

            {!loading &&
              !error &&
              auditLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-[#666B84]"
                  >
                    No audit activity found.
                  </td>
                </tr>
              )}

            {/* =================================================
                AUDIT RECORDS
            ================================================= */}

            {!loading &&
              auditLogs.map(
                (log) => (
                  <tr
                    key={log.id}
                    className="border-t border-[#ECECF3] hover:bg-[#FAFAFC]"
                  >

                    <td className="p-4 text-[#666B84] whitespace-nowrap">
                      {formatDateTime(
                        log.date
                      )}
                    </td>

                    <td className="p-4 text-[#20243A]">
                      {log.user}
                    </td>

                    <td className="p-4 text-[#20243A]">
                      {log.action}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {log.module}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {log.details}
                    </td>

                  </tr>
                )
              )}

          </tbody>

        </table>

      </div>

    </div>
  );
}