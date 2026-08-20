import { useEffect, useState } from "react";
import { authenticatedFetch } from "../lib/auth";

type Approval = {
  id: string;
  module: string;
  description: string;
  amount: number;
  requestedBy: string;
  status: string;
  createdAt?: string;
};

type ApiResponse = {
  success?: boolean;
  data?: Approval[];
  approvals?: Approval[];
  message?: string;
};

export default function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================================================
     LOAD APPROVALS
  ========================================================= */

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authenticatedFetch(
        "/api/approvals"
      );

      const payload =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "Failed to load approvals."
        );
      }

      /*
       * The API may return the approvals under
       * data or approvals depending on the controller
       * response structure.
       */
      const records = Array.isArray(
        payload.data
      )
        ? payload.data
        : Array.isArray(
            payload.approvals
          )
        ? payload.approvals
        : [];

      setApprovals(records);
    } catch (err) {
      console.error(
        "APPROVALS LOAD ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load approvals."
      );

      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    void loadApprovals();
  }, []);

  /* =========================================================
     FORMAT AMOUNT
  ========================================================= */

  const formatAmount = (
    amount: number
  ) => {
    return `KES ${Number(amount || 0).toLocaleString(
      "en-KE",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  /* =========================================================
     STATUS DISPLAY
  ========================================================= */

  const formatStatus = (
    status: string
  ) => {
    if (!status) {
      return "Unknown";
    }

    return status
      .toLowerCase()
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );
  };

  /* =========================================================
     STATUS STYLE
  ========================================================= */

  const getStatusClass = (
    status: string
  ) => {
    const normalized =
      status.toUpperCase();

    if (
      normalized === "APPROVED"
    ) {
      return "bg-green-500/20 text-green-400";
    }

    if (
      normalized === "REJECTED"
    ) {
      return "bg-red-500/20 text-red-400";
    }

    if (
      normalized === "PENDING"
    ) {
      return "bg-yellow-500/20 text-yellow-400";
    }

    return "bg-[#0D9488]/20 text-[#20243A]";
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
          Approvals
        </h1>

        <p className="text-[#666B84] mt-2">
          Review and approve financial requests.
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
          APPROVALS TABLE
      ===================================================== */}

      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-hidden">

        <table className="w-full">

          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">
                ID
              </th>

              <th className="text-left p-4">
                Module
              </th>

              <th className="text-left p-4">
                Description
              </th>

              <th className="text-right p-4">
                Amount
              </th>

              <th className="text-left p-4">
                Requested By
              </th>

              <th className="text-left p-4">
                Status
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
                  colSpan={6}
                  className="p-8 text-center text-[#666B84]"
                >
                  Loading approvals...
                </td>
              </tr>
            )}

            {/* =================================================
                EMPTY STATE
            ================================================= */}

            {!loading &&
              !error &&
              approvals.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-[#666B84]"
                  >
                    No approval requests found.
                  </td>
                </tr>
              )}

            {/* =================================================
                APPROVAL RECORDS
            ================================================= */}

            {!loading &&
              approvals.map(
                (approval) => (
                  <tr
                    key={approval.id}
                    className="border-t border-[#ECECF3] hover:bg-[#FAFAFC]"
                  >

                    <td className="p-4 text-[#20243A]">
                      {approval.id}
                    </td>

                    <td className="p-4 text-[#20243A]">
                      {approval.module}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {approval.description}
                    </td>

                    <td className="p-4 text-right text-[#20243A]">
                      {formatAmount(
                        approval.amount
                      )}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {approval.requestedBy}
                    </td>

                    <td className="p-4">

                      <span
                        className={`px-3 py-1 rounded-full text-sm ${getStatusClass(
                          approval.status
                        )}`}
                      >
                        {formatStatus(
                          approval.status
                        )}
                      </span>

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