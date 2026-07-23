import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
  ReactNode,
} from "react";

import {
  approvePayable,
  createPayable,
  deletePayable,
  fetchPayables,
  recordPayablePayment,
} from "../services/accountsPayable";

import type {
  Payable,
} from "../services/accountsPayable";

/* =========================================================
   TYPES
========================================================= */

interface Vendor {
  id: string;
  vendorCode?: string;
  name: string;
  status?: string;
}

interface VendorsResponse {
  success?: boolean;
  message?: string;
  vendors?: Vendor[];
}

interface BillForm {
  vendorId: string;
  invoiceNumber: string;
  description: string;
  amount: string;
  dueDate: string;
}

/* =========================================================
   CONSTANTS
========================================================= */

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
});

const initialBillForm: BillForm = {
  vendorId: "",
  invoiceNumber: "",
  description: "",
  amount: "",
  dueDate: "",
};

/* =========================================================
   HELPERS
========================================================= */

const formatCurrency = (value: number) => {
  const amount = Number(value);

  return currencyFormatter.format(
    Number.isFinite(amount) ? amount : 0
  );
};

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-KE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const getAuthToken = (): string | null => {
  return (
    localStorage.getItem("token") ??
    sessionStorage.getItem("token")
  );
};

const getEffectiveStatus = (payable: Payable) => {
  const paymentStatus =
    payable.paymentStatus?.toUpperCase() ?? "";

  const approvalStatus =
    payable.status?.toUpperCase() ?? "";

  const amount =
    Number(payable.amount) || 0;

  const outstanding =
    Number(payable.outstandingBalance) || 0;

  if (
    paymentStatus === "PAID" ||
    outstanding <= 0
  ) {
    return "PAID";
  }

  if (
    outstanding > 0 &&
    amount > 0 &&
    outstanding < amount
  ) {
    return "PARTIALLY PAID";
  }

  const dueDate =
    new Date(payable.dueDate);

  if (
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() < Date.now() &&
    outstanding > 0
  ) {
    return "OVERDUE";
  }

  if (approvalStatus === "APPROVED") {
    return "APPROVED";
  }

  if (
    approvalStatus === "PENDING" ||
    approvalStatus === "PENDING_APPROVAL"
  ) {
    return "PENDING APPROVAL";
  }

  return approvalStatus || "DRAFT";
};

const getStatusClasses = (
  status: string
) => {
  switch (status) {
    case "PAID":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";

    case "APPROVED":
      return "border-blue-500/20 bg-blue-500/10 text-blue-400";

    case "PARTIALLY PAID":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-400";

    case "OVERDUE":
      return "border-red-500/20 bg-red-500/10 text-red-400";

    case "PENDING APPROVAL":
      return "border-amber-500/20 bg-amber-500/10 text-amber-400";

    default:
      return "border-slate-600 bg-slate-700/30 text-slate-300";
  }
};

/* =========================================================
   COMPONENT
========================================================= */

