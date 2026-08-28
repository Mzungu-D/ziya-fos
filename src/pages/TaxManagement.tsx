import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  X,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { authenticatedFetch } from "../lib/auth-session";

type TaxObligation = {
  code: string;
  id: string;
  taxType: string;
  name: string;
  registrationNumber?: string | null;
  filingFrequency: string;
  dueRule?: string | null;
  currency: string;
  isActive: boolean;
};

type TaxPayment = {
  id: string;
  paymentReference?: string | null;
  paymentDate: string;
  amount: string | number;
  paymentMethod: string;
  status: string;
};

type TaxFiling = {
  id: string;
  taxObligationCode: string;
  taxPeriodStart: string;
  taxPeriodEnd: string;
  dueDate: string;
  taxableAmount: string | number;
  taxAmount: string | number;
  adjustments: string | number;
  penalties: string | number;
  interest: string | number;
  totalPayable: string | number;
  filingReference?: string | null;
  filingDate?: string | null;
  filingStatus: string;
  paymentStatus: string;
  notes?: string | null;
  obligation?: TaxObligation | null;
  payments: TaxPayment[];
};

type TaxApiResponse<T> = {
  success: boolean;
  message?: string;
  obligations?: T[];
  filings?: T[];
  payments?: T[];
};

function getNumber(
  value: string | number | null | undefined
): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(
  value: string | number | null | undefined,
  currency = "KES"
): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(getNumber(value));
}

function formatDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeriod(
  start: string,
  end: string
): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return "-";
  }

  const startText = startDate.toLocaleDateString(
    "en-KE",
    {
      month: "short",
      year: "numeric",
    }
  );

  const endText = endDate.toLocaleDateString(
    "en-KE",
    {
      month: "short",
      year: "numeric",
    }
  );

  return startText === endText
    ? startText
    : `${startText} - ${endText}`;
}

function statusClasses(status: string): string {
  switch (status.toUpperCase()) {
    case "SUBMITTED":
    case "APPROVED":
    case "PAID":
    case "COMPLETED":
      return "bg-green-500/10 text-green-700";

    case "OVERDUE":
    case "FAILED":
      return "bg-red-500/10 text-red-700";

    case "PARTIALLY_PAID":
    case "UNDER_REVIEW":
      return "bg-blue-500/10 text-blue-700";

    case "DRAFT":
    case "PENDING":
    case "UNPAID":
    default:
      return "bg-yellow-500/10 text-yellow-700";
  }
}

