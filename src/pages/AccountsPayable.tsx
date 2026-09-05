import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  FileText,
  Filter,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import {
  approvePayable,
  createPayable,
  deletePayable,
  fetchPayables,
  recordPayablePayment,
} from "../services/accountsPayable";

import {
  authenticatedFetch,
  getAuthToken,
} from "../lib/auth";

interface Vendor {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface Payable {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  description: string;
  amount: number;
  outstandingBalance: number;
  dueDate: string;
  paymentStatus: string;
  status: string;
  approvedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  vendor?: Vendor;
}

interface BillLine {
  id: string;
  description: string;
  account: string;
  quantity: string;
  rate: string;
  taxRate: string;
}

interface BillForm {
  vendorId: string;
  vendorInvoiceNumber: string;
  billDate: string;
  dueDate: string;
  paymentTerms: string;
  currency: string;
  description: string;
  discount: string;
  department: string;
  costCentre: string;
  project: string;
  notes: string;
}

interface PaymentForm {
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes: string;
}

interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  data?: T;
  payable?: Payable;
  payables?: Payable[];
}

const today = new Date().toISOString().split("T")[0];

const initialBillForm: BillForm = {
  vendorId: "",
  vendorInvoiceNumber: "",
  billDate: today,
  dueDate: "",
  paymentTerms: "NET_30",
  currency: "KES",
  description: "",
  discount: "0",
  department: "",
  costCentre: "",
  project: "",
  notes: "",
};

const initialPaymentForm: PaymentForm = {
  amount: "",
  paymentDate: today,
  paymentMethod: "BANK_TRANSFER",
  reference: "",
  notes: "",
};

const createLine = (): BillLine => ({
  id: `${Date.now()}-${Math.random()}`,
  description: "",
  account: "",
  quantity: "1",
  rate: "",
  taxRate: "0",
});