export default function AccountsPayable() {
  const [payables, setPayables] =
    useState<Payable[]>([]);

  const [vendors, setVendors] =
    useState<Vendor[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  const [
    showNewBill,
    setShowNewBill,
  ] = useState(false);

  const [
    selectedBill,
    setSelectedBill,
  ] = useState<Payable | null>(null);

  const [
    showPaymentForm,
    setShowPaymentForm,
  ] = useState(false);

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [form, setForm] =
    useState<BillForm>(
      initialBillForm
    );

  /* =========================================================
     LOAD PAYABLES
  ========================================================= */

  const loadPayables =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const result =
          await fetchPayables();

        setPayables(
          Array.isArray(result.payables)
            ? result.payables
            : []
        );
      } catch (requestError) {
        console.error(
          "LOAD PAYABLES ERROR:",
          requestError
        );

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load supplier bills."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  /* =========================================================
     LOAD VENDORS
  ========================================================= */

  const loadVendors =
    useCallback(async () => {
      try {
        const token =
          getAuthToken();

        const response =
          await fetch(
            "/api/vendors",
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json",

                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
              },
            }
          );

        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as VendorsResponse | null;

        if (
          !response.ok ||
          result?.success === false
        ) {
          throw new Error(
            result?.message ||
              "Failed to load vendors."
          );
        }

        setVendors(
          Array.isArray(
            result?.vendors
          )
            ? result.vendors
            : []
        );
      } catch (requestError) {
        console.error(
          "LOAD VENDORS ERROR:",
          requestError
        );

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load vendors."
        );
      }
    }, []);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    void loadPayables();
    void loadVendors();
  }, [
    loadPayables,
    loadVendors,
  ]);

  /* =========================================================
     CREATE BILL
  ========================================================= */

  const handleCreateBill = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const amount =
      Number(form.amount);

    if (!form.vendorId) {
      setError(
        "Please select a vendor."
      );
      return;
    }

    if (
      !form.invoiceNumber.trim()
    ) {
      setError(
        "Please enter the supplier invoice number."
      );
      return;
    }

    if (
      !form.description.trim()
    ) {
      setError(
        "Please enter a bill description."
      );
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Bill amount must be greater than zero."
      );
      return;
    }

    if (!form.dueDate) {
      setError(
        "Please select a due date."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const result =
        await createPayable({
          vendorId:
            form.vendorId,

          invoiceNumber:
            form.invoiceNumber,

          description:
            form.description,

          amount,

          dueDate:
            form.dueDate,
        });

      setShowNewBill(false);

      setForm(
        initialBillForm
      );

      setSuccessMessage(
        result.message ||
          `Bill ${form.invoiceNumber.trim()} created successfully.`
      );

      await loadPayables();
    } catch (requestError) {
      console.error(
        "CREATE BILL ERROR:",
        requestError
      );

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create supplier bill."
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     APPROVE BILL
  ========================================================= */

  const handleApprove = async () => {
    if (!selectedBill) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const result =
        await approvePayable(
          selectedBill.id
        );

      setSelectedBill(
        result.payable
      );

      setSuccessMessage(
        result.message ||
          "Supplier bill approved successfully."
      );

      await loadPayables();
    } catch (requestError) {
      console.error(
        "APPROVE PAYABLE ERROR:",
        requestError
      );

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to approve supplier bill."
      );
    } finally {
      setActionLoading(false);
    }
  };

  /* =========================================================
     RECORD PAYMENT
  ========================================================= */

  const handlePayment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedBill) {
      return;
    }

    const amount =
      Number(paymentAmount);

    const outstanding =
      Number(
        selectedBill.outstandingBalance
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Payment amount must be greater than zero."
      );
      return;
    }

    if (
      Number.isFinite(outstanding) &&
      amount > outstanding
    ) {
      setError(
        "Payment amount cannot exceed the outstanding balance."
      );
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const result =
        await recordPayablePayment(
          selectedBill.id,
          amount
        );

      setSelectedBill(
        result.payable
      );

      setPaymentAmount("");
      setShowPaymentForm(false);

      setSuccessMessage(
        result.message ||
          "Supplier payment recorded successfully."
      );

      await loadPayables();
    } catch (requestError) {
      console.error(
        "PAYMENT ERROR:",
        requestError
      );

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to record supplier payment."
      );
    } finally {
      setActionLoading(false);
    }
  };

  /* =========================================================
     DELETE BILL
  ========================================================= */

  const handleDelete = async () => {
    if (!selectedBill) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete supplier bill ${selectedBill.invoiceNumber}? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const result =
        await deletePayable(
          selectedBill.id
        );

      setSelectedBill(null);

      setSuccessMessage(
        result.message ||
          "Supplier bill deleted successfully."
      );

      await loadPayables();
    } catch (requestError) {
      console.error(
        "DELETE PAYABLE ERROR:",
        requestError
      );

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete supplier bill."
      );
    } finally {
      setActionLoading(false);
    }
  };

  /* =========================================================
     SEARCH & FILTER
  ========================================================= */

  const filteredPayables =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return payables.filter(
        (payable) => {
          const status =
            getEffectiveStatus(
              payable
            );

          const matchesStatus =
            statusFilter ===
              "ALL" ||
            status ===
              statusFilter;

          const vendorName =
            payable.vendor
              ?.name
              ?.toLowerCase() ??
            "";

          const vendorCode =
            payable.vendor
              ?.vendorCode
              ?.toLowerCase() ??
            "";

          const invoiceNumber =
            payable.invoiceNumber
              ?.toLowerCase() ??
            "";

          const description =
            payable.description
              ?.toLowerCase() ??
            "";

          const paymentStatus =
            payable.paymentStatus
              ?.toLowerCase() ??
            "";

          const matchesSearch =
            !query ||
            vendorName.includes(
              query
            ) ||
            vendorCode.includes(
              query
            ) ||
            invoiceNumber.includes(
              query
            ) ||
            description.includes(
              query
            ) ||
            paymentStatus.includes(
              query
            ) ||
            status
              .toLowerCase()
              .includes(query);

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      payables,
      search,
      statusFilter,
    ]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary =
    useMemo(() => {
      return payables.reduce(
        (totals, payable) => {
          const status =
            getEffectiveStatus(
              payable
            );

          const outstanding =
            Number(
              payable.outstandingBalance
            ) || 0;

          totals.totalOutstanding +=
            outstanding;

          if (
            status === "OVERDUE"
          ) {
            totals.overdue +=
              outstanding;

            totals.overdueBills +=
              1;
          }

          if (
            status ===
            "PENDING APPROVAL"
          ) {
            totals.pendingApproval +=
              1;
          }

          if (
            status === "PAID"
          ) {
            totals.paidBills +=
              1;
          }

          return totals;
        },
        {
          totalOutstanding: 0,
          overdue: 0,
          overdueBills: 0,
          pendingApproval: 0,
          paidBills: 0,
        }
      );
    }, [payables]);

  const selectedStatus =
    selectedBill
      ? getEffectiveStatus(
          selectedBill
        )
      : "";

  const canApprove =
    selectedBill !== null &&
    selectedBill.status
      ?.toUpperCase() !==
      "APPROVED" &&
    selectedStatus !==
      "PAID";

  const canPay =
    selectedBill !== null &&
    selectedBill.status
      ?.toUpperCase() ===
      "APPROVED" &&
    Number(
      selectedBill.outstandingBalance
    ) > 0;

  const canDelete =
    selectedBill !== null &&
    selectedBill.status
      ?.toUpperCase() !==
      "APPROVED" &&
    Math.abs(
      Number(
        selectedBill.outstandingBalance
      ) -
        Number(
          selectedBill.amount
        )
    ) < 0.01;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Accounts Payable
          </h1>

          <p className="mt-2 text-slate-400">
            Manage supplier bills,
            approvals, outstanding
            obligations and outgoing
            payments.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              void loadPayables()
            }
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccessMessage("");
              setForm(
                initialBillForm
              );
              setShowNewBill(
                true
              );
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            New Bill
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div className="flex-1">
            <p className="font-medium">
              Accounts Payable
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* SUCCESS */}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
          <CheckCircle2
            size={20}
          />

          <span className="flex-1 text-sm font-medium">
            {successMessage}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage("")
            }
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Outstanding Payables"
          value={formatCurrency(
            summary.totalOutstanding
          )}
          subtitle={`${payables.length} supplier bills`}
          icon={
            <WalletCards
              size={21}
            />
          }
        />

        <SummaryCard
          title="Overdue"
          value={formatCurrency(
            summary.overdue
          )}
          subtitle={`${summary.overdueBills} overdue bills`}
          icon={
            <AlertCircle
              size={21}
            />
          }
        />

        <SummaryCard
          title="Pending Approval"
          value={String(
            summary.pendingApproval
          )}
          subtitle="Bills requiring review"
          icon={
            <Clock3 size={21} />
          }
        />

        <SummaryCard
          title="Paid Bills"
          value={String(
            summary.paidBills
          )}
          subtitle="Completed supplier bills"
          icon={
            <CheckCircle2
              size={21}
            />
          }
        />
      </div>

      {/* SEARCH */}

      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-slate-800 bg-slate-900 px-4 focus-within:border-blue-500/50">
            <Search
              size={18}
              className="text-slate-500"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search vendor, invoice, description or status..."
              className="flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3">
            <Filter
              size={17}
              className="text-slate-500"
            />

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="min-w-[190px] bg-slate-900 py-3 text-sm text-white outline-none"
            >
              <option value="ALL">
                All Statuses
              </option>

              <option value="PENDING APPROVAL">
                Pending Approval
              </option>

              <option value="APPROVED">
                Approved
              </option>

              <option value="PARTIALLY PAID">
                Partially Paid
              </option>

              <option value="PAID">
                Paid
              </option>

              <option value="OVERDUE">
                Overdue
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-slate-900/80">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">
                  Vendor
                </th>

                <th className="px-5 py-4">
                  Invoice
                </th>

                <th className="px-5 py-4">
                  Due Date
                </th>

                <th className="px-5 py-4 text-right">
                  Amount
                </th>

                <th className="px-5 py-4 text-right">
                  Outstanding
                </th>

                <th className="px-5 py-4">
                  Status
                </th>

                <th className="px-5 py-4 text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center"
                  >
                    <Loader2
                      size={28}
                      className="mx-auto animate-spin text-blue-500"
                    />

                    <p className="mt-3 text-sm text-slate-400">
                      Loading supplier
                      bills...
                    </p>
                  </td>
                </tr>
              ) : filteredPayables.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center"
                  >
                    <FileText
                      size={38}
                      className="mx-auto text-slate-600"
                    />

                    <p className="mt-4 font-medium text-white">
                      No supplier bills
                      found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Create a new bill
                      or adjust your
                      search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPayables.map(
                  (payable) => {
                    const status =
                      getEffectiveStatus(
                        payable
                      );

                    return (
                      <tr
                        key={
                          payable.id
                        }
                        className="border-t border-slate-800 transition hover:bg-slate-900/60"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-white">
                            {payable
                              .vendor
                              ?.name ??
                              "Unknown Vendor"}
                          </p>

                          {payable
                            .vendor
                            ?.vendorCode && (
                            <p className="mt-1 text-xs text-slate-500">
                              {
                                payable
                                  .vendor
                                  .vendorCode
                              }
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-blue-400">
                            {
                              payable.invoiceNumber
                            }
                          </p>

                          <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                            {
                              payable.description
                            }
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-300">
                          {formatDate(
                            payable.dueDate
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-medium text-white">
                          {formatCurrency(
                            payable.amount
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-white">
                          {formatCurrency(
                            payable.outstandingBalance
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBill(
                                payable
                              );

                              setShowPaymentForm(
                                false
                              );

                              setPaymentAmount(
                                ""
                              );
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                          >
                            <Eye
                              size={15}
                            />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          filteredPayables.length >
            0 && (
            <div className="border-t border-slate-800 px-5 py-4 text-sm text-slate-500">
              Showing{" "}
              {
                filteredPayables.length
              }{" "}
              of {payables.length}{" "}
              bills
            </div>
          )}
      </div>

      {/* NEW BILL MODAL */}

      {showNewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#111827] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  New Supplier Bill
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Record a new
                  accounts payable
                  obligation.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (!saving) {
                    setShowNewBill(
                      false
                    );

                    setForm(
                      initialBillForm
                    );
                  }
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                handleCreateBill
              }
            >
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <FormField
                  label="Vendor"
                  required
                >
                  <select
                    value={
                      form.vendorId
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          vendorId:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select vendor
                    </option>

                    {vendors
                      .filter(
                        (vendor) =>
                          !vendor.status ||
                          vendor.status ===
                            "ACTIVE"
                      )
                      .map(
                        (vendor) => (
                          <option
                            key={
                              vendor.id
                            }
                            value={
                              vendor.id
                            }
                          >
                            {
                              vendor.name
                            }
                          </option>
                        )
                      )}
                  </select>
                </FormField>

                <FormField
                  label="Invoice Number"
                  required
                >
                  <input
                    type="text"
                    required
                    value={
                      form.invoiceNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          invoiceNumber:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="e.g. INV-2026-001"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                  />
                </FormField>

                <FormField
                  label="Amount (KES)"
                  required
                >
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={
                      form.amount
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          amount:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                  />
                </FormField>

                <FormField
                  label="Due Date"
                  required
                >
                  <input
                    type="date"
                    required
                    value={
                      form.dueDate
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          dueDate:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField
                    label="Description"
                    required
                  >
                    <textarea
                      rows={4}
                      required
                      value={
                        form.description
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            description:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="Describe the goods, service or supplier obligation..."
                      className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setShowNewBill(
                      false
                    );

                    setForm(
                      initialBillForm
                    );
                  }}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus
                      size={17}
                    />
                  )}

                  {saving
                    ? "Creating..."
                    : "Create Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BILL DETAILS */}

      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#111827] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                  Supplier Bill
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                  {
                    selectedBill.invoiceNumber
                  }
                </h2>
              </div>

              <button
                type="button"
                disabled={
                  actionLoading
                }
                onClick={() => {
                  setSelectedBill(
                    null
                  );

                  setShowPaymentForm(
                    false
                  );

                  setPaymentAmount(
                    ""
                  );
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <Detail
                label="Vendor"
                value={
                  selectedBill.vendor
                    ?.name ??
                  "Unknown Vendor"
                }
              />

              <Detail
                label="Status"
                value={
                  selectedStatus
                }
              />

              <Detail
                label="Bill Amount"
                value={formatCurrency(
                  selectedBill.amount
                )}
              />

              <Detail
                label="Outstanding"
                value={formatCurrency(
                  selectedBill.outstandingBalance
                )}
              />

              <Detail
                label="Due Date"
                value={formatDate(
                  selectedBill.dueDate
                )}
              />

              <Detail
                label="Payment Status"
                value={
                  selectedBill.paymentStatus ||
                  "UNPAID"
                }
              />

              <div className="sm:col-span-2">
                <Detail
                  label="Description"
                  value={
                    selectedBill.description ||
                    "-"
                  }
                />
              </div>
            </div>

            {/* PAYMENT FORM */}

            {showPaymentForm &&
              canPay && (
                <form
                  onSubmit={
                    handlePayment
                  }
                  className="border-t border-slate-800 px-6 py-5"
                >
                  <h3 className="font-semibold text-white">
                    Record Supplier
                    Payment
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Outstanding:{" "}
                    {formatCurrency(
                      selectedBill.outstandingBalance
                    )}
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={
                        selectedBill.outstandingBalance
                      }
                      required
                      value={
                        paymentAmount
                      }
                      onChange={(
                        event
                      ) =>
                        setPaymentAmount(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Payment amount"
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                    />

                    <button
                      type="submit"
                      disabled={
                        actionLoading
                      }
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <CreditCard
                          size={17}
                        />
                      )}

                      Record Payment
                    </button>
                  </div>
                </form>
              )}

            {/* ACTIONS */}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleDelete()
                    }
                    disabled={
                      actionLoading
                    }
                    className="flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2
                      size={17}
                    />
                    Delete
                  </button>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                {canApprove && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleApprove()
                    }
                    disabled={
                      actionLoading
                    }
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2
                        size={17}
                      />
                    )}

                    Approve Bill
                  </button>
                )}

                {canPay && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowPaymentForm(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                    disabled={
                      actionLoading
                    }
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CreditCard
                      size={17}
                    />

                    {showPaymentForm
                      ? "Cancel Payment"
                      : "Record Payment"}
                  </button>
                )}

                <button
                  type="button"
                  disabled={
                    actionLoading
                  }
                  onClick={() =>
                    setSelectedBill(
                      null
                    )
                  }
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">
            {title}
          </p>

          <p className="mt-3 text-2xl font-bold text-white">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-blue-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}

        {required && (
          <span className="ml-1 text-red-400">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   DETAIL
========================================================= */

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-medium text-white">
        {value}
      </p>
    </div>
  );
}