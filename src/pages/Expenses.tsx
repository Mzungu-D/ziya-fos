import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Filter,
  Landmark,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";

import {
  approveExpense,
  createExpense,
  deleteExpense,
  fetchExpenses,
  postExpense,
  recordExpensePayment,
  submitExpense,
} from "../services/expenses";
import type { Expense } from "../services/expenses";
import { authenticatedFetch } from "../lib/auth";

interface Vendor {
  id: string;
  vendorCode?: string;
  name: string;
  status?: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BankAccount {
  id: string;
  name?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  status?: string;
}

interface ExpenseForm {
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  vendorId: string;
  expenseAccountId: string;
  paymentAccountId: string;
  bankAccountId: string;
  paymentMethod: string;
}

const CATEGORIES = [
  "Office Rent",
  "Internet & Utilities",
  "Fuel & Transport",
  "Office Supplies",
  "Salaries & Wages",
  "Professional Services",
  "Marketing & Advertising",
  "Equipment & Maintenance",
  "Travel & Accommodation",
  "Other",
];

const INITIAL_FORM: ExpenseForm = {
  category: "",
  description: "",
  amount: "",
  expenseDate: "",
  vendorId: "",
  expenseAccountId: "",
  paymentAccountId: "",
  bankAccountId: "",
  paymentMethod: "",
};

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
});
const formatDate = (value?: string | Date | null) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};
const formatCurrency = (value: number) =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

const getToday = () => new Date().toISOString().slice(0, 10);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const normalizeStatus = (status?: string) =>
  (status || "DRAFT").toUpperCase().replace(/\s+/g, "_");