export default function TaxManagement() {
  const [obligations, setObligations] =
    useState<TaxObligation[]>([]);

  const [filings, setFilings] =
    useState<TaxFiling[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [showPaymentForm, setShowPaymentForm] =
    useState(false);

  const [paymentSubmitting, setPaymentSubmitting] =
    useState(false);

  const [selectedFiling, setSelectedFiling] =
    useState<TaxFiling | null>(null);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("BANK");

  const [paymentReference, setPaymentReference] =
    useState("");

  const [paymentNotes, setPaymentNotes] =
    useState("");

  const [form, setForm] = useState({
    taxObligationCode: "",
    taxPeriodStart: "",
    taxPeriodEnd: "",
    dueDate: "",
    taxableAmount: "",
    taxAmount: "",
    adjustments: "0",
    penalties: "0",
    interest: "0",
    filingReference: "",
    notes: "",
  });

  const loadTaxData = async (
    showRefreshState = false
  ) => {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        obligationsResponse,
        filingsResponse,
      ] = await Promise.all([
        authenticatedFetch("/api/tax/obligations", {
          credentials: "include",
        }),

        authenticatedFetch("/api/tax/filings", {
          credentials: "include",
        }),
      ]);

      if (
        !obligationsResponse.ok ||
        !filingsResponse.ok
      ) {
        throw new Error(
          "Unable to load tax information."
        );
      }

      const obligationsData =
        (await obligationsResponse.json()) as TaxApiResponse<TaxObligation>;

      const filingsData =
        (await filingsResponse.json()) as TaxApiResponse<TaxFiling>;

      if (!obligationsData.success) {
        throw new Error(
          obligationsData.message ||
            "Unable to load tax obligations."
        );
      }

      if (!filingsData.success) {
        throw new Error(
          filingsData.message ||
            "Unable to load tax filings."
        );
      }

      setObligations(
        obligationsData.obligations || []
      );

      const normalizedFilings = (
        filingsData.filings || []
      ).map((filing) => ({
        ...filing,
        obligation:
          filing.obligation ?? {
            id: filing.taxObligationCode,
            code: filing.taxObligationCode,
            taxType: "UNKNOWN",
            name:
              filing.taxObligationCode ||
              "Unknown tax obligation",
            registrationNumber: null,
            filingFrequency: "UNKNOWN",
            dueRule: null,
            currency: "KES",
            isActive: false,
          },
      }));

      setFilings(normalizedFilings);
    } catch (err) {
      console.error(
        "[TAX UI] Failed to load tax data:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tax information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadTaxData();
  }, []);

  const upcomingFilings = useMemo(() => {
    return filings.filter((filing) => {
      const status =
        filing.filingStatus.toUpperCase();

      return (
        status !== "SUBMITTED" &&
        status !== "APPROVED" &&
        status !== "PAID"
      );
    });
  }, [filings]);

  const submittedFilings = useMemo(() => {
    return filings.filter((filing) => {
      const status =
        filing.filingStatus.toUpperCase();

      return (
        status === "SUBMITTED" ||
        status === "APPROVED"
      );
    });
  }, [filings]);

  const outstandingTax = useMemo(() => {
    return filings
      .filter(
        (filing) =>
          filing.paymentStatus.toUpperCase() !==
          "PAID"
      )
      .reduce(
        (total, filing) =>
          total +
          getNumber(filing.totalPayable),
        0
      );
  }, [filings]);

  const overdueFilings = useMemo(() => {
    const now = new Date();

    return filings.filter((filing) => {
      const dueDate =
        new Date(filing.dueDate);

      return (
        dueDate < now &&
        filing.paymentStatus.toUpperCase() !==
          "PAID" &&
        filing.filingStatus.toUpperCase() !==
          "SUBMITTED"
      );
    });
  }, [filings]);

  const complianceStatus =
    overdueFilings.length > 0
      ? "Attention Required"
      : "Good";

  const handleCreateFiling = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.taxObligationCode) {
      setError(
        "Select a tax obligation before creating the filing."
      );
      return;
    }

    if (
      !form.taxPeriodStart ||
      !form.taxPeriodEnd ||
      !form.dueDate
    ) {
      setError(
        "Tax period and due date are required."
      );
      return;
    }

    if (!form.notes.trim()) {
      setError(
        "Notes are required. Add supporting details for this tax filing."
      );
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response =
        await authenticatedFetch(
          "/api/tax/filings",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              taxObligationCode:
                form.taxObligationCode,

              taxPeriodStart:
                form.taxPeriodStart,

              taxPeriodEnd:
                form.taxPeriodEnd,

              dueDate:
                form.dueDate,

              taxableAmount: Number(
                form.taxableAmount || 0
              ),

              taxAmount: Number(
                form.taxAmount || 0
              ),

              adjustments: Number(
                form.adjustments || 0
              ),

              penalties: Number(
                form.penalties || 0
              ),

              interest: Number(
                form.interest || 0
              ),

              filingReference:
                form.filingReference || null,

              notes:
                form.notes.trim(),
            }),
          }
        );
      const data =
        (await response.json()) as TaxApiResponse<TaxFiling>;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Failed to create tax filing."
        );
      }

      setShowCreateForm(false);

      setForm({
        taxObligationCode: "",
        taxPeriodStart: "",
        taxPeriodEnd: "",
        dueDate: "",
        taxableAmount: "",
        taxAmount: "",
        adjustments: "0",
        penalties: "0",
        interest: "0",
        filingReference: "",
        notes: "",
      });

      await loadTaxData(true);
    } catch (err) {
      console.error(
        "[TAX UI] Failed to create filing:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create tax filing."
      );
    } finally {
      setCreating(false);
    }
  };

  const openPaymentForm = (
    filing: TaxFiling
  ) => {
    setSelectedFiling(filing);
    setPaymentAmount("");
    setPaymentDate(
      new Date()
        .toISOString()
        .slice(0, 10)
    );
    setPaymentMethod("BANK");
    setPaymentReference("");
    setPaymentNotes("");
    setError("");
    setShowPaymentForm(true);
  };

  const closePaymentForm = () => {
    if (paymentSubmitting) {
      return;
    }

    setShowPaymentForm(false);
    setSelectedFiling(null);
    setPaymentAmount("");
    setPaymentDate("");
    setPaymentMethod("BANK");
    setPaymentReference("");
    setPaymentNotes("");
  };

  const handleRecordPayment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedFiling) {
      return;
    }

    const amount = Number(
      paymentAmount
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Enter a valid payment amount."
      );
      return;
    }

    if (!paymentDate) {
      setError(
        "Payment date is required."
      );
      return;
    }

    if (!paymentMethod) {
      setError(
        "Payment method is required."
      );
      return;
    }

    if (!paymentNotes.trim()) {
      setError(
        "Notes are required. Add supporting details for this payment."
      );
      return;
    }

    try {
      setPaymentSubmitting(true);
      setError("");

      const response =
        await authenticatedFetch(
          "/api/tax/payments",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              taxFilingId:
                selectedFiling.id,

              amount,

              paymentDate,

              paymentMethod,

              paymentReference:
                paymentReference.trim() ||
                null,

              notes:
                paymentNotes.trim(),
            }),
          }
        );
      const data =
        (await response.json()) as TaxApiResponse<TaxPayment>;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Failed to record tax payment."
        );
      }

      closePaymentForm();

      await loadTaxData(true);
    } catch (err) {
      console.error(
        "[TAX UI] Failed to record payment:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to record tax payment."
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0D9488]">
            Tax & Compliance
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[#20243A] sm:text-4xl">
            Tax Management
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666B84] sm:text-base">
            Manage tax obligations, filings, payments and compliance from one workspace.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <button
            type="button"
            onClick={() =>
              void loadTaxData(true)
            }
            disabled={refreshing}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#E2E5EC] bg-white px-4 text-sm font-semibold text-[#4F556B] shadow-sm transition hover:border-[#CDD2DC] hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={() =>
              setShowCreateForm(true)
            }
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F766E] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/15 sm:flex-none"
          >
            <Plus size={18} />

            New Tax Filing
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <TriangleAlert
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-medium">
              Tax Management Error
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-[#666B84]">
              Upcoming Filings
            </p>

            <Clock3
              size={20}
              className="text-yellow-600"
            />
          </div>

          <h2 className="mt-3 text-4xl font-bold leading-none tabular-nums tracking-tight text-[#20243A]">
            {loading
              ? "-"
              : upcomingFilings.length}
          </h2>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-[#666B84]">
              Submitted Returns
            </p>

            <CheckCircle2
              size={20}
              className="text-green-600"
            />
          </div>

          <h2 className="mt-3 text-4xl font-bold leading-none tabular-nums tracking-tight text-[#20243A]">
            {loading
              ? "-"
              : submittedFilings.length}
          </h2>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-[#666B84]">
              Outstanding Tax
            </p>

            <FileText
              size={20}
              className="text-red-600"
            />
          </div>

          <h2 className="mt-3 truncate text-2xl font-bold leading-none tabular-nums tracking-tight text-[#20243A] sm:text-3xl">
            {loading
              ? "-"
              : formatCurrency(
                  outstandingTax
                )}
          </h2>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-[#666B84]">
              Compliance Status
            </p>

            {complianceStatus ===
            "Good" ? (
              <CheckCircle2
                size={20}
                className="text-green-600"
              />
            ) : (
              <TriangleAlert
                size={20}
                className="text-red-600"
              />
            )}
          </div>

          <h2
            className={`mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl ${
              complianceStatus ===
              "Good"
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {loading
              ? "-"
              : complianceStatus}
          </h2>
        </div>

      </div>

      {/* Tax Obligations */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">

        <div className="border-b border-[#ECECF3] px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#20243A]">
                Tax Obligations
              </h2>

              <p className="mt-1 text-sm text-[#666B84]">
                Tax obligations configured for this organization.
              </p>
            </div>

            <span className="rounded-full bg-[#F5F5F8] px-3 py-1 text-sm text-[#666B84]">
              {obligations.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[#666B84]">
            Loading tax obligations...
          </div>
        ) : obligations.length === 0 ? (
          <div className="p-8 text-center">
            <FileText
              size={32}
              className="mx-auto text-[#999DB0]"
            />

            <p className="mt-3 font-medium text-[#20243A]">
              No tax obligations configured
            </p>

            <p className="mt-1 text-sm text-[#666B84]">
              Tax obligations such as VAT,
              PAYE and withholding tax will
              appear here once configured.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#FAFAFC] text-[#666B84]">
                <tr>
                  <th className="p-4 text-left text-sm font-medium">
                    Tax Type
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Obligation
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Filing Frequency
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Registration
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {obligations.map(
                  (obligation) => (
                    <tr
                      key={obligation.code}
                      className="border-t border-[#ECECF3]"
                    >
                      <td className="p-4 font-medium text-[#20243A]">
                        {obligation.taxType}
                      </td>

                      <td className="p-4 text-[#666B84]">
                        {obligation.name}
                      </td>

                      <td className="p-4 text-[#666B84]">
                        {obligation.filingFrequency}
                      </td>

                      <td className="p-4 text-[#666B84]">
                        {obligation.registrationNumber ||
                          "-"}
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-sm ${
                            obligation.isActive
                              ? "bg-green-500/10 text-green-700"
                              : "bg-gray-500/10 text-gray-600"
                          }`}
                        >
                          {obligation.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tax Filings */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">

        <div className="border-b border-[#ECECF3] px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#20243A]">
                Tax Filings
              </h2>

              <p className="mt-1 text-sm text-[#666B84]">
                Tax returns and obligations requiring
                action.
              </p>
            </div>

            <span className="rounded-full bg-[#F5F5F8] px-3 py-1 text-sm text-[#666B84]">
              {filings.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[#666B84]">
            Loading tax filings...
          </div>
        ) : filings.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarDays
              size={34}
              className="mx-auto text-[#999DB0]"
            />

            <p className="mt-3 font-medium text-[#20243A]">
              No tax filings yet
            </p>

            <p className="mt-1 text-sm text-[#666B84]">
              Create your first tax filing using
              the button above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#FAFAFC] text-[#666B84]">
                <tr>
                  <th className="p-4 text-left text-sm font-medium">
                    Tax Type
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Period
                  </th>

                  <th className="p-4 text-right text-sm font-medium">
                    Tax Amount
                  </th>

                  <th className="p-4 text-right text-sm font-medium">
                    Total Payable
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Due Date
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Filing
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Payment
                  </th>

                  <th className="p-4 text-left text-sm font-medium">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filings.map(
                  (filing) => (
                    <tr
                      key={filing.id}
                      className="border-t border-[#ECECF3] hover:bg-[#FAFAFC]"
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-[#20243A]">
                            {filing.obligation?.name ??
                              filing.taxObligationCode}
                          </p>

                          <p className="mt-1 text-xs text-[#666B84]">
                            {
                              filing.obligation?.taxType ??
                              "Unknown"
                            }
                          </p>
                        </div>
                      </td>

                      <td className="p-4 text-[#666B84]">
                        {formatPeriod(
                          filing.taxPeriodStart,
                          filing.taxPeriodEnd
                        )}
                      </td>

                      <td className="p-4 text-right text-[#20243A]">
                        {formatCurrency(
                          filing.taxAmount,
                          filing.obligation?.currency ??
                          "KES"
                        )}
                      </td>

                      <td className="p-4 text-right font-medium text-[#20243A]">
                        {formatCurrency(
                          filing.totalPayable,
                          filing.obligation?.currency ??
                          "KES"
                        )}
                      </td>

                      <td className="p-4 text-[#666B84]">
                        {formatDate(
                          filing.dueDate
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-sm ${statusClasses(
                            filing.filingStatus
                          )}`}
                        >
                          {filing.filingStatus}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-sm ${statusClasses(
                            filing.paymentStatus
                          )}`}
                        >
                          {filing.paymentStatus}
                        </span>
                      </td>

                      <td className="p-4">
                        {filing.paymentStatus.toUpperCase() !==
                        "PAID" ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPaymentForm(
                                filing
                              )
                            }
                            className="whitespace-nowrap rounded-lg bg-[#0D9488] px-3 py-2 text-sm font-medium text-white hover:bg-[#0F766E]"
                          >
                            Record Payment
                          </button>
                        ) : (
                          <span className="text-sm text-[#666B84]">
                            Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Tax Filing Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#111827]/65 p-3 sm:p-5 lg:p-8">
          <div className="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E7E9F0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:max-h-[calc(100vh-2.5rem)] lg:max-h-[calc(100vh-4rem)]">

            <div className="flex shrink-0 items-start justify-between gap-6 border-b border-[#ECECF3] px-5 py-5 sm:px-7 sm:py-6">
              <div>
                <h2 className="text-xl font-semibold text-[#20243A]">
                  New Tax Filing
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Create a tax filing for the organization.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreateForm(false)
                }
                className="text-2xl text-[#666B84] hover:text-[#20243A]"
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={handleCreateFiling}
              className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-7"
            >
              {/* Tax Obligation */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#20243A]">
                  Tax Obligation
                </label>

                <select
                  value={
                    form.taxObligationCode
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        taxObligationCode:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  required
                >
                  <option value="">
                    Select tax obligation
                  </option>

                  {obligations
                    .filter(
                      (obligation) =>
                        obligation.isActive
                    )
                    .map(
                      (obligation) => (
                        <option
                          key={
                            obligation.code
                          }
                          value={
                            obligation.code
                          }
                        >
                          {obligation.name} (
                          {
                            obligation.taxType
                          }
                          )
                        </option>
                      )
                    )}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Period Start
                  </label>

                  <input
                    type="date"
                    value={
                      form.taxPeriodStart
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          taxPeriodStart:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Period End
                  </label>

                  <input
                    type="date"
                    value={
                      form.taxPeriodEnd
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          taxPeriodEnd:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Due Date
                  </label>

                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          dueDate:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                    required
                  />
                </div>

              </div>

              {/* Amounts */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Taxable Amount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.taxableAmount
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          taxableAmount:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Tax Amount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.taxAmount
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          taxAmount:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Adjustments
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.adjustments
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          adjustments:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Penalties
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.penalties
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          penalties:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Interest
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.interest
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          interest:
                            event.target.value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Filing Reference
                  </label>

                  <input
                    type="text"
                    value={
                      form.filingReference
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          filingReference:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Optional"
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </div>

              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#20243A]">
                  Notes <span className="text-[#0D9488]">*</span>
                </label>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      })
                    )
                  }
                  rows={3}
                  placeholder="Enter supporting notes for this tax filing..."
                  className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setShowCreateForm(false)
                  }
                  className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-[#20243A] hover:bg-[#F8F8FB]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating
                    ? "Creating..."
                    : "Create Filing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentForm &&
        selectedFiling && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#111827]/65 p-3 sm:p-5 lg:p-8">
            <div className="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E7E9F0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:max-h-[calc(100vh-2.5rem)] lg:max-h-[calc(100vh-4rem)]">

              <div className="flex shrink-0 items-start justify-between gap-6 border-b border-[#ECECF3] px-5 py-5 sm:px-7 sm:py-6">
                <div>
                  <h2 className="text-xl font-semibold text-[#20243A]">
                    Record Tax Payment
                  </h2>

                  <p className="mt-1 text-sm text-[#666B84]">
                    {selectedFiling.obligation?.name ??
                      selectedFiling.taxObligationCode}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePaymentForm}
                  disabled={
                    paymentSubmitting
                  }
                  className="text-2xl text-[#666B84] hover:text-[#20243A] disabled:opacity-50"
                >
                  <X size={22} />
                </button>
              </div>

              <form
                onSubmit={
                  handleRecordPayment
                }
                className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7"
              >

                <div className="rounded-xl bg-[#F8F8FB] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#666B84]">
                      Total Payable
                    </span>

                    <span className="font-semibold text-[#20243A]">
                      {formatCurrency(
                        selectedFiling.totalPayable,
                        selectedFiling
                          .obligation?.currency ??
                        "KES"
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Payment Amount
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      paymentAmount
                    }
                    onChange={(event) =>
                      setPaymentAmount(
                        event.target.value
                      )
                    }
                    placeholder="Enter amount"
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Payment Date
                  </label>

                  <input
                    type="date"
                    value={
                      paymentDate
                    }
                    onChange={(event) =>
                      setPaymentDate(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Payment Method
                  </label>

                  <select
                    value={
                      paymentMethod
                    }
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  >
                    <option value="BANK">
                      Bank
                    </option>

                    <option value="MPESA">
                      M-Pesa
                    </option>

                    <option value="CASH">
                      Cash
                    </option>

                    <option value="OTHER">
                      Other
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Payment Reference
                  </label>

                  <input
                    type="text"
                    value={
                      paymentReference
                    }
                    onChange={(event) =>
                      setPaymentReference(
                        event.target.value
                      )
                    }
                    placeholder="Optional payment reference"
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#20243A]">
                    Notes <span className="text-[#0D9488]">*</span>
                  </label>

                  <textarea
                    value={
                      paymentNotes
                    }
                    onChange={(event) =>
                      setPaymentNotes(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Enter supporting notes for this payment..."
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                  <button
                    type="button"
                    onClick={
                      closePaymentForm
                    }
                    disabled={
                      paymentSubmitting
                    }
                    className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-[#20243A] hover:bg-[#F8F8FB] disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      paymentSubmitting
                    }
                    className="rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {paymentSubmitting
                      ? "Recording..."
                      : "Record Payment"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

    </div>
  );
}