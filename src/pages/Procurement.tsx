import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Filter,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { authenticatedFetch, getAuthToken } from "../lib/auth";

type ProcurementStatus =
  | "PENDING"
  | "APPROVED"
  | "ORDERED"
  | "DELIVERED"
  | "REJECTED";

interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  status?: string;
}

interface ProcurementRequest {
  id: string;
  requestCode: string;
  item: string;
  department: string;
  quantity: number;
  estimatedAmount: number;
  status: ProcurementStatus;
  requestedBy?: string;
  notes?: string | null;
  vendorId?: string | null;
  vendor?: Vendor | null;
  createdAt: string;
  updatedAt?: string;
  approvalId?: string | null;
  budgetId?: string | null;
}

interface RequestForm {
  vendorId: string;
  item: string;
  department: string;
  quantity: string;
  estimatedAmount: string;
  notes: string;
}

const DEPARTMENTS = [
  "Technology",
  "Operations",
  "Finance",
  "Human Resources",
  "Marketing",
  "Legal & Compliance",
  "Administration",
  "Other",
];

const INITIAL_FORM: RequestForm = {
  vendorId: "",
  item: "",
  department: "",
  quantity: "1",
  estimatedAmount: "",
  notes: "",
};

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
});

const formatCurrency = (value: number) =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const statusConfig: Record<
  ProcurementStatus,
  {
    label: string;
    classes: string;
    icon: React.ReactNode;
  }
> = {
  PENDING: {
    label: "Pending approval",
    classes:
      "border-amber-200 bg-amber-50 text-amber-700",
    icon: <Clock3 size={13} />,
  },
  APPROVED: {
    label: "Approved",
    classes:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 size={13} />,
  },
  ORDERED: {
    label: "Ordered",
    classes:
      "border-sky-200 bg-sky-50 text-sky-700",
    icon: <ShoppingCart size={13} />,
  },
  DELIVERED: {
    label: "Delivered",
    classes:
      "border-slate-200 bg-slate-50 text-slate-600",
    icon: <Truck size={13} />,
  },
  REJECTED: {
    label: "Rejected",
    classes:
      "border-red-200 bg-red-50 text-red-600",
    icon: <X size={13} />,
  },
};

function StatusBadge({
  status,
}: {
  status: ProcurementStatus;
}) {
  const config =
    statusConfig[status] ?? statusConfig.PENDING;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.classes}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  emphasis,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`group rounded-2xl border p-5 transition ${
        emphasis
          ? "border-[#D7E9E7] bg-[#F4FBFA]"
          : "border-[#E8E9EF] bg-white hover:border-[#D8D9E2]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#73788F]">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
            {value}
          </p>

          <p className="mt-1 text-xs text-[#85899B]">
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            emphasis
              ? "bg-[#F8F9FC] text-[#20243A]"
              : "bg-[#F6F7FA] text-[#44495E]"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function WorkflowNode({
  number,
  label,
  description,
  completed,
  active,
  last,
}: {
  number: number;
  label: string;
  description: string;
  completed?: boolean;
  active?: boolean;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      {!last && (
        <div
          className={`absolute left-[15px] top-8 h-[calc(100%-4px)] w-px ${
            completed
              ? "bg-emerald-300"
              : "bg-[#E7E8EE]"
          }`}
        />
      )}

      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          completed
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : active
              ? "border-[#0D9488] bg-[#0D9488] text-white"
              : "border-[#E3E4EA] bg-white text-[#9CA0B0]"
        }`}
      >
        {completed ? <Check size={15} /> : number}
      </div>

      <div className="pb-6">
        <p
          className={`text-sm font-semibold ${
            completed || active
              ? "text-[#20243A]"
              : "text-[#8B90A1]"
          }`}
        >
          {label}
        </p>

        <p className="mt-1 text-xs leading-5 text-[#777C90]">
          {description}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow && (
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8FA2]">
          {eyebrow}
        </p>
      )}

      <h3 className="mt-1 text-base font-bold text-[#20243A]">
        {title}
      </h3>

      {description && (
        <p className="mt-1 text-xs leading-5 text-[#777C90]">
          {description}
        </p>
      )}
    </div>
  );
}