const KES = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatCurrency = (value: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getStatusLabel = (status?: string | null) => {
  if (!status) return "Unknown";

  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getPaymentStatusLabel = (status?: string | null) => {
  if (!status) return "Unknown";

  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const isOverdue = (payable: Payable) => {
  if (!payable.dueDate) return false;

  if (
    Number(payable.outstandingBalance) <= 0 ||
    payable.paymentStatus === "PAID"
  ) {
    return false;
  }

  const dueDate = new Date(payable.dueDate);
  const current = new Date();

  dueDate.setHours(23, 59, 59, 999);
  current.setHours(0, 0, 0, 0);

  return dueDate < current;
};

const statusClasses = (status?: string | null) => {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

const paymentStatusClasses = (status?: string | null) => {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PARTIALLY_PAID":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "UNPAID":
      return "slate-50 text-slate-700 border-slate-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

function StatusBadge({
  status,
}: {
  status?: string | null;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
        status
      )}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function PaymentStatusBadge({
  status,
}: {
  status?: string | null;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentStatusClasses(
        status
      )}`}
    >
      {getPaymentStatusLabel(status)}
    </span>
  );
}

function FormField({
  label,
  children,
  required = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[#20243A]">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      {children}

      {hint && (
        <p className="text-xs leading-5 text-[#8A8FA3]">
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5E7ED] bg-white shadow-[0_2px_12px_rgba(16,24,40,0.04)]">
      <div className="flex flex-col gap-3 border-b border-[#ECEEF3] px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0D9488]">
              {eyebrow}
            </p>
          )}

          <h2 className="mt-1 text-base font-bold text-[#20243A]">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-[#777C93]">
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  description,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  tone?: "default" | "danger" | "success" | "warning";
}) {
  const toneClasses = {
    default: "bg-slate-50 text-slate-700",
    danger: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_2px_12px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#666B84]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-[#8A8FA6]">
              {description}
            </p>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AccountsPayable() {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] =
    useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [showPaymentModal, setShowPaymentModal] =
    useState(false);

  const [showDetailsModal, setShowDetailsModal] =
    useState(false);

  const [selectedPayable, setSelectedPayable] =
    useState<Payable | null>(null);

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<BillForm>(initialBillForm);

  const [lines, setLines] = useState<BillLine[]>([
    createLine(),
  ]);

  const [paymentForm, setPaymentForm] =
    useState<PaymentForm>(initialPaymentForm);

  const [invoiceFile, setInvoiceFile] =
    useState<File | null>(null);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadPayables = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await fetchPayables();

        const responseData =
          response as unknown as ApiResponse;

        const fetchedPayables =
          Array.isArray(response)
            ? response
            : responseData.payables ??
              (Array.isArray(responseData.data)
                ? (responseData.data as Payable[])
                : []);

        setPayables(fetchedPayables);
      } catch (err) {
        console.error(
          "Failed to load accounts payable:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load accounts payable."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const loadVendors = useCallback(async () => {
    try {
      const token = getAuthToken();

      const response = await authenticatedFetch(
        "/api/vendors",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        (await response.json()) as ApiResponse;

      const vendorList = Array.isArray(data.data)
        ? data.data
        : [];

      setVendors(
        vendorList as unknown as Vendor[]
      );
    } catch (err) {
      console.error(
        "Failed to load vendors:",
        err
      );
    }
  }, []);

  useEffect(() => {
    void loadPayables();
    void loadVendors();
  }, [loadPayables, loadVendors]);

  const summary = useMemo(() => {
    const totalBilled = payables.reduce(
      (sum, payable) =>
        sum + Number(payable.amount || 0),
      0
    );

    const outstanding = payables.reduce(
      (sum, payable) =>
        sum +
        Number(payable.outstandingBalance || 0),
      0
    );

    const overdue = payables
      .filter(isOverdue)
      .reduce(
        (sum, payable) =>
          sum +
          Number(
            payable.outstandingBalance || 0
          ),
        0
      );

    const pending = payables.filter(
      (payable) => payable.status === "PENDING"
    ).length;

    return {
      totalBilled,
      outstanding,
      overdue,
      pending,
      count: payables.length,
    };
  }, [payables]);

  const filteredPayables = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return payables.filter((payable) => {
      const vendorName =
        payable.vendor?.name ?? "";

      const matchesSearch =
        !query ||
        payable.invoiceNumber
          ?.toLowerCase()
          .includes(query) ||
        payable.description
          ?.toLowerCase()
          .includes(query) ||
        vendorName
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        payable.status === statusFilter;

      const matchesPaymentStatus =
        paymentStatusFilter === "ALL" ||
        payable.paymentStatus ===
          paymentStatusFilter;

      let matchesDate = true;

      if (dateFilter === "OVERDUE") {
        matchesDate = isOverdue(payable);
      }

      if (dateFilter === "DUE_THIS_MONTH") {
        const dueDate = new Date(
          payable.dueDate
        );
        const now = new Date();

        matchesDate =
          dueDate.getMonth() ===
            now.getMonth() &&
          dueDate.getFullYear() ===
            now.getFullYear();
      }

      return (
        Boolean(matchesSearch) &&
        matchesStatus &&
        matchesPaymentStatus &&
        matchesDate
      );
    });
  }, [
    payables,
    search,
    statusFilter,
    paymentStatusFilter,
    dateFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredPayables.length / rowsPerPage
    )
  );

  const paginatedPayables = useMemo(() => {
    const start =
      (page - 1) * rowsPerPage;

    return filteredPayables.slice(
      start,
      start + rowsPerPage
    );
  }, [
    filteredPayables,
    page,
    rowsPerPage,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const quantity =
          Number(line.quantity) || 0;

        const rate =
          Number(line.rate) || 0;

        return sum + quantity * rate;
      }, 0),
    [lines]
  );

  const taxTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const quantity =
          Number(line.quantity) || 0;

        const rate =
          Number(line.rate) || 0;

        const taxRate =
          Number(line.taxRate) || 0;

        const lineSubtotal =
          quantity * rate;

        return (
          sum +
          lineSubtotal * (taxRate / 100)
        );
      }, 0),
    [lines]
  );

  const discount = Math.max(
    0,
    Number(form.discount) || 0
  );

  const grandTotal = Math.max(
    0,
    subtotal + taxTotal - discount
  );

  const selectedVendor = vendors.find(
    (vendor) =>
      vendor.id === form.vendorId
  );

  const possibleDuplicate = useMemo(() => {
    if (
      !form.vendorId ||
      !form.vendorInvoiceNumber.trim()
    ) {
      return null;
    }

    const reference =
      form.vendorInvoiceNumber
        .trim()
        .toLowerCase();

    return (
      payables.find((payable) => {
        if (
          payable.vendorId !==
          form.vendorId
        ) {
          return false;
        }

        return (
          payable.description
            ?.toLowerCase()
            .includes(reference)
        );
      }) ?? null
    );
  }, [
    form.vendorId,
    form.vendorInvoiceNumber,
    payables,
  ]);

  const updateForm = <K extends keyof BillForm>(
    field: K,
    value: BillForm[K]
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateLine = (
    id: string,
    field: keyof BillLine,
    value: string
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]: value,
            }
          : line
      )
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      createLine(),
    ]);
  };

  const removeLine = (id: string) => {
    setLines((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (line) => line.id !== id
      );
    });
  };

  const resetCreateForm = () => {
    setForm(initialBillForm);
    setLines([createLine()]);
    setInvoiceFile(null);
    setError("");
  };

  const openCreateBill = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const handleInvoiceFile = (
    file: File | null
  ) => {
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please upload a PDF, JPG or PNG invoice."
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        "Invoice files must be smaller than 10 MB."
      );
      return;
    }

    setError("");
    setInvoiceFile(file);
  };

  const handleCreateBill = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    if (!form.vendorId) {
      setError("Please select a vendor.");
      return;
    }

    if (!form.description.trim()) {
      setError(
        "Please enter a description for this bill."
      );
      return;
    }

    if (!form.dueDate) {
      setError("Due date is required.");
      return;
    }

    if (
      form.billDate &&
      form.dueDate < form.billDate
    ) {
      setError(
        "Due date cannot be earlier than the bill date."
      );
      return;
    }

    if (
      !Number.isFinite(grandTotal) ||
      grandTotal <= 0
    ) {
      setError(
        "Add at least one bill line with a valid amount."
      );
      return;
    }

    const invalidLine = lines.find(
      (line) =>
        !line.description.trim() ||
        !Number.isFinite(
          Number(line.quantity)
        ) ||
        Number(line.quantity) <= 0 ||
        !Number.isFinite(Number(line.rate)) ||
        Number(line.rate) < 0
    );

    if (invalidLine) {
      setError(
        "Please complete every line item with a description, quantity and valid rate."
      );
      return;
    }

    try {
      setSubmitting(true);

      const lineDescription = lines
        .map((line) => {
          const quantity =
            Number(line.quantity) || 0;

          const rate =
            Number(line.rate) || 0;

          const taxRate =
            Number(line.taxRate) || 0;

          return `${line.description.trim()} — ${quantity} × ${rate.toFixed(
            2
          )} — ${taxRate}% tax`;
        })
        .join("; ");

      const referenceText =
        form.vendorInvoiceNumber.trim()
          ? `Supplier invoice: ${form.vendorInvoiceNumber.trim()}`
          : "";

      const notesText =
        form.notes.trim()
          ? `Notes: ${form.notes.trim()}`
          : "";

      const combinedDescription = [
        form.description.trim(),
        referenceText,
        lineDescription,
        notesText,
      ]
        .filter(Boolean)
        .join(" | ");

      await createPayable({
        vendorId: form.vendorId,
        description: combinedDescription,
        amount: grandTotal,
        dueDate: form.dueDate,
      });

      setShowCreateModal(false);
      resetCreateForm();

      setSuccessMessage(
        "Bill created successfully and is now pending approval."
      );

      await loadPayables(true);
    } catch (err) {
      console.error(
        "Failed to create payable:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create bill."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (
    payable: Payable
  ) => {
    try {
      setSubmitting(true);
      setError("");

      await approvePayable(payable.id);

      setSuccessMessage(
        `${payable.invoiceNumber} was approved successfully.`
      );

      await loadPayables(true);

      setOpenMenuId(null);
      setShowDetailsModal(false);
    } catch (err) {
      console.error(
        "Failed to approve payable:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to approve bill."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (
    payable: Payable
  ) => {
    const confirmed = window.confirm(
      `Delete bill ${payable.invoiceNumber}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);
      setError("");

      await deletePayable(payable.id);

      setSuccessMessage(
        `${payable.invoiceNumber} was deleted.`
      );

      await loadPayables(true);

      setOpenMenuId(null);

      if (
        selectedPayable?.id ===
        payable.id
      ) {
        setSelectedPayable(null);
        setShowDetailsModal(false);
      }
    } catch (err) {
      console.error(
        "Failed to delete payable:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete bill."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentModal = (
    payable: Payable
  ) => {
    setSelectedPayable(payable);

    setPaymentForm({
      ...initialPaymentForm,
      amount:
        Number(payable.outstandingBalance) >
        0
          ? String(
              payable.outstandingBalance
            )
          : "",
    });

    setShowPaymentModal(true);
    setOpenMenuId(null);
  };

  const openDetailsModal = (
    payable: Payable
  ) => {
    setSelectedPayable(payable);
    setShowDetailsModal(true);
    setOpenMenuId(null);
  };

  const handleRecordPayment = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!selectedPayable) return;

    const amount =
      Number(paymentForm.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Please enter a valid payment amount."
      );
      return;
    }

    if (
      amount >
      Number(
        selectedPayable.outstandingBalance
      )
    ) {
      setError(
        "Payment amount cannot exceed the outstanding balance."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await recordPayablePayment(selectedPayable.id, amount);

      setShowPaymentModal(false);
      setSelectedPayable(null);

      setPaymentForm(
        initialPaymentForm
      );

      setSuccessMessage(
        "Payment recorded successfully."
      );

      await loadPayables(true);
    } catch (err) {
      console.error(
        "Failed to record payment:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to record payment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    const headers = [
      "Bill Number",
      "Vendor",
      "Description",
      "Amount",
      "Outstanding",
      "Due Date",
      "Payment Status",
      "Status",
    ];

    const rows =
      filteredPayables.map(
        (payable) => [
          payable.invoiceNumber,
          payable.vendor?.name ?? "",
          payable.description,
          payable.amount,
          payable.outstandingBalance,
          payable.dueDate,
          payable.paymentStatus,
          payable.status,
        ]
      );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text = String(
              value ?? ""
            );

            return `"${text.replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `accounts-payable-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPaymentStatusFilter("ALL");
    setDateFilter("ALL");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "ALL" ||
    paymentStatusFilter !== "ALL" ||
    dateFilter !== "ALL";

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto max-w-[1600px] px-6 py-7 lg:px-8">
        {/* HEADER */}
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-[#777C93]">
              <span>Finance</span>
              <ChevronRight size={15} />
              <span className="font-medium text-[#20243A]">
                Accounts Payable
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#20243A]">
              Accounts Payable
            </h1>

            <p className="mt-1.5 text-sm text-[#666B84]">
              Manage supplier bills,
              approvals, outstanding
              balances and payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                loadPayables(true)
              }
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E3E5EC] bg-white px-4 py-2.5 text-sm font-semibold text-[#34394F] shadow-sm transition hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
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
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DCE8E4] bg-[#ECFDF5] px-4 py-2.5 text-sm font-semibold text-[#047857] shadow-sm transition hover:bg-[#DFF8ED]"
            >
              <Download size={16} />
              Export
            </button>

            <button
              type="button"
              onClick={openCreateBill}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F766E]"
            >
              <Plus size={17} />
              New Bill
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Something went wrong
              </p>

              <p className="mt-0.5">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 hover:bg-red-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* SUCCESS */}
        {successMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Success
              </p>

              <p className="mt-0.5">
                {successMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage("")
              }
              className="rounded-lg p-1 hover:bg-emerald-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* SUMMARY */}
        <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Bills"
            value={String(summary.count)}
            description="All supplier bills"
            icon={<FileText size={20} />}
          />

          <SummaryCard
            label="Total Billed"
            value={KES(summary.totalBilled)}
            description="Gross bill value"
            icon={<CreditCard size={20} />}
          />

          <SummaryCard
            label="Outstanding"
            value={KES(summary.outstanding)}
            description="Amount still payable"
            tone={
              summary.outstanding > 0
                ? "warning"
                : "success"
            }
            icon={<ClockIcon />}
          />

          <SummaryCard
            label="Overdue"
            value={KES(summary.overdue)}
            description="Past due outstanding"
            tone={
              summary.overdue > 0
                ? "danger"
                : "success"
            }
            icon={
              <AlertCircle size={20} />
            }
          />
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-[0_2px_12px_rgba(16,24,40,0.04)]">
          <div className="border-b border-[#ECEEF3] p-4 lg:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1 lg:max-w-xl">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9297AA]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => {
                    setSearch(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  placeholder="Search bill number, vendor or description..."
                  className="w-full rounded-xl border border-[#E5E7ED] bg-[#FAFBFC] py-2.5 pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#969BAE] focus:border-[#0D9488] focus:bg-white focus:ring-2 focus:ring-[#0D9488]/10"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowFilters(
                      (current) =>
                        !current
                    )
                  }
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                    showFilters ||
                    hasActiveFilters
                      ? "border-[#B8DDD7] bg-[#F0FDFA] text-[#0F766E]"
                      : "border-[#E3E5EC] bg-white text-[#4D5268] hover:bg-[#F8F9FB]"
                  }`}
                >
                  <Filter size={16} />
                  Filters

                  {hasActiveFilters && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0D9488] px-1 text-[10px] font-bold text-white">
                      !
                    </span>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#666B84] transition hover:bg-[#F5F6F8]"
                  >
                    <X size={15} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 grid gap-3 border-t border-[#ECEEF3] pt-4 md:grid-cols-3">
                <FilterSelect
                  label="Bill Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    ["ALL", "All statuses"],
                    ["PENDING", "Pending"],
                    ["APPROVED", "Approved"],
                    ["REJECTED", "Rejected"],
                  ]}
                />

                <FilterSelect
                  label="Payment Status"
                  value={paymentStatusFilter}
                  onChange={
                    setPaymentStatusFilter
                  }
                  options={[
                    ["ALL", "All payments"],
                    ["UNPAID", "Unpaid"],
                    [
                      "PARTIALLY_PAID",
                      "Partially paid",
                    ],
                    ["PAID", "Paid"],
                  ]}
                />

                <FilterSelect
                  label="Due Date"
                  value={dateFilter}
                  onChange={setDateFilter}
                  options={[
                    ["ALL", "All dates"],
                    ["OVERDUE", "Overdue"],
                    [
                      "DUE_THIS_MONTH",
                      "Due this month",
                    ],
                  ]}
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <RefreshCw
                  size={24}
                  className="animate-spin text-[#0D9488]"
                />

                <p className="text-sm font-medium text-[#666B84]">
                  Loading accounts
                  payable...
                </p>
              </div>
            </div>
          ) : filteredPayables.length ===
            0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F5] text-[#0D9488]">
                <FileText size={25} />
              </div>

              <h3 className="mt-4 text-base font-bold text-[#20243A]">
                No bills found
              </h3>

              <p className="mt-1 max-w-md text-sm text-[#777C93]">
                {hasActiveFilters
                  ? "Try changing your filters or search terms."
                  : "Create your first supplier bill to start managing accounts payable."}
              </p>

              {!hasActiveFilters && (
                <button
                  type="button"
                  onClick={openCreateBill}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E]"
                >
                  <Plus size={16} />
                  Create Bill
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#ECEEF3] bg-[#FAFBFC]">
                      {[
                        "Bill Number",
                        "Vendor",
                        "Description",
                        "Amount",
                        "Outstanding",
                        "Due Date",
                        "Payment",
                        "Status",
                        "",
                      ].map(
                        (heading, index) => (
                          <th
                            key={`${heading}-${index}`}
                            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-[#7A7F94] ${
                              heading ===
                                "Amount" ||
                              heading ===
                                "Outstanding"
                                ? "text-right"
                                : "text-left"
                            }`}
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedPayables.map(
                      (payable) => {
                        const overdue =
                          isOverdue(
                            payable
                          );

                        return (
                          <tr
                            key={payable.id}
                            className="border-b border-[#F0F1F4] transition hover:bg-[#FAFCFC]"
                          >
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  openDetailsModal(
                                    payable
                                  )
                                }
                                className="font-semibold text-[#0F766E] hover:underline"
                              >
                                {
                                  payable.invoiceNumber
                                }
                              </button>

                              <p className="mt-1 text-xs text-[#999EB0]">
                                {formatDateTime(
                                  payable.createdAt
                                )}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-semibold text-[#30354B]">
                                {payable
                                  .vendor
                                  ?.name ??
                                  "Unknown vendor"}
                              </p>

                              {payable
                                .vendor
                                ?.email && (
                                <p className="mt-1 text-xs text-[#858A9E]">
                                  {
                                    payable
                                      .vendor
                                      .email
                                  }
                                </p>
                              )}
                            </td>

                            <td className="max-w-[300px] px-5 py-4">
                              <p className="truncate text-sm text-[#4E5369]">
                                {
                                  payable.description
                                }
                              </p>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span className="font-semibold text-[#30354B]">
                                {KES(
                                  Number(
                                    payable.amount ||
                                      0
                                  )
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span
                                className={`font-semibold ${
                                  overdue
                                    ? "text-red-600"
                                    : Number(
                                        payable.outstandingBalance
                                      ) > 0
                                    ? "text-[#30354B]"
                                    : "text-emerald-600"
                                }`}
                              >
                                {KES(
                                  Number(
                                    payable.outstandingBalance ||
                                      0
                                  )
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div
                                className={`text-sm font-medium ${
                                  overdue
                                    ? "text-red-600"
                                    : "text-[#4E5369]"
                                }`}
                              >
                                {formatDate(
                                  payable.dueDate
                                )}
                              </div>

                              {overdue && (
                                <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                                  <AlertCircle
                                    size={12}
                                  />
                                  Overdue
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <PaymentStatusBadge
                                status={
                                  payable.paymentStatus
                                }
                              />
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={
                                  payable.status
                                }
                              />
                            </td>

                            <td className="relative px-3 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenuId(
                                    (current) =>
                                      current ===
                                      payable.id
                                        ? null
                                        : payable.id
                                  )
                                }
                                className="rounded-lg p-2 text-[#777C93] hover:bg-[#F0F2F5] hover:text-[#30354B]"
                                aria-label="Actions"
                              >
                                <MoreHorizontal
                                  size={18}
                                />
                              </button>

                              {openMenuId ===
                                payable.id && (
                                <div className="absolute right-3 top-12 z-20 w-48 overflow-hidden rounded-xl border border-[#E4E6EC] bg-white py-1.5 text-left shadow-xl">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDetailsModal(
                                        payable
                                      )
                                    }
                                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-[#454A60] hover:bg-[#F7F8FA]"
                                  >
                                    <Eye
                                      size={15}
                                    />
                                    View details
                                  </button>

                                  {payable.status ===
                                    "PENDING" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleApprove(
                                          payable
                                        )
                                      }
                                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-[#047857] hover:bg-[#F0FDF4]"
                                    >
                                      <Check
                                        size={15}
                                      />
                                      Approve bill
                                    </button>
                                  )}

                                  {Number(
                                    payable.outstandingBalance
                                  ) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPaymentModal(
                                          payable
                                        )
                                      }
                                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-[#0F766E] hover:bg-[#F0FDFA]"
                                    >
                                      <CreditCard
                                        size={15}
                                      />
                                      Record payment
                                    </button>
                                  )}

                                  <div className="my-1 border-t border-[#ECEEF3]" />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDelete(
                                        payable
                                      )
                                    }
                                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2
                                      size={15}
                                    />
                                    Delete bill
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-[#ECEEF3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-[#777C93]">
                  Showing{" "}
                  <span className="font-semibold text-[#454A60]">
                    {filteredPayables.length ===
                    0
                      ? 0
                      : (page - 1) *
                          rowsPerPage +
                        1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-[#454A60]">
                    {Math.min(
                      page * rowsPerPage,
                      filteredPayables.length
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#454A60]">
                    {
                      filteredPayables.length
                    }
                  </span>{" "}
                  bills
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-[#777C93]">
                    <span>Rows</span>

                    <select
                      value={rowsPerPage}
                      onChange={(event) => {
                        setRowsPerPage(
                          Number(
                            event.target.value
                          )
                        );
                        setPage(1);
                      }}
                      className="rounded-lg border border-[#E3E5EC] bg-white px-2.5 py-1.5 text-sm font-medium text-[#454A60] outline-none focus:border-[#0D9488]"
                    >
                      <option value={10}>
                        10
                      </option>
                      <option value={25}>
                        25
                      </option>
                      <option value={50}>
                        50
                      </option>
                      <option value={100}>
                        100
                      </option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E5EC] bg-white text-[#555A70] hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="min-w-20 text-center text-sm font-semibold text-[#454A60]">
                    Page {page} of{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      page >= totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1
                          )
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E5EC] bg-white text-[#555A70] hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* NEW BILL WORKSPACE */}
      {/* ========================================================= */}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#101426]/50 backdrop-blur-sm">
          <div className="min-h-full px-3 py-4 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-[1320px] overflow-hidden rounded-3xl border border-[#E4E7ED] bg-[#F7F8FA] shadow-[0_30px_90px_rgba(16,24,40,0.25)]">
              {/* WORKSPACE HEADER */}
              <div className="sticky top-0 z-30 border-b border-[#E5E7ED] bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setShowCreateModal(false)
                      }
                      className="mt-0.5 rounded-xl p-2 text-[#777C93] transition hover:bg-[#F2F4F6] hover:text-[#20243A]"
                    >
                      <X size={20} />
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight text-[#20243A]">
                          New Bill
                        </h2>

                        <span className="inline-flex items-center rounded-full border border-[#DDE3E8] bg-[#F8FAFB] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#6D7387]">
                          Draft
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-[#777C93]">
                        Create and code a supplier bill.
                      </p>
                    </div>
                  </div>

                  <div className="hidden items-center gap-2 lg:flex">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#8A8FA3]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0D9488] text-white">
                        1
                      </span>
                      Details
                    </div>

                    <div className="h-px w-8 bg-[#DDE1E7]" />

                    <div className="flex items-center gap-2 text-xs font-medium text-[#8A8FA3]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DDE1E7] bg-white">
                        2
                      </span>
                      Review
                    </div>

                    <div className="h-px w-8 bg-[#DDE1E7]" />

                    <div className="flex items-center gap-2 text-xs font-medium text-[#8A8FA3]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DDE1E7] bg-white">
                        3
                      </span>
                      Approval
                    </div>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleCreateBill}
              >
                <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-5">
                    {/* INVOICE CAPTURE */}
                    <SectionCard
                      eyebrow="Invoice capture"
                      title="Start with the supplier invoice"
                      description="Upload the original invoice or enter the details manually."
                    >
                      <div
                        onDragOver={(event) =>
                          event.preventDefault()
                        }
                        onDrop={(event) => {
                          event.preventDefault();

                          handleInvoiceFile(
                            event.dataTransfer
                              .files?.[0] ??
                              null
                          );
                        }}
                        className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                          invoiceFile
                            ? "border-[#9ED8CF] bg-[#F0FDFA]"
                            : "border-[#D9DDE5] bg-[#FAFBFC] hover:border-[#AFCFC9] hover:bg-[#F7FCFB]"
                        }`}
                      >
                        {invoiceFile ? (
                          <div className="flex flex-col items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDF8F2] text-[#0D9488]">
                              <FileText
                                size={23}
                              />
                            </div>

                            <p className="mt-3 text-sm font-bold text-[#20243A]">
                              {invoiceFile.name}
                            </p>

                            <p className="mt-1 text-xs text-[#777C93]">
                              {(
                                invoiceFile.size /
                                1024 /
                                1024
                              ).toFixed(
                                2
                              )}{" "}
                              MB
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                setInvoiceFile(
                                  null
                                )
                              }
                              className="mt-3 text-xs font-semibold text-[#0F766E] hover:underline"
                            >
                              Remove file
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#0D9488] shadow-sm ring-1 ring-[#E4E8EC]">
                              <UploadCloud
                                size={24}
                              />
                            </div>

                            <p className="mt-3 text-sm font-bold text-[#30354B]">
                              Drop your invoice here
                            </p>

                            <p className="mt-1 text-sm text-[#858A9E]">
                              PDF, JPG or PNG up to 10 MB
                            </p>

                            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#DDE2E7] bg-white px-4 py-2.5 text-sm font-semibold text-[#454A60] shadow-sm hover:bg-[#F7F8FA]">
                              <UploadCloud
                                size={16}
                              />
                              Browse files
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(
                                  event
                                ) =>
                                  handleInvoiceFile(
                                    event
                                      .target
                                      .files?.[0] ??
                                      null
                                  )
                                }
                              />
                            </label>

                            <p className="mt-3 text-xs text-[#9A9EAE]">
                              AI invoice extraction can be connected here in the next phase.
                            </p>
                          </>
                        )}
                      </div>
                    </SectionCard>

                    {/* VENDOR + BILL DETAILS */}
                    <SectionCard
                      eyebrow="Bill information"
                      title="Vendor and invoice details"
                      description="Capture the core information from the supplier invoice."
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField
                          label="Vendor"
                          required
                          hint={
                            selectedVendor
                              ? `${selectedVendor.email ?? ""}${
                                  selectedVendor.phone
                                    ? ` · ${selectedVendor.phone}`
                                    : ""
                                }`
                              : undefined
                          }
                        >
                          <input
                            list="vendor-options"
                            value={
                              selectedVendor?.name ??
                              ""
                            }
                            onChange={(event) => {
                              const vendor =
                                vendors.find(
                                  (item) =>
                                    item.name.toLowerCase() ===
                                    event.target.value
                                      .trim()
                                      .toLowerCase()
                                );

                              updateForm(
                                "vendorId",
                                vendor?.id ?? ""
                              );
                            }}
                            placeholder="Search or select vendor..."
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A5B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                          />

                          <datalist id="vendor-options">
                            {vendors.map(
                              (vendor) => (
                                <option
                                  key={vendor.id}
                                  value={
                                    vendor.name
                                  }
                                />
                              )
                            )}
                          </datalist>
                        </FormField>

                        <FormField
                          label="Supplier invoice number"
                          hint="The reference printed on the supplier's invoice."
                        >
                          <input
                            type="text"
                            value={
                              form.vendorInvoiceNumber
                            }
                            onChange={(event) =>
                              updateForm(
                                "vendorInvoiceNumber",
                                event.target.value
                              )
                            }
                            placeholder="e.g. INV-10482"
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A5B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                          />
                        </FormField>

                        <FormField
                          label="Bill date"
                          required
                        >
                          <input
                            type="date"
                            value={
                              form.billDate
                            }
                            onChange={(event) =>
                              updateForm(
                                "billDate",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                          />
                        </FormField>

                        <FormField
                          label="Due date"
                          required
                        >
                          <input
                            type="date"
                            value={
                              form.dueDate
                            }
                            onChange={(event) =>
                              updateForm(
                                "dueDate",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                          />
                        </FormField>

                        <FormField label="Payment terms">
                          <select
                            value={
                              form.paymentTerms
                            }
                            onChange={(event) =>
                              updateForm(
                                "paymentTerms",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                          >
                            <option value="DUE_ON_RECEIPT">
                              Due on receipt
                            </option>
                            <option value="NET_15">
                              Net 15
                            </option>
                            <option value="NET_30">
                              Net 30
                            </option>
                            <option value="NET_45">
                              Net 45
                            </option>
                            <option value="NET_60">
                              Net 60
                            </option>
                            <option value="CUSTOM">
                              Custom
                            </option>
                          </select>
                        </FormField>

                        <FormField label="Currency">
                          <select
                            value={
                              form.currency
                            }
                            onChange={(event) =>
                              updateForm(
                                "currency",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm font-medium text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                          >
                            <option value="KES">
                              KES — Kenyan Shilling
                            </option>
                            <option value="USD">
                              USD — US Dollar
                            </option>
                            <option value="EUR">
                              EUR — Euro
                            </option>
                            <option value="GBP">
                              GBP — British Pound
                            </option>
                          </select>
                        </FormField>
                      </div>

                      {possibleDuplicate && (
                        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <AlertCircle
                            size={18}
                            className="mt-0.5 shrink-0 text-amber-600"
                          />

                          <div>
                            <p className="text-sm font-bold text-amber-900">
                              Possible duplicate bill
                            </p>

                            <p className="mt-1 text-sm leading-5 text-amber-800">
                              A bill for this vendor appears to contain the same supplier invoice reference:
                              {" "}
                              <span className="font-semibold">
                                {
                                  possibleDuplicate.invoiceNumber
                                }
                              </span>
                              .
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-5">
                        <FormField
                          label="What is this bill for?"
                          required
                          hint="Use a concise business description. The line items below provide the detailed breakdown."
                        >
                          <textarea
                            rows={3}
                            value={
                              form.description
                            }
                            onChange={(event) =>
                              updateForm(
                                "description",
                                event.target.value
                              )
                            }
                            placeholder="e.g. Office equipment and supplies for the operations team"
                            className="w-full resize-none rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm leading-6 text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                          />
                        </FormField>
                      </div>
                    </SectionCard>

                    {/* LINE ITEMS */}
                    <SectionCard
                      eyebrow="Bill breakdown"
                      title="Line items"
                      description="Break the supplier invoice into individual charges."
                      action={
                        <button
                          type="button"
                          onClick={addLine}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#BFDCD7] bg-[#F0FDFA] px-3.5 py-2 text-sm font-semibold text-[#0F766E] hover:bg-[#E4FAF5]"
                        >
                          <Plus size={15} />
                          Add line
                        </button>
                      }
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px]">
                          <thead>
                            <tr className="border-b border-[#ECEEF3]">
                              <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#858A9E]">
                                Description
                              </th>
                              <th className="w-[150px] pb-3 pl-3 text-left text-[11px] font-bold uppercase tracking-wide text-[#858A9E]">
                                Account
                              </th>
                              <th className="w-[85px] pb-3 pl-3 text-right text-[11px] font-bold uppercase tracking-wide text-[#858A9E]">
                                Qty
                              </th>
                              <th className="w-[130px] pb-3 pl-3 text-right text-[11px] font-bold uppercase tracking-wide text-[#858A9E]">
                                Rate
                              </th>
                              <th className="w-[100px] pb-3 pl-3 text-right text-[11px] font-bold uppercase tracking-wide text-[#858A9E]">
                                Tax
                              </th>
                              <th className="w-[130px] pb-3 pl-3 text-right text-[11px] font-bold uppercase tracking-wide text-[#858A9E]">
                                Amount
                              </th>
                              <th className="w-10 pb-3" />
                            </tr>
                          </thead>

                          <tbody>
                            {lines.map(
                              (line) => {
                                const lineSubtotal =
                                  (Number(
                                    line.quantity
                                  ) || 0) *
                                  (Number(
                                    line.rate
                                  ) || 0);

                                const lineTax =
                                  lineSubtotal *
                                  ((Number(
                                    line.taxRate
                                  ) || 0) /
                                    100);

                                const lineTotal =
                                  lineSubtotal +
                                  lineTax;

                                return (
                                  <tr
                                    key={line.id}
                                    className="border-b border-[#F0F1F4]"
                                  >
                                    <td className="py-3">
                                      <input
                                        type="text"
                                        value={
                                          line.description
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateLine(
                                            line.id,
                                            "description",
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        placeholder="Item or service"
                                        className="w-full rounded-lg border border-[#E5E7ED] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488]"
                                      />
                                    </td>

                                    <td className="py-3 pl-3">
                                      <select
                                        value={
                                          line.account
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateLine(
                                            line.id,
                                            "account",
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        className="w-full rounded-lg border border-[#E5E7ED] bg-white px-2.5 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                                      >
                                        <option value="">
                                          Select account
                                        </option>
                                        <option value="Office Expenses">
                                          Office Expenses
                                        </option>
                                        <option value="Utilities">
                                          Utilities
                                        </option>
                                        <option value="Rent">
                                          Rent
                                        </option>
                                        <option value="Professional Services">
                                          Professional Services
                                        </option>
                                        <option value="Travel & Transport">
                                          Travel & Transport
                                        </option>
                                        <option value="Marketing">
                                          Marketing
                                        </option>
                                        <option value="Equipment">
                                          Equipment
                                        </option>
                                        <option value="Other Operating Expense">
                                          Other Operating Expense
                                        </option>
                                      </select>
                                    </td>

                                    <td className="py-3 pl-3">
                                      <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={
                                          line.quantity
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateLine(
                                            line.id,
                                            "quantity",
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        className="w-full rounded-lg border border-[#E5E7ED] bg-white px-2.5 py-2.5 text-right text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                                      />
                                    </td>

                                    <td className="py-3 pl-3">
                                      <div className="relative">
                                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8A8FA3]">
                                          {form.currency}
                                        </span>

                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={
                                            line.rate
                                          }
                                          onChange={(
                                            event
                                          ) =>
                                            updateLine(
                                              line.id,
                                              "rate",
                                              event
                                                .target
                                                .value
                                            )
                                          }
                                          placeholder="0.00"
                                          className="w-full rounded-lg border border-[#E5E7ED] bg-white py-2.5 pl-12 pr-2.5 text-right text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488]"
                                        />
                                      </div>
                                    </td>

                                    <td className="py-3 pl-3">
                                      <select
                                        value={
                                          line.taxRate
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateLine(
                                            line.id,
                                            "taxRate",
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        className="w-full rounded-lg border border-[#E5E7ED] bg-white px-2 py-2.5 text-right text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                                      >
                                        <option value="0">
                                          0%
                                        </option>
                                        <option value="8">
                                          8%
                                        </option>
                                        <option value="16">
                                          16%
                                        </option>
                                      </select>
                                    </td>

                                    <td className="py-3 pl-3 text-right">
                                      <span className="text-sm font-bold text-[#30354B]">
                                        {formatCurrency(
                                          lineTotal,
                                          form.currency
                                        )}
                                      </span>
                                    </td>

                                    <td className="py-3 pl-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeLine(
                                            line.id
                                          )
                                        }
                                        disabled={
                                          lines.length ===
                                          1
                                        }
                                        className="rounded-lg p-2 text-[#9A9EAE] hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label="Remove line"
                                      >
                                        <Trash2
                                          size={15}
                                        />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 rounded-xl bg-[#FAFBFC] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[#777C93]">
                          {lines.length}{" "}
                          line{" "}
                          {lines.length === 1
                            ? "item"
                            : "items"}
                        </p>

                        <button
                          type="button"
                          onClick={addLine}
                          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#0F766E] hover:underline"
                        >
                          <Plus size={15} />
                          Add another line
                        </button>
                      </div>
                    </SectionCard>

                    {/* ACCOUNTING */}
                    <SectionCard
                      eyebrow="Accounting"
                      title="Coding and tracking"
                      description="Organize the bill for finance reporting and review."
                    >
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField
                          label="Department"
                        >
                          <input
                            type="text"
                            value={
                              form.department
                            }
                            onChange={(event) =>
                              updateForm(
                                "department",
                                event.target.value
                              )
                            }
                            placeholder="e.g. Operations"
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488]"
                          />
                        </FormField>

                        <FormField
                          label="Cost centre"
                        >
                          <input
                            type="text"
                            value={
                              form.costCentre
                            }
                            onChange={(event) =>
                              updateForm(
                                "costCentre",
                                event.target.value
                              )
                            }
                            placeholder="e.g. MSA-OPS"
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488]"
                          />
                        </FormField>

                        <FormField
                          label="Project"
                        >
                          <input
                            type="text"
                            value={
                              form.project
                            }
                            onChange={(event) =>
                              updateForm(
                                "project",
                                event.target.value
                              )
                            }
                            placeholder="Optional project"
                            className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488]"
                          />
                        </FormField>

                        <FormField
                          label="Discount"
                        >
                          <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#8A8FA3]">
                              {form.currency}
                            </span>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                form.discount
                              }
                              onChange={(event) =>
                                updateForm(
                                  "discount",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-xl border border-[#E3E6EC] bg-white py-3 pl-14 pr-4 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                            />
                          </div>
                        </FormField>
                      </div>

                      <div className="mt-5">
                        <FormField
                          label="Internal notes"
                          hint="These notes are for your finance team and are not intended for the supplier."
                        >
                          <textarea
                            rows={3}
                            value={
                              form.notes
                            }
                            onChange={(event) =>
                              updateForm(
                                "notes",
                                event.target.value
                              )
                            }
                            placeholder="Add internal finance notes..."
                            className="w-full resize-none rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm leading-6 text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488]"
                          />
                        </FormField>
                      </div>
                    </SectionCard>

                    {/* ATTACHMENT */}
                    <SectionCard
                      eyebrow="Documentation"
                      title="Supporting documents"
                      description="Keep the original supplier invoice attached to the bill."
                    >
                      {invoiceFile ? (
                        <div className="flex items-center gap-3 rounded-xl border border-[#DDE4E7] bg-[#FAFBFC] p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F7F4] text-[#0D9488]">
                            <Paperclip size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#30354B]">
                              {invoiceFile.name}
                            </p>

                            <p className="mt-0.5 text-xs text-[#858A9E]">
                              Invoice document
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setInvoiceFile(
                                null
                              )
                            }
                            className="rounded-lg p-2 text-[#858A9E] hover:bg-red-50 hover:text-red-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#D9DDE5] bg-[#FAFBFC] p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#8A8FA3] ring-1 ring-[#E4E7EB]">
                            <Paperclip size={18} />
                          </div>

                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#454A60]">
                              No invoice attached
                            </p>

                            <p className="mt-0.5 text-xs text-[#8A8FA3]">
                              Upload the original invoice above.
                            </p>
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  </div>

                  {/* RIGHT SUMMARY */}
                  <aside className="lg:sticky lg:top-[90px] lg:self-start">
                    <div className="space-y-5">
                      <div className="overflow-hidden rounded-2xl border border-[#E2E6EA] bg-white shadow-[0_4px_20px_rgba(16,24,40,0.06)]">
                        <div className="border-b border-[#ECEEF3] px-5 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#858A9E]">
                            Bill summary
                          </p>

                          <p className="mt-1 text-sm text-[#777C93]">
                            Review the financial impact before submitting.
                          </p>
                        </div>

                        <div className="space-y-4 p-5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-[#777C93]">
                              Subtotal
                            </span>

                            <span className="text-sm font-semibold text-[#30354B]">
                              {formatCurrency(
                                subtotal,
                                form.currency
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-[#777C93]">
                              Tax
                            </span>

                            <span className="text-sm font-semibold text-[#30354B]">
                              {formatCurrency(
                                taxTotal,
                                form.currency
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-[#777C93]">
                              Discount
                            </span>

                            <span className="text-sm font-semibold text-[#30354B]">
                              −{" "}
                              {formatCurrency(
                                discount,
                                form.currency
                              )}
                            </span>
                          </div>

                          <div className="border-t border-[#ECEEF3] pt-4">
                            <div className="flex items-end justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-[#454A60]">
                                  Total
                                </p>

                                <p className="mt-1 text-xs text-[#8A8FA3]">
                                  Amount due
                                </p>
                              </div>

                              <p className="text-2xl font-bold tracking-tight text-[#20243A]">
                                {formatCurrency(
                                  grandTotal,
                                  form.currency
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ACCOUNTING PREVIEW */}
                      <div className="rounded-2xl border border-[#DCE9E6] bg-[#F6FCFA] p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#DDF5EF] text-[#0D9488]">
                            <CheckCircle2
                              size={18}
                            />
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-[#21423D]">
                              Accounting preview
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-[#5E7772]">
                              Preview of the financial effect of this bill.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          <PreviewRow
                            label="Expense / items"
                            amount={subtotal}
                            currency={
                              form.currency
                            }
                            debit
                          />

                          <PreviewRow
                            label="Input tax"
                            amount={taxTotal}
                            currency={
                              form.currency
                            }
                            debit
                          />

                          <PreviewRow
                            label="Accounts Payable"
                            amount={grandTotal}
                            currency={
                              form.currency
                            }
                            credit
                          />
                        </div>
                      </div>

                      {/* APPROVAL */}
                      <div className="rounded-2xl border border-[#E4E7ED] bg-white p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#858A9E]">
                          Workflow
                        </p>

                        <h3 className="mt-1 text-sm font-bold text-[#30354B]">
                          Approval status
                        </h3>

                        <div className="mt-4 space-y-4">
                          <WorkflowStep
                            active
                            title="Draft"
                            description="Bill is being prepared"
                          />

                          <WorkflowStep
                            title="Submitted"
                            description="Ready for approval"
                          />

                          <WorkflowStep
                            title="Approved"
                            description="Ready for payment"
                          />

                          <WorkflowStep
                            title="Paid"
                            description="Payment recorded"
                          />
                        </div>
                      </div>

                      {/* SAVE ACTIONS */}
                      <div className="rounded-2xl border border-[#E4E7ED] bg-white p-4">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting ? (
                            <RefreshCw
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Check size={16} />
                          )}

                          Submit for Approval
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setShowCreateModal(
                              false
                            );
                          }}
                          className="mt-2 flex w-full items-center justify-center rounded-xl border border-[#E1E4EA] bg-white px-4 py-3 text-sm font-semibold text-[#555A70] hover:bg-[#F7F8FA]"
                        >
                          Save Draft
                        </button>

                        <p className="mt-3 text-center text-[11px] leading-5 text-[#9499AA]">
                          Your bill number will be generated automatically when the bill is created.
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* BILL DETAILS */}
      {selectedPayable &&
        showDetailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101426]/50 p-4 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#ECECF3] bg-white px-6 py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#0D9488]">
                    Supplier Bill
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                    {
                      selectedPayable.invoiceNumber
                    }
                  </h2>

                  <p className="mt-1 text-sm text-[#777C93]">
                    {selectedPayable.vendor
                      ?.name ??
                      "Unknown vendor"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPayable(
                      null
                    );
                    setShowDetailsModal(
                      false
                    );
                  }}
                  className="rounded-xl p-2 text-[#777C93] hover:bg-[#F5F6F8]"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailMetric
                    label="Amount"
                    value={KES(
                      Number(
                        selectedPayable.amount
                      )
                    )}
                  />

                  <DetailMetric
                    label="Outstanding"
                    value={KES(
                      Number(
                        selectedPayable.outstandingBalance
                      )
                    )}
                  />

                  <DetailMetric
                    label="Due Date"
                    value={formatDate(
                      selectedPayable.dueDate
                    )}
                  />

                  <div className="rounded-xl bg-[#F8F9FB] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#888DA1]">
                      Payment
                    </p>

                    <div className="mt-2">
                      <PaymentStatusBadge
                        status={
                          selectedPayable.paymentStatus
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#888DA1]">
                      Vendor
                    </p>

                    <p className="mt-1.5 text-sm font-semibold text-[#30354B]">
                      {selectedPayable.vendor
                        ?.name ??
                        "Unknown vendor"}
                    </p>

                    {selectedPayable
                      .vendor?.email && (
                      <p className="mt-1 text-sm text-[#777C93]">
                        {
                          selectedPayable
                            .vendor
                            .email
                        }
                      </p>
                    )}

                    {selectedPayable
                      .vendor?.phone && (
                      <p className="mt-1 text-sm text-[#777C93]">
                        {
                          selectedPayable
                            .vendor
                            .phone
                        }
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#888DA1]">
                      Bill Status
                    </p>

                    <div className="mt-1.5">
                      <StatusBadge
                        status={
                          selectedPayable.status
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#888DA1]">
                    Description
                  </p>

                  <p className="mt-2 rounded-xl border border-[#ECECF3] bg-[#FAFBFC] p-4 text-sm leading-6 text-[#555A70]">
                    {
                      selectedPayable.description
                    }
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECF3] pt-5">
                  <div className="flex flex-wrap gap-2">
                    {selectedPayable.status ===
                      "PENDING" && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          handleApprove(
                            selectedPayable
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-[#ECFDF5] px-4 py-2.5 text-sm font-semibold text-[#047857] hover:bg-[#DDF8EC] disabled:opacity-60"
                      >
                        <Check size={16} />
                        Approve Bill
                      </button>
                    )}

                    {Number(
                      selectedPayable.outstandingBalance
                    ) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          openPaymentModal(
                            selectedPayable
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[#BFE5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F766E] hover:bg-[#F0FDFA]"
                      >
                        <CreditCard
                          size={16}
                        />
                        Record Payment
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(
                        selectedPayable
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    Delete Bill
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* PAYMENT MODAL */}
      {selectedPayable &&
        showPaymentModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#101426]/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-[#ECEEF3] px-6 py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#0D9488]">
                    Accounts Payable
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                    Record Payment
                  </h2>

                  <p className="mt-1 text-sm text-[#777C93]">
                    {
                      selectedPayable.invoiceNumber
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(
                      false
                    );
                    setSelectedPayable(
                      null
                    );
                  }}
                  className="rounded-xl p-2 text-[#777C93] hover:bg-[#F5F6F8]"
                >
                  <X size={19} />
                </button>
              </div>

              <form
                onSubmit={
                  handleRecordPayment
                }
                className="space-y-5 p-6"
              >
                <div className="rounded-xl border border-[#DCE9E6] bg-[#F6FCFA] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6F837F]">
                    Outstanding balance
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#21423D]">
                    {KES(
                      Number(
                        selectedPayable.outstandingBalance
                      )
                    )}
                  </p>
                </div>

                <FormField
                  label="Payment amount"
                  required
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#777C93]">
                      KES
                    </span>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={Number(
                        selectedPayable.outstandingBalance
                      )}
                      required
                      value={
                        paymentForm.amount
                      }
                      onChange={(event) =>
                        setPaymentForm(
                          (current) => ({
                            ...current,
                            amount:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="w-full rounded-xl border border-[#E3E6EC] bg-white py-3 pl-14 pr-4 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                    />
                  </div>
                </FormField>

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    label="Payment date"
                    required
                  >
                    <input
                      type="date"
                      required
                      value={
                        paymentForm.paymentDate
                      }
                      onChange={(event) =>
                        setPaymentForm(
                          (current) => ({
                            ...current,
                            paymentDate:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                    />
                  </FormField>

                  <FormField label="Payment method">
                    <select
                      value={
                        paymentForm.paymentMethod
                      }
                      onChange={(event) =>
                        setPaymentForm(
                          (current) => ({
                            ...current,
                            paymentMethod:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                    >
                      <option value="BANK_TRANSFER">
                        Bank transfer
                      </option>
                      <option value="MPESA">
                        M-Pesa
                      </option>
                      <option value="CASH">
                        Cash
                      </option>
                      <option value="CHEQUE">
                        Cheque
                      </option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Payment reference">
                  <input
                    type="text"
                    value={
                      paymentForm.reference
                    }
                    onChange={(event) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          reference:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="e.g. TXN-10482"
                    className="w-full rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488]"
                  />
                </FormField>

                <FormField label="Notes">
                  <textarea
                    rows={3}
                    value={
                      paymentForm.notes
                    }
                    onChange={(event) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="Optional payment notes..."
                    className="w-full resize-none rounded-xl border border-[#E3E6EC] bg-white px-4 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5] focus:border-[#0D9488]"
                  />
                </FormField>

                <div className="flex flex-col-reverse gap-3 border-t border-[#ECEEF3] pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentModal(
                        false
                      );
                      setSelectedPayable(
                        null
                      );
                    }}
                    className="rounded-xl border border-[#E1E4EA] bg-white px-5 py-2.5 text-sm font-semibold text-[#4B5065] hover:bg-[#F7F8FA]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting && (
                      <RefreshCw
                        size={15}
                        className="animate-spin"
                      />
                    )}
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#7C8196]">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-[#E3E5EC] bg-white px-3.5 py-2.5 text-sm text-[#34394F] outline-none focus:border-[#0D9488]"
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function PreviewRow({
  label,
  amount,
  currency,
  debit,
  credit,
}: {
  label: string;
  amount: number;
  currency: string;
  debit?: boolean;
  credit?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {debit && (
          <ArrowDown
            size={13}
            className="shrink-0 text-[#0D9488]"
          />
        )}

        {credit && (
          <ArrowUp
            size={13}
            className="shrink-0 text-[#64748B]"
          />
        )}

        <span className="truncate text-xs font-medium text-[#5E7772]">
          {label}
        </span>
      </div>

      <span className="shrink-0 text-xs font-bold text-[#21423D]">
        {formatCurrency(
          amount,
          currency
        )}
      </span>
    </div>
  );
}

function WorkflowStep({
  active = false,
  title,
  description,
}: {
  active?: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          active
            ? "bg-[#0D9488] text-white"
            : "border border-[#DDE2E7] bg-white text-[#A0A5B5]"
        }`}
      >
        {active ? (
          <Check size={14} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </div>

      <div>
        <p
          className={`text-sm font-semibold ${
            active
              ? "text-[#30354B]"
              : "text-[#858A9E]"
          }`}
        >
          {title}
        </p>

        <p className="mt-0.5 text-xs text-[#9A9EAE]">
          {description}
        </p>
      </div>
    </div>
  );
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#F8F9FB] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#888DA1]">
        {label}
      </p>

      <p className="mt-1.5 text-lg font-bold text-[#20243A]">
        {value}
      </p>
    </div>
  );
}