const statusLabel = (status?: string) => {
  const value = normalizeStatus(status);
  if (value === "PENDING_APPROVAL" || value === "PENDING") {
    return "Pending approval";
  }
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const statusTone = (status?: string) => {
  switch (normalizeStatus(status)) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PENDING":
    case "PENDING_APPROVAL":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    case "POSTED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "PAID":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
};

const paymentTone = (status?: string) =>
  (status || "").toUpperCase() === "PAID"
    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
    : "border-slate-200 bg-slate-50 text-slate-600";

const accountLabel = (account?: Account | null) =>
  account ? `${account.code} --™-{account.name}` : "Not assigned";

const bankLabel = (bank?: BankAccount | null) => {
  if (!bank) return "Not assigned";
  const title = bank.name || bank.accountName || bank.bankName || "Bank account";
  const number = bank.accountNumber ? ` --™-{bank.accountNumber}` : "";
  return `${title}${number}`;
};

function SummaryMetric({
  title,
  value,
  detail,
  icon,
  onClick,
  active,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group min-w-0 rounded-2xl border bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition ${
        active
          ? "border-[#20243A] shadow-sm"
          : "border-[#E9EAF1] hover:border-[#D7D9E4] hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(20,24,39,0.06)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7A8097]">
            {title}
          </p>
          <p className="mt-2 min-w-0 break-words text-lg font-bold leading-tight tracking-tight text-[#20243A] sm:text-xl lg:text-[23px]">
            {value}
          </p>
          <p className="mt-1.5 text-sm leading-5 text-[#7A8097]">{detail}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F8FB] text-[#20243A] transition group-hover:bg-[#F0F2F6]">
          {icon}
        </div>
      </div>
    </button>
  );
}

function SectionTitle({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#0D9488]">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-lg font-bold tracking-tight text-[#20243A]">
          {title}
        </h2>
        {detail && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#7A8097]">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F8FB] text-[#20243A]">
        <Receipt size={22} />
      </div>
      <h3 className="mt-4 text-sm font-bold text-[#20243A]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[#7A8097]">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#20243A]">
        {label}{" "}
        {required && <span className="text-[#D14C4C]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-[#7A8097]">{hint}</p>}
    </div>
  );
}

function Workflow({
  status,
  paymentStatus,
}: {
  status: string;
  paymentStatus: string;
}) {
  const current = normalizeStatus(status);
  const steps = [
    ["DRAFT", "Draft"],
    ["PENDING_APPROVAL", "Submitted"],
    ["APPROVED", "Approved"],
    ["POSTED", "Posted"],
    ["PAID", "Paid"],
  ];

  const index =
    current === "PENDING"
      ? 1
      : current === "PENDING_APPROVAL"
        ? 1
        : current === "APPROVED"
          ? 2
          : current === "POSTED"
            ? 3
            : current === "PAID" || paymentStatus === "PAID"
              ? 4
              : 0;

  return (
    <div className="rounded-2xl border border-[#E9EAF1] bg-[#FAFBFC] p-4">
      <div className="flex items-center gap-1.5">
        {steps.map(([key, label], stepIndex) => {
          const complete = stepIndex <= index;
          const rejected =
            current === "REJECTED" && stepIndex === 1;

          return (
            <div key={key} className="flex min-w-0 flex-1 items-center gap-1.5">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  rejected
                    ? "bg-red-100 text-red-700"
                    : complete
                      ? "bg-[#20243A] text-white"
                      : "bg-white text-[#9AA0B3] ring-1 ring-inset ring-[#E3E5EC]"
                }`}
              >
                {complete && !rejected ? <Check size={13} /> : stepIndex + 1}
              </div>
              <span
                className={`hidden truncate text-[11px] font-semibold sm:block ${
                  complete ? "text-[#20243A]" : "text-[#9AA0B3]"
                }`}
              >
                {label}
              </span>
              {stepIndex < steps.length - 1 && (
                <div
                  className={`mx-1 h-px min-w-3 flex-1 ${
                    stepIndex < index ? "bg-[#20243A]" : "bg-[#E2E4EB]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-[#F0F1F5] py-3 last:border-b-0">
      <span className="shrink-0 text-xs font-medium text-[#7A8097]">{label}</span>
      <span className="min-w-0 text-right text-sm font-semibold text-[#20243A]">
        {value}
      </span>
    </div>
  );
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ExpenseForm>(INITIAL_FORM);

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentBankAccountId, setPaymentBankAccountId] = useState("");

  const loadExpenses = useCallback(async () => {
    const response = await fetchExpenses();
    setExpenses(Array.isArray(response) ? response : []);
  }, []);

  const loadSupportingData = useCallback(async () => {
    const requests = await Promise.allSettled([
      authenticatedFetch("/api/vendors", {
        headers: { Accept: "application/json" },
      }),
      authenticatedFetch("/api/accounts", {
        headers: { Accept: "application/json" },
      }),
      authenticatedFetch("/api/bank-accounts", {
        headers: { Accept: "application/json" },
      }),
    ]);

    const vendorResponse = requests[0];
    if (vendorResponse.status === "fulfilled" && vendorResponse.value.ok) {
      const data = await vendorResponse.value.json();
      const list = Array.isArray(data?.vendors) ? data.vendors : [];
      setVendors(
        list.filter(
          (vendor: Vendor) =>
            !vendor.status || vendor.status.toUpperCase() === "ACTIVE"
        )
      );
    }

    const accountResponse = requests[1];
    if (accountResponse.status === "fulfilled" && accountResponse.value.ok) {
      const data = await accountResponse.value.json();
      setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
    }

    const bankResponse = requests[2];
    if (bankResponse.status === "fulfilled" && bankResponse.value.ok) {
      const data = await bankResponse.value.json();
      const list = Array.isArray(data?.bankAccounts)
        ? data.bankAccounts
        : Array.isArray(data?.accounts)
          ? data.accounts
          : [];
      setBankAccounts(list);
    }
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([loadExpenses(), loadSupportingData()]);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load the Expenses workspace."));
    } finally {
      setLoading(false);
    }
  }, [loadExpenses, loadSupportingData]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const expenseAccounts = useMemo(
    () =>
      accounts
        .filter((account) => account.type.toUpperCase() === "EXPENSE")
        .sort((a, b) => a.code.localeCompare(b.code)),
    [accounts]
  );

  const paymentAccounts = useMemo(
    () =>
      accounts
        .filter((account) =>
          ["ASSET", "LIABILITY"].includes(account.type.toUpperCase())
        )
        .sort((a, b) => a.code.localeCompare(b.code)),
    [accounts]
  );

  const categories = useMemo(
    () =>
      [...new Set(expenses.map((expense) => expense.category).filter(Boolean))].sort(),
    [expenses]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "PENDING_APPROVAL"
          ? status === "PENDING_APPROVAL" || status === "PENDING"
          : status === statusFilter);

      const matchCategory =
        categoryFilter === "ALL" || expense.category === categoryFilter;

      const searchable = [
        expense.expenseCode,
        expense.category,
        expense.description,
        expense.vendor?.name,
        expense.vendor?.vendorCode,
        expense.status,
        expense.paymentStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchStatus && matchCategory && (!term || searchable.includes(term));
    });
  }, [expenses, search, statusFilter, categoryFilter]);

  const summary = useMemo(() => {
    const total = expenses.reduce(
      (sum, expense) => sum + (Number(expense.amount) || 0),
      0
    );

    const pending = expenses
      .filter(() => {
        return status === "PENDING" || status === "PENDING_APPROVAL";
      })
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    const approved = expenses
      .filter((expense) => normalizeStatus(expense.status) === "APPROVED")
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    const posted = expenses
      .filter((expense) =>
        ["POSTED", "PAID"].includes(normalizeStatus(expense.status))
      )
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    const paid = expenses
      .filter(
        (expense) =>
          (expense.paymentStatus || "").toUpperCase() === "PAID" ||
          normalizeStatus(expense.status) === "PAID"
      )
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    return {
      total,
      pending,
      approved,
      posted,
      paid,
      pendingCount: expenses.filter(() => {
        return status === "PENDING" || status === "PENDING_APPROVAL";
      }).length,
      approvedCount: expenses.filter(
        (expense) => normalizeStatus(expense.status) === "APPROVED"
      ).length,
      postedCount: expenses.filter((expense) =>
        ["POSTED", "PAID"].includes(normalizeStatus(expense.status))
      ).length,
      paidCount: expenses.filter(
        (expense) =>
          (expense.paymentStatus || "").toUpperCase() === "PAID" ||
          normalizeStatus(expense.status) === "PAID"
      ).length,
    };
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const values = new Map<string, number>();

    expenses.forEach((expense) => {
      values.set(
        expense.category,
        (values.get(expense.category) || 0) + (Number(expense.amount) || 0)
      );
    });

    return [...values.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [expenses]);

  const largestCategory = categoryBreakdown[0];
  const approvalQueue = expenses.filter(() => {
    return status === "PENDING" || status === "PENDING_APPROVAL";
  });

  const updateForm = <K extends keyof ExpenseForm>(
    key: K,
    value: ExpenseForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openForm = () => {
    setError("");
    setSuccessMessage("");
    setStep(1);
    setForm({
      ...INITIAL_FORM,
      expenseDate: getToday(),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setStep(1);
    setForm(INITIAL_FORM);
    setError("");
  };

  const handleNext = () => {
    setError("");

    if (step === 1) {
      const amount = Number(form.amount);

      if (!form.category) {
        setError("Select an expense category.");
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter an amount greater than zero.");
        return;
      }
      if (!form.expenseDate) {
        setError("Expense date is required.");
        return;
      }
      if (!form.description.trim()) {
        setError("Add a clear description for the expense.");
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (!form.expenseAccountId) {
        setError("Select the expense account.");
        return;
      }
      setStep(3);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccessMessage("");

    const amount = Number(form.amount);

    if (!form.expenseAccountId) {
      setError("Select the expense account before saving.");
      setStep(2);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than zero.");
      setStep(1);
      return;
    }

    try {
      setSaving(true);

      const response = await createExpense({
        category: form.category,
        description: form.description.trim(),
        amount,
        expenseDate: form.expenseDate,
        vendorId: form.vendorId || undefined,
        expenseAccountId: form.expenseAccountId,
        paymentAccountId: form.paymentAccountId || undefined,
        bankAccountId: form.bankAccountId || undefined,
        paymentMethod: form.paymentMethod || undefined,
      });

      setExpenses((current) => [response, ...current]);
      setShowForm(false);
      setStep(1);
      setForm(INITIAL_FORM);
      setSuccessMessage(`${response.expenseCode} saved as a draft.`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to record the expense."));
    } finally {
      setSaving(false);
    }
  };

  const runApprovalAction = async (expense: Expense) => {
    if (busyId) return;

    if (!expense.approvalId) {
      setError("This expense does not have a linked approval request.");
      return;
    }

    setBusyId(expense.id);
    setError("");
    setSuccessMessage("");

    try {
      await approveExpense(expense.approvalId);
      await loadExpenses();

      const approvedExpense: Expense = {
        ...expense,
        status: "APPROVED",
        approval: expense.approval
          ? {
              ...expense.approval,
              status: "APPROVED",
            }
          : expense.approval,
      };

      setExpenses((current) =>
        current.map((item) =>
          item.id === expense.id ? approvedExpense : item
        )
      );

      setSelectedExpense(approvedExpense);

      setSuccessMessage(
        `${expense.expenseCode} approved and ready to post to the General Ledger.`
      );
    } catch (err) {
      setError(getErrorMessage(err, "Unable to approve this expense."));
    } finally {
      setBusyId("");
    }
  };
  const runExpenseAction = async (
    expense: Expense,
    action: "submit" | "post"
  ) => {
    if (busyId) return;

    setBusyId(expense.id);
    setError("");
    setSuccessMessage("");

    try {
      if (action === "submit") {
        const response = await submitExpense(expense.id);
        setExpenses((current) =>
          current.map((item) => (item.id === expense.id ? response : item))
        );
        setSelectedExpense(response);
        setSuccessMessage(`${expense.expenseCode} submitted for approval.`);
      } else {
        await postExpense(expense.id);
        await loadExpenses();
        setSelectedExpense((current) =>
          current?.id === expense.id
            ? { ...current, status: "POSTED" }
            : current
        );
        setSuccessMessage(`${expense.expenseCode} posted to the General Ledger.`);
      }
    } catch (err) {
      setError(getErrorMessage(err, `Unable to ${action} this expense.`));
    } finally {
      setBusyId("");
    }
  };

  const runDelete = async (expense: Expense) => {
    if (busyId) return;

    setBusyId(expense.id);
    setError("");
    setSuccessMessage("");

    try {
      await deleteExpense(expense.id);
      setExpenses((current) => current.filter((item) => item.id !== expense.id));
      if (selectedExpense?.id === expense.id) {
        setSelectedExpense(null);
      }
      setSuccessMessage(`${expense.expenseCode} deleted.`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete the draft expense."));
    } finally {
      setBusyId("");
    }
  };

  const openPayment = (expense: Expense) => {
    setSelectedExpense(expense);
    setPaymentDate(getToday());
    setPaymentReference("");
    setPaymentMethod(expense.paymentMethod || "");
    setPaymentBankAccountId(expense.bankAccountId || "");
    setShowPayment(true);
  };

  const handlePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedExpense || busyId) return;

    setBusyId(selectedExpense.id);
    setError("");

    try {
      const response = await recordExpensePayment(selectedExpense.id, {
        paymentDate,
        paymentReference: paymentReference.trim(),
        paymentMethod: paymentMethod,
        bankAccountId: paymentBankAccountId || undefined,
      });

      setExpenses((current) =>
        current.map((item) =>
          item.id === selectedExpense.id ? response : item
        )
      );
      setSelectedExpense(response);
      setShowPayment(false);
      setSuccessMessage(
        `${selectedExpense.expenseCode} payment recorded successfully.`
      );
    } catch (err) {
      setError(getErrorMessage(err, "Unable to record the payment."));
    } finally {
      setBusyId("");
    }
  };

  const handleExport = () => {
    if (!filtered.length) return;

    const headers = [
      "Expense Code",
      "Category",
      "Description",
      "Vendor",
      "Expense Account",
      "Payment Account",
      "Amount (KES)",
      "Date",
      "Status",
      "Payment Status",
    ];

    const rows = filtered.map((expense) => [
      expense.expenseCode,
      expense.category,
      expense.description || "",
      expense.vendor?.name || "",
      accountLabel(expense.expenseAccount),
      accountLabel(expense.paymentAccount),
      Number(expense.amount).toFixed(2),
      formatDate(expense.expenseDate),
      statusLabel(expense.status),
      expense.paymentStatus || "UNPAID",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const activeDetail = selectedExpense;

  return (
    <div className="min-w-0 space-y-7 pb-8">
      <header className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7A8097]">
            <span>Business Operations</span>
            <span className="h-1 w-1 rounded-full bg-[#B7BBC8]" />
            <span>Spend management</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#20243A] sm:text-4xl">
            Expenses
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7A8097] sm:text-base">
            Capture business spending, route it for approval, and keep every
            posted expense connected to the accounting ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!filtered.length || loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E6ED] bg-white px-4 text-sm font-semibold text-[#596077] transition hover:border-[#D4D6E0] hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={17} />
            Export
          </button>
          <button
            type="button"
            onClick={() => void loadPage()}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E6ED] bg-white px-4 text-sm font-semibold text-[#596077] transition hover:border-[#D4D6E0] hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openForm}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0B7A70]"
          >
            <Plus size={18} />
            Record expense
          </button>
        </div>
      </header>

      {(error || successMessage) && (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span className="min-w-0 flex-1">{error || successMessage}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccessMessage("");
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetric
          title="Total spend"
          value={formatCurrency(summary.total)}
          detail={`${expenses.length} recorded expenses`}
          icon={<Wallet size={19} />}
        />
        <SummaryMetric
          title="Pending"
          value={formatCurrency(summary.pending)}
          detail={`${summary.pendingCount} awaiting approval`}
          icon={<Clock3 size={19} />}
          onClick={() => setStatusFilter("PENDING_APPROVAL")}
          active={statusFilter === "PENDING_APPROVAL"}
        />
        <SummaryMetric
          title="Approved"
          value={formatCurrency(summary.approved)}
          detail={`${summary.approvedCount} ready to post`}
          icon={<CheckCircle2 size={19} />}
          onClick={() => setStatusFilter("APPROVED")}
          active={statusFilter === "APPROVED"}
        />
        <SummaryMetric
          title="Posted"
          value={formatCurrency(summary.posted)}
          detail={`${summary.postedCount} in the ledger`}
          icon={<FileText size={19} />}
          onClick={() => setStatusFilter("POSTED")}
          active={statusFilter === "POSTED"}
        />
        <SummaryMetric
          title="Paid"
          value={formatCurrency(summary.paid)}
          detail={`${summary.paidCount} payment records`}
          icon={<CreditCard size={19} />}
          onClick={() => setStatusFilter("PAID")}
          active={statusFilter === "PAID"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-5 sm:p-6">
          <SectionTitle
            eyebrow="Financial overview"
            title="Where is spend going?"
            detail="Top expense categories from the current organization dataset."
          />

          <div className="mt-6">
            {categoryBreakdown.length ? (
              <div className="space-y-5">
                {categoryBreakdown.map(([category, amount]) => {
                  const percentage =
                    largestCategory && largestCategory[1] > 0
                      ? Math.round((amount / largestCategory[1]) * 100)
                      : 0;

                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between gap-4">
                        <span className="min-w-0 truncate text-sm font-semibold text-[#34394F]">
                          {category}
                        </span>
                        <span className="whitespace-nowrap shrink-0 text-sm font-bold text-[#20243A]">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F0F1F5]">
                        <div
                          className="h-full rounded-full bg-[#20243A] transition-all"
                          style={{ width: `${Math.max(6, percentage)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No spend data yet"
                detail="Recorded expenses will appear here by category."
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-5 sm:p-6">
          <SectionTitle
            eyebrow="Approval queue"
            title="Needs attention"
            detail="Expenses currently waiting for review."
            action={
              approvalQueue.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setStatusFilter("PENDING_APPROVAL")}
                  className="text-xs font-bold text-[#0D9488] hover:underline"
                >
                  View all
                </button>
              ) : undefined
            }
          />

          <div className="mt-5">
            {approvalQueue.length ? (
              <div className="space-y-2">
                {approvalQueue.slice(0, 4).map((expense) => (
                  <button
                    type="button"
                    key={expense.id}
                    onClick={() => setSelectedExpense(expense)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-left transition hover:border-[#E9EAF1] hover:bg-[#FAFBFC]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <Clock3 size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#20243A]">
                        {expense.description}
                      </p>
                      <p className="mt-0.5 text-xs text-[#7A8097]">
                        {expense.expenseCode} --™-{formatDate(expense.expenseDate)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap shrink-0 text-sm font-bold text-[#20243A]">
                      {formatCurrency(Number(expense.amount) || 0)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-[#F8F9FB] p-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600">
                    <CheckCircle2 size={19} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#20243A]">
                      Approval queue is clear
                    </p>
                    <p className="mt-0.5 text-xs text-[#7A8097]">
                      No expenses are waiting for review.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E9EAF1] bg-white">
        <div className="border-b border-[#ECEEF3] p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-[#E3E5EC] bg-[#FBFCFD] px-3 transition focus-within:border-[#0D9488] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0D9488]/10">
              <Search size={18} className="shrink-0 text-[#8A90A5]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search expenses, vendors, codes or descriptions"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[#20243A] outline-none placeholder:text-[#A0A5B5]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-lg p-1 text-[#7A8097] hover:bg-[#F0F1F5]"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0">
                <Filter
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#E3E5EC] bg-white pl-9 pr-9 text-sm font-medium text-[#596077] outline-none focus:border-[#20243A] sm:w-48"
                >
                  <option value="ALL">All statuses</option>
                  <option value="PENDING_APPROVAL">Pending approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="POSTED">Posted</option>
                  <option value="PAID">Paid</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="DRAFT">Draft</option>
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />
              </div>

              <div className="relative min-w-0">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#E3E5EC] bg-white px-3 pr-9 text-sm font-medium text-[#596077] outline-none focus:border-[#20243A] sm:w-52"
                >
                  <option value="ALL">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[#20243A]" />
            <p className="mt-3 text-sm text-[#7A8097]">
              Loading your expense workspace...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={expenses.length ? "No matching expenses" : "No expenses recorded"}
            detail={
              expenses.length
                ? "Try another search term or filter."
                : "Record the first expense to start building your organization spend history."
            }
            action={
              !expenses.length ? (
                <button
                  type="button"
                  onClick={openForm}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-4 text-sm font-bold text-white"
                >
                  <Plus size={17} />
                  Record first expense
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-[#ECEEF3] bg-[#F8F9FB]">
                    <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A8097]">
                      Expense
                    </th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A8097]">
                      Category
                    </th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A8097]">
                      Vendor
                    </th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A8097]">
                      Accounting
                    </th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A8097]">
                      Amount
                    </th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A8097]">
                      Status
                    </th>
                    <th className="w-12 px-3 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense) => {
                      (expense.paymentStatus || "").toUpperCase() !== "PAID";

                    return (
                      <tr
                        key={expense.id}
                        className="group border-b border-[#F0F1F5] last:border-b-0 transition-colors hover:bg-[#F7F9FA]"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedExpense(expense)}
                            className="min-w-0 text-left"
                          >
                            <p className="font-mono text-xs font-bold text-[#20243A]">
                              {expense.expenseCode}
                            </p>
                            <p className="mt-1 max-w-[300px] truncate font-semibold text-[#34394F]">
                              {expense.description}
                            </p>
                            <p className="mt-1 text-xs text-[#8A90A5]">
                              {formatDate(expense.expenseDate)}
                            </p>
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-medium text-[#4D5369]">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="max-w-[180px]">
                            <p className="truncate font-medium text-[#4D5369]">
                              {expense.vendor?.name || "No vendor"}
                            </p>
                            {expense.vendor?.vendorCode && (
                              <p className="mt-0.5 text-xs text-[#8A90A5]">
                                {expense.vendor.vendorCode}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="max-w-[220px]">
                            <p className="truncate text-xs font-semibold text-[#4D5369]">
                              {accountLabel(expense.expenseAccount)}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#8A90A5]">
                              {expense.journalEntryId
                                ? "Journal entry linked"
                                : "Not posted to ledger"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="whitespace-nowrap font-bold tabular-nums text-[#20243A]">
                            {formatCurrency(Number(expense.amount) || 0)}
                          </p>
                          <p className="mt-1 text-[11px] text-[#8A90A5]">
                            {expense.currency || "KES"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(
                                expense.status
                              )}`}
                            >
                              {statusLabel(expense.status)}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${paymentTone(
                                expense.paymentStatus
                              )}`}
                            >
                              {(expense.paymentStatus || "UNPAID").toLowerCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedExpense(expense)}
                            className="rounded-lg p-2 text-[#7A8097] hover:bg-[#F0F1F5] hover:text-[#20243A]"
                            aria-label={`Open ${expense.expenseCode}`}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#F0F1F5] lg:hidden">
              {filtered.map((expense) => (
                <button
                  type="button"
                  key={expense.id}
                  onClick={() => setSelectedExpense(expense)}
                  className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-[#FBFCFD]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F8FB] text-[#20243A]">
                    <Receipt size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-bold text-[#20243A]">
                          {expense.expenseCode}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-[#34394F]">
                          {expense.description}
                        </p>
                      </div>
                      <span className="whitespace-nowrap shrink-0 text-sm font-bold text-[#20243A]">
                        {formatCurrency(Number(expense.amount) || 0)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#7A8097]">
                        {expense.category}
                      </span>
                      <span className="text-[#C2C5D0]">--™-</span>
                      <span className="text-xs text-[#7A8097]">
                        {formatDate(expense.expenseDate)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(
                          expense.status
                        )}`}
                      >
                        {statusLabel(expense.status)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-[#ECEEF3] px-5 py-3 text-xs text-[#8A90A5]">
              Showing {filtered.length} of {expenses.length} expenses
            </div>
          </>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111525]/60 p-0 backdrop-blur-sm sm:p-4 lg:p-6">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)] sm:rounded-[24px]">
            {/* Modal header */}
            <div className="shrink-0 border-b border-[#EAECF1] bg-white">
              <div className="flex items-start justify-between gap-5 px-5 py-5 sm:px-7 sm:py-6">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E8F7F5] text-[#0D9488]">
                    <Receipt size={21} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#0D9488]">
                      Expense management
                    </p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#20243A] sm:text-2xl">
                      Record new expense
                    </h2>
                    <p className="mt-1 text-sm text-[#7A8097]">
                      Capture the transaction and prepare it for approval.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  aria-label="Close expense form"
                  className="shrink-0 rounded-xl p-2.5 text-[#7A8097] transition hover:bg-[#F4F5F8] hover:text-[#20243A] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/10 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Step navigation */}
              <div className="px-5 pb-5 sm:px-7 sm:pb-6">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["1", "Expense details", "Transaction information"],
                    ["2", "Accounting", "Ledger treatment"],
                    ["3", "Review", "Confirm & save"],
                  ].map(([number, label, detail], index) => {
                    const active = step === index + 1;
                    const complete = step > index + 1;

                    return (
                      <div
                        key={number}
                        className={`relative rounded-2xl border px-3 py-3 transition sm:px-4 ${
                          active
                            ? "border-[#B8E4DE] bg-[#F0FBF9]"
                            : complete
                              ? "border-[#DDEBE8] bg-[#F8FCFB]"
                              : "border-[#ECEEF3] bg-[#FAFBFC]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              active || complete
                                ? "bg-[#0D9488] text-white"
                                : "bg-white text-[#9AA0B3] ring-1 ring-inset ring-[#E1E4EB]"
                            }`}
                          >
                            {complete ? <Check size={14} /> : number}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`truncate text-xs font-bold ${
                                active || complete ? "text-[#20243A]" : "text-[#596077]"
                              }`}
                            >
                              {label}
                            </p>
                            <p className="mt-0.5 hidden truncate text-[11px] text-[#8A90A5] sm:block">
                              {detail}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <form onSubmit={handleCreate} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
                {step === 1 && (
                  <div className="space-y-7">
                    <div>
                      <p className="text-lg font-extrabold tracking-tight text-[#20243A]">
                        Expense details
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#7A8097]">
                        Start with the basic information about the business expense.
                      </p>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
                      <div className="space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Category" required>
                            <select
                              value={form.category}
                              onChange={(event) => updateForm("category", event.target.value)}
                              disabled={saving}
                              className="h-12 w-full rounded-xl border border-[#DDE0E8] bg-white px-4 text-sm font-medium text-[#20243A] shadow-[0_1px_2px_rgba(20,24,39,0.03)] outline-none transition hover:border-[#C9CDD8] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                            >
                              <option value="">Select category</option>
                              {CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Expense date" required>
                            <div className="relative">
                              <CalendarDays
                                size={17}
                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A90A5]"
                              />
                              <input
                                type="date"
                                value={form.expenseDate}
                                onChange={(event) => updateForm("expenseDate", event.target.value)}
                                disabled={saving}
                                className="h-12 w-full rounded-xl border border-[#DDE0E8] bg-white pl-11 pr-4 text-sm font-medium text-[#20243A] shadow-[0_1px_2px_rgba(20,24,39,0.03)] outline-none transition hover:border-[#C9CDD8] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                              />
                            </div>
                          </Field>
                        </div>

                        <Field label="Vendor" hint="Optional. Select a supplier when the expense relates to one.">
                          <select
                            value={form.vendorId}
                            onChange={(event) => updateForm("vendorId", event.target.value)}
                            disabled={saving}
                            className="h-12 w-full rounded-xl border border-[#DDE0E8] bg-white px-4 text-sm font-medium text-[#20243A] shadow-[0_1px_2px_rgba(20,24,39,0.03)] outline-none transition hover:border-[#C9CDD8] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                          >
                            <option value="">No vendor</option>
                            {vendors.map((vendor) => (
                              <option key={vendor.id} value={vendor.id}>
                                {vendor.name}
                                {vendor.vendorCode ? ` --™-{vendor.vendorCode}` : ""}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field
                          label="Description"
                          required
                          hint="Use a clear business description. This will be visible during approval."
                        >
                          <textarea
                            rows={4}
                            value={form.description}
                            onChange={(event) => updateForm("description", event.target.value)}
                            disabled={saving}
                            placeholder="What was this expense for?"
                            className="w-full resize-none rounded-xl border border-[#DDE0E8] bg-white px-4 py-3 text-sm leading-6 text-[#20243A] shadow-[0_1px_2px_rgba(20,24,39,0.03)] outline-none transition placeholder:text-[#A0A5B5] hover:border-[#C9CDD8] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                          />
                        </Field>
                      </div>

                      {/* Amount emphasis */}
                      <div className="rounded-2xl border border-[#DDEBE8] bg-[#F7FCFB] p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#0D9488]">
                              Transaction amount
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#20243A]">
                              How much was spent?
                            </p>
                          </div>
                          <Wallet size={19} className="text-[#0D9488]" />
                        </div>

                        <div className="mt-6">
                          <div className="flex h-16 overflow-hidden rounded-2xl border border-[#CFE5E1] bg-white shadow-[0_4px_14px_rgba(13,148,136,0.06)] transition focus-within:border-[#0D9488] focus-within:ring-4 focus-within:ring-[#0D9488]/10">
                            <div className="flex min-w-[68px] items-center justify-center border-r border-[#E5E9ED] bg-[#F1F7F6] px-4 text-sm font-extrabold tracking-wide text-[#596077]">
                              KES
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={form.amount}
                              onChange={(event) => updateForm("amount", event.target.value)}
                              disabled={saving}
                              placeholder="0.00"
                              className="min-w-0 flex-1 bg-transparent px-4 text-2xl font-extrabold tabular-nums text-[#20243A] outline-none placeholder:text-[#B4B8C4]"
                              aria-label="Expense amount"
                            />
                          </div>
                          <p className="mt-3 text-xs leading-5 text-[#7A8097]">
                            Enter the exact transaction value in Kenyan shillings.
                          </p>
                        </div>

                        <div className="mt-7 rounded-xl border border-[#E4ECEA] bg-white/80 p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#0D9488]" />
                            <div>
                              <p className="text-xs font-bold text-[#20243A]">
                                Draft first
                              </p>
                              <p className="mt-1 text-xs leading-5 text-[#7A8097]">
                                Saving creates a draft. You can review it and submit it for approval afterward.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-7">
                    <div>
                      <p className="text-lg font-extrabold tracking-tight text-[#20243A]">
                        Accounting treatment
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#7A8097]">
                        Choose the real Chart of Accounts relationships that will be used when this expense is posted.
                      </p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-[#E4E7ED] bg-[#FAFBFC] p-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#20243A] shadow-sm ring-1 ring-inset ring-[#E6E8EE]">
                              <Landmark size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#20243A]">
                                Expense recognition
                              </p>
                              <p className="mt-1 text-xs leading-5 text-[#7A8097]">
                                The expense account is debited when the transaction is posted to the General Ledger.
                              </p>
                            </div>
                          </div>
                        </div>

                        <Field
                          label="Expense account"
                          required
                          hint="Only accounts returned by the organization as EXPENSE accounts are available."
                        >
                          <select
                            value={form.expenseAccountId}
                            onChange={(event) => updateForm("expenseAccountId", event.target.value)}
                            disabled={saving}
                            className="h-12 w-full rounded-xl border border-[#DDE0E8] bg-white px-4 text-sm font-medium text-[#20243A] shadow-[0_1px_2px_rgba(20,24,39,0.03)] outline-none transition hover:border-[#C9CDD8] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                          >
                            <option value="">Select expense account</option>
                            {expenseAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.code} --™-{account.name}
                              </option>
                            ))}
                          </select>
                          {!expenseAccounts.length && (
                            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
                              <AlertCircle size={16} className="mt-0.5 shrink-0" />
                              <span>
                                No expense accounts are currently available in the organization Chart of Accounts.
                              </span>
                            </div>
                          )}
                        </Field>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field
                            label="Payment / credit account"
                            hint="Can be selected now or before posting."
                          >
                            <select
                              value={form.paymentAccountId}
                              onChange={(event) => updateForm("paymentAccountId", event.target.value)}
                              disabled={saving}
                              className="h-12 w-full rounded-xl border border-[#DDE0E8] bg-white px-4 text-sm font-medium text-[#20243A] shadow-[0_1px_2px_rgba(20,24,39,0.03)] outline-none transition hover:border-[#C9CDD8] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                            >
                              <option value="">Select later</option>
                              {paymentAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.code} --™-{account.name}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field
                            label="Bank account"
                            hint="Used when recording the eventual settlement."
                          >
                            <select
                              value={form.bankAccountId}
                              onChange={(event) => updateForm("bankAccountId", event.target.value)}
                              disabled={saving}
                              className="h-12 w-full rounded-xl border border-[#DDE0E8] bg-white px-4 text-sm font-medium text-[#20243A] shadow-[0_1px_2px_rgba(20,24,39,0.03)] outline-none transition hover:border-[#C9CDD8] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                            >
                              <option value="">Select later</option>
                              {bankAccounts.map((bank) => (
                                <option key={bank.id} value={bank.id}>
                                  {bankLabel(bank)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <Field
                          label="Payment method"
                          hint="Optional while the expense remains a draft."
                        >
                          <select
                            value={form.paymentMethod}
                            onChange={(event) => updateForm("paymentMethod", event.target.value)}
                            disabled={saving}
                            className="h-12 w-full rounded-xl border border-[#DDE0E8] bg-white px-4 text-sm font-medium text-[#20243A] shadow-[0_1px_2px_rgba(20,24,39,0.03)] outline-none transition hover:border-[#C9CDD8] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                          >
                            <option value="">Select later</option>
                            <option value="BANK_TRANSFER">Bank transfer</option>
                            <option value="MPESA">M-Pesa</option>
                            <option value="CASH">Cash</option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </Field>
                      </div>

                      {/* Live accounting preview */}
                      <div className="h-fit rounded-2xl border border-[#DDE2EA] bg-[#20243A] p-5 text-white shadow-[0_12px_30px_rgba(32,36,58,0.14)] lg:sticky lg:top-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8FD9D1]">
                              Posting preview
                            </p>
                            <p className="mt-1 text-base font-bold">Double-entry treatment</p>
                          </div>
                          <BarChart3 size={19} className="text-[#8FD9D1]" />
                        </div>

                        <div className="mt-6 space-y-3">
                          <div className="rounded-xl bg-white/8 p-3.5 ring-1 ring-inset ring-white/10">
                            <div className="flex items-center justify-between gap-3">
                              <span className="rounded-md bg-[#8FD9D1]/15 px-2 py-1 text-[10px] font-extrabold tracking-wider text-[#8FD9D1]">
                                DEBIT
                              </span>
                              <span className="text-sm font-bold tabular-nums">
                                {formatCurrency(Number(form.amount) || 0)}
                              </span>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-white/65">
                              {accountLabel(
                                expenseAccounts.find(
                                  (account) => account.id === form.expenseAccountId
                                )
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/8 p-3.5 ring-1 ring-inset ring-white/10">
                            <div className="flex items-center justify-between gap-3">
                              <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-extrabold tracking-wider text-white/70">
                                CREDIT
                              </span>
                              <span className="text-sm font-bold tabular-nums">
                                {formatCurrency(Number(form.amount) || 0)}
                              </span>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-white/65">
                              {accountLabel(
                                paymentAccounts.find(
                                  (account) => account.id === form.paymentAccountId
                                )
                              )}
                            </p>
                          </div>
                        </div>

                        {!form.paymentAccountId && (
                          <div className="mt-4 rounded-xl bg-amber-300/10 p-3.5 text-xs leading-5 text-amber-100 ring-1 ring-inset ring-amber-200/15">
                            A credit account has not been selected yet. The draft can still be saved, but a payment / credit account is required before posting.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-7">
                    <div>
                      <p className="text-lg font-extrabold tracking-tight text-[#20243A]">
                        Review expense
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#7A8097]">
                        Confirm the details below. Saving creates a draft and does not post anything to the ledger.
                      </p>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
                      <div className="rounded-2xl border border-[#E4E7ED] bg-white shadow-[0_4px_18px_rgba(20,24,39,0.04)]">
                        <div className="border-b border-[#ECEEF3] px-5 py-4">
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0D9488]">
                            Transaction
                          </p>
                          <p className="mt-1 text-sm font-bold text-[#20243A]">
                            Expense details
                          </p>
                        </div>

                        <div className="p-5">
                          <div className="flex flex-col gap-4 rounded-2xl bg-[#F8F9FB] p-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#7A8097]">
                                Description
                              </p>
                              <p className="mt-1 text-base font-bold leading-6 text-[#20243A]">
                                {form.description || "Untitled expense"}
                              </p>
                            </div>
                            <div className="shrink-0 sm:text-right">
                              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8A90A5]">
                                Amount
                              </p>
                              <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#20243A]">
                                {formatCurrency(Number(form.amount) || 0)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <DetailRow label="Category" value={form.category || "-Å¡--’---"} />
                            <DetailRow label="Expense date" value={formatDate(form.expenseDate)} />
                            <DetailRow
                              label="Vendor"
                              value={
                                vendors.find((vendor) => vendor.id === form.vendorId)?.name ||
                                "No vendor"
                              }
                            />
                            <DetailRow
                              label="Expense account"
                              value={accountLabel(
                                expenseAccounts.find(
                                  (account) => account.id === form.expenseAccountId
                                )
                              )}
                            />
                            <DetailRow
                              label="Payment / credit"
                              value={accountLabel(
                                paymentAccounts.find(
                                  (account) => account.id === form.paymentAccountId
                                )
                              )}
                            />
                            <DetailRow
                              label="Bank account"
                              value={bankLabel(
                                bankAccounts.find(
                                  (bank) => bank.id === form.bankAccountId
                                )
                              )}
                            />
                            <DetailRow
                              label="Payment method"
                              value={form.paymentMethod || "Not specified"}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-[#DDEBE8] bg-[#F2FAF8] p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0D9488] shadow-sm">
                              <CheckCircle2 size={19} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#20243A]">
                                Ready to save
                              </p>
                              <p className="mt-0.5 text-xs text-[#7A8097]">
                                This expense will be created as a draft.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#DDE2EA] bg-[#20243A] p-5 text-white">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8FD9D1]">
                                Accounting preview
                              </p>
                              <p className="mt-1 text-sm font-bold">When posted</p>
                            </div>
                            <Landmark size={18} className="text-[#8FD9D1]" />
                          </div>

                          <div className="mt-5 space-y-2">
                            <div className="flex items-start justify-between gap-4 rounded-xl bg-white/8 p-3 ring-1 ring-inset ring-white/10">
                              <div>
                                <p className="text-[10px] font-extrabold text-[#8FD9D1]">DR</p>
                                <p className="mt-1 text-xs leading-5 text-white/70">
                                  {accountLabel(
                                    expenseAccounts.find(
                                      (account) => account.id === form.expenseAccountId
                                    )
                                  )}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-bold tabular-nums">
                                {formatCurrency(Number(form.amount) || 0)}
                              </p>
                            </div>

                            <div className="flex items-start justify-between gap-4 rounded-xl bg-white/8 p-3 ring-1 ring-inset ring-white/10">
                              <div>
                                <p className="text-[10px] font-extrabold text-white/60">CR</p>
                                <p className="mt-1 text-xs leading-5 text-white/70">
                                  {accountLabel(
                                    paymentAccounts.find(
                                      (account) => account.id === form.paymentAccountId
                                    )
                                  )}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-bold tabular-nums">
                                {formatCurrency(Number(form.amount) || 0)}
                              </p>
                            </div>
                          </div>

                          {!form.paymentAccountId && (
                            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-300/10 p-3 text-xs leading-5 text-amber-100 ring-1 ring-inset ring-amber-200/15">
                              <AlertCircle size={15} className="mt-0.5 shrink-0" />
                              <span>
                                The credit account can be assigned later before posting.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={17} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Sticky actions */}
              <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-3 border-t border-[#ECEEF3] bg-white/95 px-5 py-4 shadow-[0_-8px_24px_rgba(20,24,39,0.06)] backdrop-blur sm:px-8">
                <button
                  type="button"
                  onClick={step === 1 ? closeForm : () => setStep((current) => current - 1)}
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE0E8] bg-white px-4 text-sm font-bold text-[#596077] shadow-sm transition hover:border-[#C9CDD8] hover:bg-[#F8F9FB] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/10 disabled:opacity-50"
                >
                  <ArrowLeft size={16} />
                  {step === 1 ? "Cancel" : "Back"}
                </button>

                <div className="flex items-center gap-3">
                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={saving}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#20243A] px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-px hover:bg-[#171B2D] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#20243A]/15 disabled:opacity-50"
                    >
                      Continue
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(13,148,136,0.2)] transition hover:-translate-y-px hover:bg-[#0B7A70] hover:shadow-[0_9px_24px_rgba(13,148,136,0.24)] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Check size={17} />
                      )}
                      {saving ? "Saving draft..." : "Save draft"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#141827]/35 backdrop-blur-[2px]">
          <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-[#ECEEF3] bg-white px-5 py-5 sm:px-8 sm:py-6">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-[#7A8097]">
                  {activeDetail.expenseCode}
                </p>
                <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-[#20243A]">
                  {activeDetail.description}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(
                      activeDetail.status
                    )}`}
                  >
                    {statusLabel(activeDetail.status)}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${paymentTone(
                      activeDetail.paymentStatus
                    )}`}
                  >
                    {(activeDetail.paymentStatus || "UNPAID").toLowerCase()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="shrink-0 rounded-xl p-2 text-[#7A8097] hover:bg-[#F4F5F8] hover:text-[#20243A]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-7 p-5 sm:p-7">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7A8097]">
                    Amount
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                    {formatCurrency(Number(activeDetail.amount) || 0)}
                  </p>
                  <p className="mt-1 text-xs text-[#8A90A5]">
                    {formatDate(activeDetail.expenseDate)} --™-{activeDetail.category}
                  </p>
                </div>

                <Workflow
                  status={activeDetail.status}
                  paymentStatus={activeDetail.paymentStatus || "UNPAID"}
                />

                <div className="flex flex-wrap gap-2">
                  {normalizeStatus(activeDetail.status) === "DRAFT" && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === activeDetail.id}
                        onClick={() => void runExpenseAction(activeDetail, "submit")}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#20243A] px-4 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {busyId === activeDetail.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                        Submit for approval
                      </button>
                      <button
                        type="button"
                        disabled={busyId === activeDetail.id}
                        onClick={() => void runDelete(activeDetail)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                        Delete draft
                      </button>
                    </>
                  )}

                  {(normalizeStatus(activeDetail.status) === "PENDING_APPROVAL" ||
                    normalizeStatus(activeDetail.status) === "PENDING") &&
                    activeDetail.approvalId && (
                      <button
                        type="button"
                        disabled={busyId === activeDetail.id}
                        onClick={() => void runApprovalAction(activeDetail)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#0B7A70] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === activeDetail.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        Approve expense
                      </button>
                    )}
                  {normalizeStatus(activeDetail.status) === "APPROVED" && (
                    <button
                      type="button"
                      disabled={busyId === activeDetail.id}
                      onClick={() => void runExpenseAction(activeDetail, "post")}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0D9488] px-4 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {busyId === activeDetail.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      Post to General Ledger
                    </button>
                  )}

                  {normalizeStatus(activeDetail.status) === "POSTED" &&
                    (activeDetail.paymentStatus || "").toUpperCase() !== "PAID" && (
                      <button
                        type="button"
                        onClick={() => openPayment(activeDetail)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#20243A] px-4 text-sm font-bold text-white"
                      >
                        <CreditCard size={16} />
                        Record payment
                      </button>
                    )}
                </div>

                <section>
                  <SectionTitle
                    eyebrow="Transaction"
                    title="Expense details"
                  />
                  <div className="mt-3 rounded-2xl border border-[#E9EAF1] px-4">
                    <DetailRow label="Vendor" value={activeDetail.vendor?.name || "No vendor"} />
                    <DetailRow label="Expense date" value={formatDate(activeDetail.expenseDate)} />
                    <DetailRow label="Category" value={activeDetail.category} />
                    <DetailRow
                      label="Description"
                      value={activeDetail.description || "-Å¡--’---"}
                    />
                    <DetailRow
                      label="Currency"
                      value={activeDetail.currency || "KES"}
                    />
                  </div>
                </section>

                <section>
                  <SectionTitle
                    eyebrow="Accounting"
                    title="Ledger connection"
                    detail="The relationships below come from the organization Chart of Accounts."
                  />
                  <div className="mt-3 rounded-2xl border border-[#E9EAF1] px-4">
                    <DetailRow
                      label="Expense account"
                      value={accountLabel(activeDetail.expenseAccount)}
                    />
                    <DetailRow
                      label="Payment / credit"
                      value={accountLabel(activeDetail.paymentAccount)}
                    />
                    <DetailRow
                      label="Bank account"
                      value={bankLabel(activeDetail.bankAccount)}
                    />
                    <DetailRow
                      label="Journal entry"
                      value={
                        activeDetail.journalEntryId ? (
                          <span className="text-emerald-700">Linked to General Ledger</span>
                        ) : (
                          <span className="text-[#8A90A5]">Not posted</span>
                        )
                      }
                    />
                  </div>
                </section>

                <section>
                  <SectionTitle
                    eyebrow="Payment"
                    title="Settlement"
                  />
                  <div className="mt-3 rounded-2xl border border-[#E9EAF1] px-4">
                    <DetailRow
                      label="Status"
                      value={activeDetail.paymentStatus || "UNPAID"}
                    />
                    <DetailRow
                      label="Payment method"
                      value={activeDetail.paymentMethod || "Not recorded"}
                    />
                    <DetailRow
                      label="Payment date"
                      value={formatDate(activeDetail.paymentDate)}
                    />
                    <DetailRow
                      label="Reference"
                      value={activeDetail.paymentReference || "Not recorded"}
                    />
                  </div>
                </section>
              </div>
            </div>
          </aside>
        </div>
      )}

      {showPayment && selectedExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#141827]/45 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={handlePayment}
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-[#ECEEF3] px-6 py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0D9488]">
                  Settlement
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                  Record payment
                </h2>
                <p className="mt-1 text-sm text-[#7A8097]">
                  {selectedExpense.expenseCode} --™-{" "}
                  {formatCurrency(Number(selectedExpense.amount) || 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                disabled={!!busyId}
                className="rounded-xl p-2 text-[#7A8097] hover:bg-[#F4F5F8]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <Field label="Payment date" required>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E1E3EA] px-4 text-sm outline-none focus:border-[#20243A]"
                />
              </Field>

              <Field label="Bank account">
                <select
                  value={paymentBankAccountId}
                  onChange={(event) => setPaymentBankAccountId(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E1E3EA] bg-white px-4 text-sm outline-none focus:border-[#20243A]"
                >
                  <option value="">Use existing expense bank account</option>
                  {bankAccounts.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bankLabel(bank)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Payment method">
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="h-12 w-full rounded-xl border border-[#E1E3EA] bg-white px-4 text-sm outline-none focus:border-[#20243A]"
                  >
                    <option value="">Not specified</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="MPESA">M-Pesa</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>

                <Field label="Payment reference">
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="e.g. TXN-12345"
                    className="h-12 w-full rounded-xl border border-[#E1E3EA] px-4 text-sm outline-none focus:border-[#20243A]"
                  />
                </Field>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-[#F7F8FB] p-4 text-xs leading-5 text-[#596077]">
                <Wallet size={17} className="mt-0.5 shrink-0 text-[#20243A]" />
                <span>
                  Recording payment marks this posted expense as paid and stores
                  the settlement details against the transaction.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#ECEEF3] px-6 py-4">
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                disabled={!!busyId}
                className="h-12 rounded-xl border border-[#E2E4EB] px-4 text-sm font-semibold text-[#596077]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!!busyId}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                {busyId ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {busyId ? "Recording..." : "Record payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