export default function Procurement() {
  const [requests, setRequests] = useState<
    ProcurementRequest[]
  >([]);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVendors, setLoadingVendors] =
    useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");
  const [departmentFilter, setDepartmentFilter] =
    useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<ProcurementRequest | null>(null);

  const [form, setForm] =
    useState<RequestForm>(INITIAL_FORM);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = getAuthToken();

      const response = await authenticatedFetch(
        "/api/procurement",
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

      if (response.status === 404) {
        setRequests([]);
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to load requests (${response.status})`
        );
      }

      const data = await response.json();

      setRequests(
        Array.isArray(data?.requests)
          ? data.requests
          : []
      );
    } catch (err) {
      setRequests([]);

      setError(
        getErrorMessage(
          err,
          "Failed to load procurement requests."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVendors = useCallback(async () => {
    try {
      setLoadingVendors(true);

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
        throw new Error(
          `Failed to load vendors (${response.status})`
        );
      }

      const data = await response.json();

      const rows = Array.isArray(data?.vendors)
        ? data.vendors
        : Array.isArray(data)
          ? data
          : [];

      setVendors(
        rows.filter(
          (vendor: Vendor) =>
            vendor.status === undefined ||
            vendor.status === "ACTIVE"
        )
      );
    } catch (err) {
      setVendors([]);

      setError(
        getErrorMessage(
          err,
          "Failed to load vendors."
        )
      );
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    void loadVendors();
  }, [loadRequests, loadVendors]);

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        requests
          .map((request) => request.department)
          .filter(Boolean)
      )
    ).sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        request.status === statusFilter;

      const matchesDepartment =
        departmentFilter === "ALL" ||
        request.department === departmentFilter;

      const searchable = [
        request.requestCode,
        request.item,
        request.department,
        request.status,
        request.requestedBy,
        request.vendor?.name,
        request.vendor?.vendorCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesDepartment &&
        (!term || searchable.includes(term))
      );
    });
  }, [
    requests,
    search,
    statusFilter,
    departmentFilter,
  ]);

  const summary = useMemo(() => {
    const totalRequests = requests.length;

    const estimatedSpend = requests.reduce(
      (sum, request) =>
        sum +
        (Number(request.estimatedAmount) || 0),
      0
    );

    const pending = requests.filter(
      (request) => request.status === "PENDING"
    ).length;

    const approved = requests.filter(
      (request) => request.status === "APPROVED"
    ).length;

    const ordered = requests.filter(
      (request) => request.status === "ORDERED"
    ).length;

    return {
      totalRequests,
      estimatedSpend,
      pending,
      approved,
      ordered,
    };
  }, [requests]);

  const handleCreateRequest = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccessMessage("");

    const quantity = Number(form.quantity);
    const amount = Number(form.estimatedAmount);

    if (!form.item.trim()) {
      setError("Item / description is required.");
      return;
    }

    if (!form.department) {
      setError("Please select a department.");
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      setError("Quantity must be at least 1.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        "Estimated amount must be greater than zero."
      );
      return;
    }

    try {
      setSaving(true);

      const token = getAuthToken();

      const response = await authenticatedFetch(
        "/api/procurement",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          body: JSON.stringify({
            vendorId:
              form.vendorId || undefined,
            item: form.item.trim(),
            department: form.department,
            quantity,
            estimatedAmount: amount,
            notes:
              form.notes.trim() || undefined,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ??
            `Failed to create request (${response.status})`
        );
      }

      if (data?.request) {
        setRequests((current) => [
          data.request,
          ...current,
        ]);

        setSelectedRequest(data.request);

        setSuccessMessage(
          `${data.request.requestCode} created successfully.`
        );
      }

      setForm(INITIAL_FORM);
      setShowForm(false);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to create procurement request."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const submitForApproval = async () => {
    if (!selectedRequest || actionLoading) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const token = getAuthToken();

      const response = await authenticatedFetch(
        `/api/procurement/${selectedRequest.id}/submit`,
        {
          method: "POST",
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

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ??
            `Failed to submit request (${response.status})`
        );
      }

      const updated =
        data?.request ?? data;

      if (updated?.id) {
        setRequests((current) =>
          current.map((request) =>
            request.id === updated.id
              ? updated
              : request
          )
        );

        setSelectedRequest(updated);
      } else {
        await loadRequests();
      }

      setSuccessMessage(
        `${selectedRequest.requestCode} submitted for approval.`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to submit procurement request."
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  const advanceRequest = async () => {
    if (!selectedRequest || actionLoading) {
      return;
    }

    const nextStatus =
      selectedRequest.status === "APPROVED"
        ? "ORDERED"
        : selectedRequest.status === "ORDERED"
          ? "DELIVERED"
          : null;

    if (!nextStatus) return;

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const token = getAuthToken();

      const response = await authenticatedFetch(
        `/api/procurement/${selectedRequest.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ??
            `Failed to update request (${response.status})`
        );
      }

      const updated =
        data?.request ?? data;

      if (updated?.id) {
        setRequests((current) =>
          current.map((request) =>
            request.id === updated.id
              ? updated
              : request
          )
        );

        setSelectedRequest(updated);
      } else {
        await loadRequests();
      }

      setSuccessMessage(
        `${selectedRequest.requestCode} moved to ${nextStatus.toLowerCase()}.`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to update procurement status."
        )
      );
    } finally {
      setActionLoading(false);
    }
  };

  const workflowStage =
    selectedRequest?.status === "PENDING"
      ? 1
      : selectedRequest?.status === "APPROVED"
        ? 2
        : selectedRequest?.status === "ORDERED"
          ? 3
          : selectedRequest?.status ===
              "DELIVERED"
            ? 4
            : 1;

  const actionLabel =
    selectedRequest?.status === "PENDING"
      ? "Submit for Approval"
      : selectedRequest?.status === "APPROVED"
        ? "Mark as Ordered"
        : selectedRequest?.status === "ORDERED"
          ? "Mark as Delivered"
          : null;

  return (
    <div className="min-h-full space-y-7 pb-10">
      {/* HEADER */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#85899B]">
            <span>Operations</span>
            <ChevronRight size={14} />
            <span className="text-[#20243A]">
              Procurement
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#20243A]">
            Procurement
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#70758A]">
            Manage purchasing requests from initial
            submission through approval, ordering and
            delivery — ordering and downstream finance
            entries.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setError("");
              void loadRequests();
              void loadVendors();
            }}
            disabled={
              loading || loadingVendors
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[#E5E6EC] bg-white px-4 py-2.5 text-sm font-semibold text-[#555A70] transition hover:bg-[#F7F8FA] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
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
              setForm(INITIAL_FORM);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0B7A70]"
          >
            <Plus size={17} />
            New Request
          </button>
        </div>
      </section>

      {/* ALERTS */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1">
            {error}
          </span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={17} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1">
            {successMessage}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage("")
            }
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total Requests"
          value={summary.totalRequests}
          subtitle="All procurement requests"
          icon={<Package size={19} />}
        />

        <SummaryCard
          title="Estimated Spend"
          value={formatCurrency(
            summary.estimatedSpend
          )}
          subtitle="Current request value"
          icon={<WalletCards size={19} />}
          emphasis
        />

        <SummaryCard
          title="Pending Approval"
          value={summary.pending}
          subtitle="Awaiting authorization"
          icon={<Clock3 size={19} />}
        />

        <SummaryCard
          title="Approved"
          value={summary.approved}
          subtitle="Ready for ordering"
          icon={<CheckCircle2 size={19} />}
        />

        <SummaryCard
          title="Ordered"
          value={summary.ordered}
          subtitle="Orders in progress"
          icon={<Truck size={19} />}
        />
      </section>

      {/* WORKSPACE */}
      <section className="overflow-hidden rounded-2xl border border-[#E7E8EE] bg-white">
        <div className="border-b border-[#E7E8EE] px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <SectionTitle
                eyebrow="Purchase workspace"
                title="Procurement requests"
                description={`${filteredRequests.length} request${filteredRequests.length === 1 ? "" : "s"} shown`}
              />
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex min-w-0 items-center rounded-xl border border-[#E3E4EA] bg-[#FAFAFB] px-3 focus-within:border-[#0D9488] focus-within:bg-white md:w-[320px]">
                <Search
                  size={17}
                  className="shrink-0 text-[#85899B]"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search requests..."
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-[#20243A] outline-none placeholder:text-[#A1A5B3]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="text-[#8A8FA0]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Filter
                  size={16}
                  className="text-[#85899B]"
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-[#E3E4EA] bg-[#FAFAFB] px-3 py-2.5 text-sm text-[#555A70] outline-none focus:border-[#0D9488]"
                >
                  <option value="ALL">
                    All statuses
                  </option>
                  <option value="PENDING">
                    Pending approval
                  </option>
                  <option value="APPROVED">
                    Approved
                  </option>
                  <option value="ORDERED">
                    Ordered
                  </option>
                  <option value="DELIVERED">
                    Delivered
                  </option>
                  <option value="REJECTED">
                    Rejected
                  </option>
                </select>

                <select
                  value={departmentFilter}
                  onChange={(event) =>
                    setDepartmentFilter(
                      event.target.value
                    )
                  }
                  className="hidden rounded-xl border border-[#E3E4EA] bg-[#FAFAFB] px-3 py-2.5 text-sm text-[#555A70] outline-none focus:border-[#0D9488] md:block"
                >
                  <option value="ALL">
                    All departments
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={department}
                        value={department}
                      >
                        {department}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="text-center">
              <Loader2
                size={28}
                className="mx-auto animate-spin text-[#0D9488]"
              />

              <p className="mt-3 text-sm font-medium text-[#70758A]">
                Loading procurement workspace...
              </p>
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F6F8]">
              <ShoppingCart
                size={25}
                className="text-[#4D5266]"
              />
            </div>

            <h2 className="mt-4 text-lg font-bold text-[#20243A]">
              {requests.length === 0
                ? "No procurement requests yet"
                : "No matching requests"}
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#777C90]">
              {requests.length === 0
                ? "Create your first purchase request to begin the procurement lifecycle."
                : "Try another search term or change the filters."}
            </p>

            {requests.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setForm(INITIAL_FORM);
                  setShowForm(true);
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-bold text-white"
              >
                <Plus size={17} />
                Create Request
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-[#E7E8EE] bg-[#FAFAFB]">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8093]">
                    Request
                  </th>

                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8093]">
                    Vendor
                  </th>

                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8093]">
                    Item
                  </th>

                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8093]">
                    Department
                  </th>

                  <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8093]">
                    Qty
                  </th>

                  <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8093]">
                    Amount
                  </th>

                  <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8093]">
                    Status
                  </th>

                  <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8093]">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map(
                  (request) => (
                    <tr
                      key={request.id}
                      onClick={() =>
                        setSelectedRequest(
                          request
                        )
                      }
                      className="group cursor-pointer border-t border-[#F0F0F3] transition hover:bg-[#FAFBFC]"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-mono text-sm font-bold text-[#20243A]">
                            {request.requestCode}
                          </p>

                          <p className="mt-1 text-xs text-[#8A8FA0]">
                            {formatDate(
                              request.createdAt
                            )}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {request.vendor ? (
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F7F6] text-[#0D9488]">
                              <UserRound
                                size={15}
                              />
                            </div>

                            <div>
                              <p className="max-w-[180px] truncate font-semibold text-[#303449]">
                                {request.vendor.name}
                              </p>

                              <p className="font-mono text-[10px] text-[#8A8FA0]">
                                {
                                  request.vendor
                                    .vendorCode
                                }
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#9B9FAE]">
                            No vendor
                          </span>
                        )}
                      </td>

                      <td className="max-w-[220px] px-5 py-4">
                        <p className="truncate font-medium text-[#303449]">
                          {request.item}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-[#62677A]">
                        {request.department}
                      </td>

                      <td className="px-5 py-4 text-center font-medium text-[#303449]">
                        {request.quantity}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <p className="font-semibold text-[#20243A]">
                          {formatCurrency(
                            Number(
                              request.estimatedAmount
                            )
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={request.status}
                        />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8A8FA0] transition group-hover:bg-[#F0F5F4] group-hover:text-[#0D9488]">
                          <ArrowRight size={16} />
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ACCOUNTING BOUNDARY */}
      <section className="rounded-2xl border border-[#DDEAE8] bg-[#F5FBFA] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0D9488] shadow-sm">
            <FileCheck2 size={19} />
          </div>

          <div>
            <p className="text-sm font-bold text-[#20243A]">
              Procurement is an operational workflow
            </p>

            <p className="mt-1 max-w-4xl text-xs leading-6 text-[#667084]">
              Creating or approving a procurement
              request does not create an Accounts
              Payable, Expense, Asset, Payment or
              General Ledger posting. Financial entries
              are created only when the corresponding
              financial event occurs in its respective
              FOS module.
            </p>
          </div>
        </div>
      </section>

      {/* CREATE MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E5E6EC] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#E8E9EE] bg-white px-6 py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0D9488]">
                  Procurement
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                  New purchase request
                </h2>

                <p className="mt-1 text-sm text-[#74798D]">
                  Create a request for departmental
                  approval.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  setShowForm(false);
                  setForm(INITIAL_FORM);
                  setError("");
                }}
                className="rounded-xl p-2 text-[#777C90] hover:bg-[#F5F6F8] hover:text-[#20243A]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateRequest}
              className="p-6"
            >
              {/* CODE NOTICE */}
              <div className="mb-6 rounded-xl border border-[#DDEAE8] bg-[#F5FBFA] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#0D9488]">
                    <FileCheck2 size={17} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#20243A]">
                      Request code generated
                      automatically
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#70758A]">
                      Ziya will generate the next
                      tenant-specific{" "}
                      <span className="font-mono font-semibold text-[#20243A]">
                        PR-YYYY-NNN
                      </span>{" "}
                      code when the request is
                      created.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#303449]">
                    Vendor
                    <span className="ml-1 text-xs font-normal text-[#8A8FA0]">
                      Optional
                    </span>
                  </label>

                  <select
                    value={form.vendorId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        vendorId:
                          event.target.value,
                      }))
                    }
                    disabled={
                      saving ||
                      loadingVendors
                    }
                    className="w-full rounded-xl border border-[#E0E1E7] bg-white px-4 py-3 text-sm text-[#303449] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:bg-[#F7F7F9]"
                  >
                    <option value="">
                      {loadingVendors
                        ? "Loading vendors..."
                        : "Select a vendor"}
                    </option>

                    {vendors.map((vendor) => (
                      <option
                        key={vendor.id}
                        value={vendor.id}
                      >
                        {vendor.name} — Active
                        {vendor.vendorCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#303449]">
                    Department
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    value={form.department}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        department:
                          event.target.value,
                      }))
                    }
                    disabled={saving}
                    className="w-full rounded-xl border border-[#E0E1E7] bg-white px-4 py-3 text-sm text-[#303449] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                  >
                    <option value="">
                      Select department
                    </option>

                    {DEPARTMENTS.map(
                      (department) => (
                        <option
                          key={department}
                          value={department}
                        >
                          {department}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#303449]">
                    Quantity
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        quantity:
                          event.target.value,
                      }))
                    }
                    disabled={saving}
                    className="w-full rounded-xl border border-[#E0E1E7] px-4 py-3 text-sm text-[#303449] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#303449]">
                    Item / description
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    value={form.item}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        item: event.target.value,
                      }))
                    }
                    disabled={saving}
                    placeholder="e.g. Office laptops — Dell XPS 15"
                    className="w-full rounded-xl border border-[#E0E1E7] px-4 py-3 text-sm text-[#303449] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#303449]">
                    Estimated amount
                    <span className="ml-1 text-xs font-normal text-[#8A8FA0]">
                      KES
                    </span>
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.estimatedAmount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        estimatedAmount:
                          event.target.value,
                      }))
                    }
                    disabled={saving}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[#E0E1E7] px-4 py-3 text-sm text-[#303449] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#303449]">
                    Request type
                  </label>

                  <div className="flex h-[46px] items-center rounded-xl border border-[#E0E1E7] bg-[#F8F9FA] px-4 text-sm text-[#777C90]">
                    Standard procurement
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#303449]">
                    Notes
                    <span className="ml-1 text-xs font-normal text-[#8A8FA0]">
                      Optional
                    </span>
                  </label>

                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    disabled={saving}
                    placeholder="Add specifications, justification or purchasing notes..."
                    className="w-full resize-none rounded-xl border border-[#E0E1E7] px-4 py-3 text-sm text-[#303449] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={17} />
                  {error}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#E8E9EE] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setForm(INITIAL_FORM);
                    setError("");
                  }}
                  disabled={saving}
                  className="rounded-xl border border-[#E1E2E8] px-5 py-2.5 text-sm font-semibold text-[#666B7D] hover:bg-[#F7F7F9]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0B7A70] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={17} />
                  )}

                  {saving
                    ? "Creating..."
                    : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#111827]/40 backdrop-blur-[2px]">
          <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            {/* DRAWER HEADER */}
            <div className="sticky top-0 z-20 border-b border-[#E7E8EE] bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#0D9488]">
                      Procurement request
                    </span>

                    <StatusBadge
                      status={
                        selectedRequest.status
                      }
                    />
                  </div>

                  <h2 className="mt-2 font-mono text-2xl font-bold tracking-tight text-[#20243A]">
                    {selectedRequest.requestCode}
                  </h2>

                  <p className="mt-1 truncate text-sm text-[#777C90]">
                    {selectedRequest.item}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedRequest(null)
                  }
                  className="rounded-xl p-2 text-[#777C90] hover:bg-[#F5F6F8] hover:text-[#20243A]"
                >
                  <X size={21} />
                </button>
              </div>

              {/* ACTION BAR */}
              {(actionLabel ||
                selectedRequest.status ===
                  "REJECTED") && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {actionLabel && (
                    <button
                      type="button"
                      onClick={
                        selectedRequest.status ===
                        "PENDING"
                          ? submitForApproval
                          : advanceRequest
                      }
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0B7A70] disabled:opacity-60"
                    >
                      {actionLoading ? (
                        <Loader2
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <ArrowRight
                          size={16}
                        />
                      )}

                      {actionLabel}
                    </button>
                  )}

                  {selectedRequest.status ===
                    "REJECTED" && (
                    <div className="flex items-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
                      This request was rejected.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="space-y-5 p-6">
                {/* AMOUNT HERO */}
                <div className="rounded-2xl border border-[#E7E8EE] bg-[#FAFAFB] p-5">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#85899B]">
                        Estimated purchase value
                      </p>

                      <p className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                        {formatCurrency(
                          Number(
                            selectedRequest.estimatedAmount
                          )
                        )}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-xs text-[#85899B]">
                        Requested
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[#404559]">
                        {formatDate(
                          selectedRequest.createdAt
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* REQUEST DETAILS */}
                <section className="rounded-2xl border border-[#E7E8EE] bg-white p-5">
                  <SectionTitle
                    eyebrow="Request"
                    title="Request details"
                  />

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-[#85899B]">
                        Item
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#303449]">
                        {selectedRequest.item}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#85899B]">
                        Department
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#303449]">
                        {
                          selectedRequest.department
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#85899B]">
                        Quantity
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#303449]">
                        {selectedRequest.quantity}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#85899B]">
                        Requested by
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#303449]">
                        {selectedRequest.requestedBy ||
                          "Current user"}
                      </p>
                    </div>
                  </div>
                </section>

                {/* VENDOR */}
                <section className="rounded-2xl border border-[#E7E8EE] bg-white p-5">
                  <SectionTitle
                    eyebrow="Supplier"
                    title="Vendor"
                    description="Supplier associated with this procurement request."
                  />

                  {selectedRequest.vendor ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#E8E9EE] bg-[#FAFAFB] p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#0D9488] shadow-sm">
                        <UserRound size={19} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#303449]">
                          {
                            selectedRequest
                              .vendor.name
                          }
                        </p>

                        <p className="mt-1 font-mono text-xs text-[#85899B]">
                          {
                            selectedRequest
                              .vendor
                              .vendorCode
                          }
                        </p>

                        {selectedRequest
                          .vendor.email && (
                          <p className="mt-1 text-xs text-[#777C90]">
                            {
                              selectedRequest
                                .vendor
                                .email
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-[#D9DBE3] p-4 text-sm text-[#85899B]">
                      No vendor linked to this
                      request.
                    </div>
                  )}
                </section>

                {/* WORKFLOW */}
                <section className="rounded-2xl border border-[#E7E8EE] bg-white p-5">
                  <SectionTitle
                    eyebrow="Lifecycle"
                    title="Procurement workflow"
                    description="Follow the request from operational approval to the eventual financial event."
                  />

                  <div className="mt-6">
                    <WorkflowNode
                      number={1}
                      label="Request"
                      description="Purchase request created and assigned a tenant-specific request code."
                      completed
                      active={
                        workflowStage === 1
                      }
                    />

                    <WorkflowNode
                      number={2}
                      label="Approval"
                      description="Authorization is required before the procurement becomes an approved commitment."
                      completed={
                        workflowStage > 2
                      }
                      active={
                        workflowStage === 2
                      }
                    />

                    <WorkflowNode
                      number={3}
                      label="Budget"
                      description="Budget availability is checked against the request department and financial year."
                      completed={
                        workflowStage > 2
                      }
                      active={
                        workflowStage === 2
                      }
                    />

                    <WorkflowNode
                      number={4}
                      label="Accounts Payable"
                      description="A supplier invoice can create the payable when the actual invoice event occurs."
                      completed={
                        workflowStage >= 4
                      }
                      active={
                        workflowStage === 3
                      }
                    />

                    <WorkflowNode
                      number={5}
                      label="Payment"
                      description="Settlement is handled by the payment workflow rather than procurement."
                      active={false}
                    />

                    <WorkflowNode
                      number={6}
                      label="Expense / Asset"
                      description="The actual purchase is classified as an expense or capital asset where appropriate."
                      active={false}
                    />

                    <WorkflowNode
                      number={7}
                      label="General Ledger"
                      description="Accounting owns the final financial posting generated by the relevant financial event."
                      active={false}
                    />

                    <WorkflowNode
                      number={8}
                      label="Audit Trail"
                      description="Procurement and financial actions are recorded for traceability."
                      last
                      active={false}
                    />
                  </div>
                </section>

                {/* LINKED RECORDS */}
                <section className="rounded-2xl border border-[#E7E8EE] bg-white p-5">
                  <SectionTitle
                    eyebrow="FOS connections"
                    title="Linked financial records"
                    description="These relationships allow Procurement to orchestrate downstream modules without duplicating accounting."
                  />

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-[#ECECF0] bg-[#FAFAFB] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#555A70]">
                          <FileCheck2 size={16} />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[#303449]">
                            Approval
                          </p>

                          <p className="text-xs text-[#85899B]">
                            Authorization record
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold ${
                          selectedRequest.approvalId
                            ? "text-emerald-600"
                            : "text-[#9A9EAC]"
                        }`}
                      >
                        {selectedRequest.approvalId
                          ? "Linked"
                          : "Pending"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-[#ECECF0] bg-[#FAFAFB] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#555A70]">
                          <WalletCards size={16} />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[#303449]">
                            Budget
                          </p>

                          <p className="text-xs text-[#85899B]">
                            Department budget control
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold ${
                          selectedRequest.budgetId
                            ? "text-emerald-600"
                            : "text-[#9A9EAC]"
                        }`}
                      >
                        {selectedRequest.budgetId
                          ? "Linked"
                          : "Pending"}
                      </span>
                    </div>

                    {[
                      [
                        "Accounts Payable",
                        "Supplier invoice",
                      ],
                      ["Payment", "Settlement"],
                      [
                        "Expense / Asset",
                        "Financial classification",
                      ],
                      [
                        "General Ledger",
                        "Accounting posting",
                      ],
                      [
                        "Audit Trail",
                        "Lifecycle history",
                      ],
                    ].map(
                      ([label, description]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between rounded-xl border border-[#ECECF0] bg-white p-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#303449]">
                              {label}
                            </p>

                            <p className="text-xs text-[#85899B]">
                              {description}
                            </p>
                          </div>

                          <span className="text-xs font-medium text-[#9A9EAC]">
                            Recorded
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </section>

                {/* ACCOUNTING NOTICE */}
                <section className="rounded-2xl border border-[#DDEAE8] bg-[#F5FBFA] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#0D9488]">
                      <FileCheck2 size={17} />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-[#20243A]">
                        Accounting integrity
                      </p>

                      <p className="mt-1 text-xs leading-6 text-[#667084]">
                        This procurement request is
                        not itself an accounting
                        transaction. Approval,
                        ordering and delivery update
                        the operational lifecycle.
                        AP, Payment, Expense, Asset
                        and General Ledger records
                        should only be created from
                        their corresponding financial
                        events.
                      </p>
                    </div>
                  </div>
                </section>

                {/* NOTES */}
                {selectedRequest.notes && (
                  <section className="rounded-2xl border border-[#E7E8EE] bg-white p-5">
                    <SectionTitle title="Notes" />

                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#666B7D]">
                      {selectedRequest.notes}
                    </p>
                  </section>
                )}

                {/* FOOTER */}
                <div className="flex items-center justify-between border-t border-[#E7E8EE] pt-5 text-xs text-[#9A9EAC]">
                  <span>
                    Created{" "}
                    {formatDateTime(
                      selectedRequest.createdAt
                    )}
                  </span>

                  {selectedRequest.updatedAt && (
                    <span>
                      Updated{" "}
                      {formatDateTime(
                        selectedRequest.updatedAt
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
