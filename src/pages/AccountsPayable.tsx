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
import { authenticatedFetch, getAuthToken } from "../lib/auth";

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

const getErrorMessage = (
  error: unknown,
  fallback: string
) => {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
};

const getEffectiveStatus = (
  payable: Payable
) => {
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
      return "border-[#20243A]/20 bg-[#0D9488]/10 text-[#20243A]";

    case "PARTIALLY PAID":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-400";

    case "OVERDUE":
      return "border-red-500/20 bg-red-500/10 text-red-400";

    case "PENDING APPROVAL":
      return "border-amber-500/20 bg-amber-500/10 text-amber-400";

    default:
      return "border-[#ECECF3] bg-[#ECECF3]/30 text-[#666B84]";
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

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

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

  /* =======================================================
     LOAD PAYABLES
  ======================================================= */

  const loadPayables =
    useCallback(async () => {
      try {
        setError("");

        const response =
          await fetchPayables();

        setPayables(
          Array.isArray(
            response.payables
          )
            ? response.payables
            : []
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Failed to load accounts payable."
          )
        );
      }
    }, []);

  /* =======================================================
     LOAD VENDORS
  ======================================================= */

  const loadVendors =
    useCallback(async () => {
      try {
        const token =
          getAuthToken();

        const response =
          await authenticatedFetch(
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

        const data: unknown =
          await response
            .json()
            .catch(() => null);

        if (!response.ok) {
          let message =
            `Failed to load vendors (${response.status})`;

          if (
            data &&
            typeof data ===
              "object" &&
            "message" in data &&
            typeof data.message ===
              "string"
          ) {
            message =
              data.message;
          }

          throw new Error(
            message
          );
        }

        const vendorResponse =
          data as VendorsResponse;

        const activeVendors =
          (
            vendorResponse.vendors ??
            []
          ).filter(
            (vendor) =>
              !vendor.status ||
              vendor.status.toUpperCase() ===
                "ACTIVE"
          );

        setVendors(
          activeVendors
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Failed to load vendors."
          )
        );
      }
    }, []);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  const loadPage =
    useCallback(async () => {
      setLoading(true);

      await Promise.all([
        loadPayables(),
        loadVendors(),
      ]);

      setLoading(false);
    }, [
      loadPayables,
      loadVendors,
    ]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  /* =======================================================
     FILTERING
  ======================================================= */

  const filteredPayables =
    useMemo(() => {
      const term =
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

          const searchableText =
            [
              payable.invoiceNumber,
              payable.description,
              payable.vendor?.name,
              payable.vendor
                ?.vendorCode,
              payable.paymentStatus,
              payable.status,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          const matchesSearch =
            !term ||
            searchableText.includes(
              term
            );

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

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      const total =
        payables.reduce(
          (sum, payable) =>
            sum +
            (Number(
              payable.amount
            ) || 0),
          0
        );

      const outstanding =
        payables.reduce(
          (sum, payable) =>
            sum +
            (Number(
              payable.outstandingBalance
            ) || 0),
          0
        );

      const overdue =
        payables
          .filter(
            (payable) =>
              getEffectiveStatus(
                payable
              ) === "OVERDUE"
          )
          .reduce(
            (sum, payable) =>
              sum +
              (Number(
                payable.outstandingBalance
              ) || 0),
            0
          );

      const pending =
        payables.filter(
          (payable) =>
            getEffectiveStatus(
              payable
            ) ===
            "PENDING APPROVAL"
        ).length;

      return {
        total,
        outstanding,
        overdue,
        pending,
      };
    }, [payables]);

  /* =======================================================
     CREATE BILL
  ======================================================= */

  const handleCreateBill =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      setError("");
      setSuccessMessage("");

      const amount =
        Number(form.amount);

      if (
        !form.vendorId.trim()
      ) {
        setError(
          "Please select a vendor."
        );
        return;
      }

      if (
        !form.invoiceNumber.trim()
      ) {
        setError(
          "Invoice number is required."
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

      if (
        !form.dueDate
      ) {
        setError(
          "Due date is required."
        );
        return;
      }

      if (
        !form.description.trim()
      ) {
        setError(
          "Description is required."
        );
        return;
      }

      try {
        setSaving(true);

        const response =
          await createPayable({
            invoiceNumber:
              form.invoiceNumber,
            vendorId:
              form.vendorId,
            description:
              form.description,
            amount,
            dueDate:
              form.dueDate,
          });

        const createdPayable =
          response.payable;

        setPayables(
          (current) => [
            createdPayable,
            ...current.filter(
              (payable) =>
                payable.id !==
                createdPayable.id
            ),
          ]
        );

        setForm(
          initialBillForm
        );

        setShowNewBill(
          false
        );

        setSuccessMessage(
          response.message ??
            "Supplier bill created successfully."
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Failed to create supplier bill."
          )
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     APPROVE BILL
  ======================================================= */

  const handleApprove =
    async () => {
      if (
        !selectedBill ||
        actionLoading
      ) {
        return;
      }

      try {
        setActionLoading(
          true
        );

        setError("");
        setSuccessMessage("");

        const response =
          await approvePayable(
            selectedBill.id
          );

        const updated =
          response.payable;

        setSelectedBill(
          updated
        );

        setPayables(
          (current) =>
            current.map(
              (payable) =>
                payable.id ===
                updated.id
                  ? updated
                  : payable
            )
        );

        setSuccessMessage(
          response.message ??
            "Supplier bill approved successfully."
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Failed to approve supplier bill."
          )
        );
      } finally {
        setActionLoading(
          false
        );
      }
    };

  /* =======================================================
     PAYMENT
  ======================================================= */

  const handlePayment =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !selectedBill ||
        actionLoading
      ) {
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
        Number.isFinite(
          outstanding
        ) &&
        amount > outstanding
      ) {
        setError(
          "Payment amount cannot exceed the outstanding balance."
        );
        return;
      }

      try {
        setActionLoading(
          true
        );

        setError("");
        setSuccessMessage("");

        const response =
          await recordPayablePayment(
            selectedBill.id,
            amount
          );

        const updated =
          response.payable;

        setSelectedBill(
          updated
        );

        setPayables(
          (current) =>
            current.map(
              (payable) =>
                payable.id ===
                updated.id
                  ? updated
                  : payable
            )
        );

        setPaymentAmount(
          ""
        );

        setShowPaymentForm(
          false
        );

        setSuccessMessage(
          response.message ??
            "Supplier payment recorded successfully."
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Failed to record supplier payment."
          )
        );
      } finally {
        setActionLoading(
          false
        );
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete =
    async () => {
      if (
        !selectedBill ||
        actionLoading
      ) {
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
        setActionLoading(
          true
        );

        setError("");
        setSuccessMessage("");

        const response =
          await deletePayable(
            selectedBill.id
          );

        setPayables(
          (current) =>
            current.filter(
              (payable) =>
                payable.id !==
                selectedBill.id
            )
        );

        setSelectedBill(
          null
        );

        setShowPaymentForm(
          false
        );

        setPaymentAmount(
          ""
        );

        setSuccessMessage(
          response.message ||
            "Supplier bill deleted successfully."
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Failed to delete supplier bill."
          )
        );
      } finally {
        setActionLoading(
          false
        );
      }
    };

  /* =======================================================
     SELECTED BILL PERMISSIONS
  ======================================================= */

  const selectedStatus =
    selectedBill
      ? getEffectiveStatus(
          selectedBill
        )
      : "";

  const canApprove =
    Boolean(
      selectedBill &&
        (
          selectedBill.status ??
          ""
        ).toUpperCase() !==
          "APPROVED" &&
        selectedStatus !==
          "PAID"
    );

  const canPay =
    Boolean(
      selectedBill &&
        (
          selectedBill.status ??
          ""
        ).toUpperCase() ===
          "APPROVED" &&
        Number(
          selectedBill.outstandingBalance
        ) > 0
    );

  const canDelete =
    Boolean(
      selectedBill &&
        selectedStatus !==
          "PAID" &&
        Number(
          selectedBill.amount
        ) ===
          Number(
            selectedBill.outstandingBalance
          )
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#20243A]">
            Business Operations
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#20243A]">
            Accounts Payable
          </h1>

          <p className="mt-2 text-[#666B84]">
            Manage supplier bills,
            approvals, outstanding
            obligations and payments.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void loadPage()
            }
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
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
              setShowNewBill(
                true
              );
            }}
            className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-[#20243A] shadow-lg shadow-blue-950/20 hover:bg-[#5a4de0]"
          >
            <Plus size={18} />
            New Bill
          </button>
        </div>
      </div>

      {/* MESSAGES */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1">
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={17} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1">
            {successMessage}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage(
                ""
              )
            }
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* SUMMARY */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Bills"
          value={formatCurrency(
            summary.total
          )}
          subtitle={`${payables.length} supplier bills`}
          icon={
            <FileText
              size={21}
            />
          }
        />

        <SummaryCard
          title="Outstanding"
          value={formatCurrency(
            summary.outstanding
          )}
          subtitle="Amount still payable"
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
          subtitle="Past due obligations"
          icon={
            <AlertCircle
              size={21}
            />
          }
        />

        <SummaryCard
          title="Pending Approval"
          value={String(
            summary.pending
          )}
          subtitle="Bills awaiting approval"
          icon={
            <Clock3
              size={21}
            />
          }
        />
      </div>

      {/* SEARCH AND FILTER */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex flex-1 items-center rounded-xl border border-[#ECECF3] bg-white px-4 focus-within:border-[#20243A]">
            <Search
              size={18}
              className="shrink-0 text-[#666B84]"
            />

            <input
              type="text"
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search invoice number, vendor, code or description..."
              className="w-full bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-600"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="text-[#666B84] hover:text-[#20243A]"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <div className="flex items-center rounded-xl border border-[#ECECF3] bg-white px-3">
            <Filter
              size={17}
              className="text-[#666B84]"
            />

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value
                )
              }
              className="min-w-[180px] bg-transparent px-3 py-3 text-sm text-[#666B84] outline-none"
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

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-center">
              <Loader2
                size={30}
                className="mx-auto animate-spin text-[#20243A]"
              />

              <p className="mt-3 text-sm text-[#666B84]">
                Loading supplier
                bills...
              </p>
            </div>
          </div>
        ) : filteredPayables.length ===
          0 ? (
          <div className="flex min-h-[300px] items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#666B84]">
                <FileText
                  size={25}
                />
              </div>

              <h3 className="mt-4 font-semibold text-[#20243A]">
                No supplier bills
                found
              </h3>

              <p className="mt-2 text-sm text-[#666B84]">
                {search ||
                statusFilter !==
                  "ALL"
                  ? "Try changing your search or filter."
                  : "Create your first supplier bill to begin tracking payables."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead className="border-b border-[#ECECF3] bg-white/60">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <th className="px-5 py-4">
                    Vendor
                  </th>

                  <th className="px-5 py-4">
                    Invoice
                  </th>

                  <th className="px-5 py-4 text-right">
                    Amount
                  </th>

                  <th className="px-5 py-4 text-right">
                    Outstanding
                  </th>

                  <th className="px-5 py-4">
                    Due Date
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
                {filteredPayables.map(
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
                        className="border-b border-[#ECECF3]/80 transition hover:bg-white/50 last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-[#20243A]">
                            {payable
                              .vendor
                              ?.name ??
                              "Unknown Vendor"}
                          </p>

                          {payable
                            .vendor
                            ?.vendorCode && (
                            <p className="mt-1 text-xs text-[#666B84]">
                              {
                                payable
                                  .vendor
                                  .vendorCode
                              }
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-[#20243A]">
                            {
                              payable.invoiceNumber
                            }
                          </p>

                          <p className="mt-1 max-w-[220px] truncate text-xs text-[#666B84]">
                            {
                              payable.description
                            }
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right font-medium text-[#20243A]">
                          {formatCurrency(
                            payable.amount
                          )}
                        </td>

                        <td className="px-5 py-4 text-right text-[#666B84]">
                          {formatCurrency(
                            payable.outstandingBalance
                          )}
                        </td>

                        <td className="px-5 py-4 text-[#666B84]">
                          {formatDate(
                            payable.dueDate
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
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

                              setError(
                                ""
                              );
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#ECECF3] px-3 py-2 text-xs font-medium text-[#666B84] hover:border-[#20243A]/50 hover:bg-[#0D9488]/10 hover:text-[#20243A]"
                          >
                            <Eye
                              size={
                                15
                              }
                            />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NEW BILL MODAL */}

      {showNewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#20243A]">
                  New Supplier
                  Bill
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Record a new
                  accounts payable
                  obligation.
                </p>
              </div>

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
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:opacity-50"
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
                    required
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
                    className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                  >
                    <option value="">
                      Select vendor
                    </option>

                    {vendors.map(
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
                          {vendor.vendorCode
                            ? ` — ${vendor.vendorCode}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>

                  {vendors.length ===
                    0 && (
                    <p className="mt-2 text-xs text-amber-400">
                      No active
                      vendors are
                      available. Add a
                      vendor in the
                      Vendors module
                      first.
                    </p>
                  )}
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
                    className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-600 focus:border-[#0D9488]"
                  />
                </FormField>

                <FormField
                  label="Amount (KES)"
                  required
                >
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
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
                    className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-600 focus:border-[#0D9488]"
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
                    className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField
                    label="Description"
                    required
                  >
                    <textarea
                      required
                      rows={4}
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
                      className="w-full resize-none rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-600 focus:border-[#0D9488]"
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] px-6 py-5">
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
                  className="rounded-xl border border-[#ECECF3] px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    vendors.length ===
                      0
                  }
                  className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-[#20243A] hover:bg-[#5a4de0] disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#20243A]">
                  Supplier Bill
                </p>

                <h2 className="mt-1 text-xl font-semibold text-[#20243A]">
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
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A]"
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
                  className="border-t border-[#ECECF3] px-6 py-5"
                >
                  <h3 className="font-semibold text-[#20243A]">
                    Record Supplier
                    Payment
                  </h3>

                  <p className="mt-1 text-sm text-[#666B84]">
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
                          event.target
                            .value
                        )
                      }
                      placeholder="Payment amount"
                      className="flex-1 rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                    />

                    <button
                      type="submit"
                      disabled={
                        actionLoading
                      }
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-[#20243A] hover:bg-emerald-700 disabled:opacity-50"
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

            <div className="flex flex-col-reverse gap-3 border-t border-[#ECECF3] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
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
                    className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-[#20243A] hover:bg-[#5a4de0] disabled:opacity-50"
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
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-[#20243A] hover:bg-emerald-700 disabled:opacity-50"
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
                  className="rounded-xl border border-[#ECECF3] px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
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
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#666B84]">
            {title}
          </p>

          <p className="mt-3 text-2xl font-bold text-[#20243A]">
            {value}
          </p>

          <p className="mt-2 text-xs text-[#666B84]">
            {subtitle}
          </p>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-white p-3 text-[#20243A]">
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
      <span className="mb-2 block text-sm font-medium text-[#666B84]">
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
      <p className="text-xs font-semibold uppercase tracking-wide text-[#666B84]">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-medium text-[#20243A]">
        {value}
      </p>
    </div>
  );
}


