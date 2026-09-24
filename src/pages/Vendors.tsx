import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  FileText,
  Loader2,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
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
  createVendor,
  deleteVendor,
  getVendorById,
  getVendors,
  updateVendor,
  updateVendorStatus,
} from "../services/vendors";

import type {
  GetVendorsParams,
  Vendor,
  VendorInput,
  VendorPageSize,
  VendorSortField,
  VendorSortOrder,
} from "../services/vendors";

/* =========================================================
   TYPES
========================================================= */

type Tab =
  | "ALL"
  | "ACTIVE"
  | "INACTIVE";

type FormState = {
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  taxNumber: string;
};

type Vendor360 = Vendor & {
  _count?: {
    payables: number;
    expenses: number;
    procurementRequests: number;
  };

  payables?: Array<{
    id: string;
    invoiceNumber?: string;
    amount?: number;
    status?: string;
    createdAt: string;
  }>;

  expenses?: Array<{
    id: string;
    expenseCode?: string;
    amount?: number;
    status?: string;
    expenseDate?: string;
    createdAt: string;
  }>;

  procurementRequests?: Array<{
    id: string;
    requestCode?: string;
    item?: string;
    estimatedAmount?: number;
    status?: string;
    createdAt: string;
  }>;
};

/* =========================================================
   CONSTANTS
========================================================= */

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phoneNumber: "",
  address: "",
  taxNumber: "",
};

const PAGE_SIZE_OPTIONS:
  VendorPageSize[] = [
    10,
    25,
    50,
    100,
  ];

const currency =
  new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 2,
    }
  );

const dateFormatter =
  new Intl.DateTimeFormat(
    "en-KE",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );

/* =========================================================
   HELPERS
========================================================= */

function formatDate(
  value?: string
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : dateFormatter.format(date);
}

function formatMoney(
  value?: number
) {
  return currency.format(
    Number.isFinite(value)
      ? Number(value)
      : 0
  );
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-KE"
  ).format(value);
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : fallback;
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#687086]">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
            {formatNumber(value)}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F7FA] text-[#20243A]">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const active =
    status === "ACTIVE";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active
        ? "Active"
        : "Inactive"}
    </span>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Vendors() {
  const [
    vendors,
    setVendors,
  ] = useState<Vendor[]>([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    tab,
    setTab,
  ] = useState<Tab>("ALL");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] =
    useState<VendorPageSize>(25);

  const [
    sortBy,
    setSortBy,
  ] =
    useState<VendorSortField>(
      "createdAt"
    );

  const [
    sortOrder,
    setSortOrder,
  ] =
    useState<VendorSortOrder>(
      "desc"
    );

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  const [
    summary,
    setSummary,
  ] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    busyId,
    setBusyId,
  ] = useState<string | null>(
    null
  );

  const [
    notice,
    setNotice,
  ] = useState<{
    type:
      | "success"
      | "error";
    message: string;
  } | null>(null);

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState<Vendor | null>(
    null
  );

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      EMPTY_FORM
    );

  const [
    selectedVendor,
    setSelectedVendor,
  ] =
    useState<Vendor360 | null>(
      null
    );

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  /* =======================================================
     LOAD VENDORS
  ======================================================= */

  const loadVendors =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const params:
            GetVendorsParams = {
            page,
            limit: pageSize,
            search,
            status: tab,
            sortBy,
            sortOrder,
          };

          const result =
            await getVendors(
              params
            );

          setVendors(
            Array.isArray(
              result.vendors
            )
              ? result.vendors
              : []
          );

          setPagination(
            result.pagination
          );

          setSummary(
            result.summary
          );
        } catch (error) {
          setNotice({
            type: "error",
            message:
              getErrorMessage(
                error,
                "Failed to load vendors."
              ),
          });
        } finally {
          setLoading(false);
        }
      },
      [
        page,
        pageSize,
        search,
        tab,
        sortBy,
        sortOrder,
      ]
    );

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  /* =======================================================
     FILTER / SEARCH HANDLERS
  ======================================================= */

  const handleSearchChange = (
    value: string
  ) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (
    value: Tab
  ) => {
    setTab(value);
    setPage(1);
  };

  const handlePageSizeChange = (
    value: string
  ) => {
    const next =
      Number(value);

    if (
      PAGE_SIZE_OPTIONS.includes(
        next as VendorPageSize
      )
    ) {
      setPageSize(
        next as VendorPageSize
      );
      setPage(1);
    }
  };

  const handleSortChange = (
    value: VendorSortField
  ) => {
    if (sortBy === value) {
      setSortOrder(
        (current) =>
          current === "asc"
            ? "desc"
            : "asc"
      );
    } else {
      setSortBy(value);
      setSortOrder(
        value === "name"
          ? "asc"
          : "desc"
      );
    }

    setPage(1);
  };

  /* =======================================================
     CREATE
  ======================================================= */

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
    });
    setNotice(null);
    setFormOpen(true);
  };

  /* =======================================================
     EDIT
  ======================================================= */

  const openEdit = (
    vendor: Vendor
  ) => {
    setEditing(vendor);

    setForm({
      name:
        vendor.name ?? "",
      email:
        vendor.email ?? "",
      phoneNumber:
        vendor.phoneNumber ?? "",
      address:
        vendor.address ?? "",
      taxNumber:
        vendor.taxNumber ?? "",
    });

    setNotice(null);
    setFormOpen(true);
  };

  /* =======================================================
     CLOSE FORM
  ======================================================= */

  const closeForm = () => {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
    });
  };

  /* =======================================================
     VENDOR DETAIL
  ======================================================= */

  const openDetail =
    async (
      vendor: Vendor
    ) => {
      try {
        setDetailLoading(
          true
        );

        const detail =
          await getVendorById(
            vendor.id
          );

        setSelectedVendor(
          detail as Vendor360
        );
      } catch (error) {
        setNotice({
          type: "error",
          message:
            getErrorMessage(
              error,
              "Unable to load vendor details."
            ),
        });
      } finally {
        setDetailLoading(
          false
        );
      }
    };

  /* =======================================================
     CREATE / UPDATE SUBMIT
  ======================================================= */

  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      const name =
        form.name.trim();

      const email =
        form.email.trim();

      if (!name) {
        setNotice({
          type: "error",
          message:
            "Vendor name is required.",
        });

        return;
      }

      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        setNotice({
          type: "error",
          message:
            "Enter a valid email address.",
        });

        return;
      }

      const input:
        VendorInput = {
        name,
        email,
        phoneNumber:
          form.phoneNumber.trim(),
        address:
          form.address.trim(),
        taxNumber:
          form.taxNumber.trim(),
      };

      try {
        setSaving(true);
        setNotice(null);

        if (editing) {
          const updated =
            await updateVendor(
              editing.id,
              input
            );

          setVendors(
            (current) =>
              current.map(
                (vendor) =>
                  vendor.id ===
                  updated.id
                    ? updated
                    : vendor
              )
          );

          setNotice({
            type: "success",
            message:
              "Vendor updated successfully.",
          });
        } else {
          const created =
            await createVendor(
              input
            );

          /*
           * Refresh from the server so
           * pagination, totals and sorting
           * remain authoritative.
           */
          await loadVendors();

          setNotice({
            type: "success",
            message:
              `${created.vendorCode} was created successfully.`,
          });
        }

        closeForm();
      } catch (error) {
        setNotice({
          type: "error",
          message:
            getErrorMessage(
              error,
              editing
                ? "Failed to update vendor."
                : "Failed to create vendor."
            ),
        });
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     STATUS
  ======================================================= */

  const toggleStatus =
    async (
      vendor: Vendor
    ) => {
      if (busyId) {
        return;
      }

      const next =
        vendor.status ===
        "ACTIVE"
          ? "INACTIVE"
          : "ACTIVE";

      const action =
        next === "ACTIVE"
          ? "activate"
          : "deactivate";

      if (
        !window.confirm(
          `Are you sure you want to ${action} "${vendor.name}"?`
        )
      ) {
        return;
      }

      try {
        setBusyId(
          vendor.id
        );

        const updated =
          await updateVendorStatus(
            vendor.id,
            next
          );

        setVendors(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                updated.id
                  ? updated
                  : item
            )
        );

        setSummary(
          (current) => {
            if (
              vendor.status ===
              updated.status
            ) {
              return current;
            }

            return {
              ...current,
              active:
                updated.status ===
                "ACTIVE"
                  ? current.active +
                    1
                  : Math.max(
                      0,
                      current.active -
                        1
                    ),
              inactive:
                updated.status ===
                "INACTIVE"
                  ? current.inactive +
                    1
                  : Math.max(
                      0,
                      current.inactive -
                        1
                    ),
            };
          }
        );

        setNotice({
          type: "success",
          message:
            next === "ACTIVE"
              ? "Vendor activated successfully."
              : "Vendor deactivated successfully.",
        });
      } catch (error) {
        setNotice({
          type: "error",
          message:
            getErrorMessage(
              error,
              "Failed to update vendor status."
            ),
        });
      } finally {
        setBusyId(null);
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const removeVendor =
    async (
      vendor: Vendor
    ) => {
      if (busyId) {
        return;
      }

      if (
        !window.confirm(
          `Delete "${vendor.name}" permanently?\n\nVendors with financial or procurement records cannot be deleted.`
        )
      ) {
        return;
      }

      try {
        setBusyId(
          vendor.id
        );

        const message =
          await deleteVendor(
            vendor.id
          );

        /*
         * Reload so pagination,
         * total counts and page boundaries
         * are always correct after deletion.
         */
        await loadVendors();

        if (
          selectedVendor?.id ===
          vendor.id
        ) {
          setSelectedVendor(
            null
          );
        }

        setNotice({
          type: "success",
          message:
            message ||
            "Vendor deleted successfully.",
        });
      } catch (error) {
        setNotice({
          type: "error",
          message:
            getErrorMessage(
              error,
              "Vendor could not be deleted."
            ),
        });
      } finally {
        setBusyId(null);
      }
    };

  /* =======================================================
     PAGINATION DISPLAY
  ======================================================= */

  const showingFrom =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          pagination.limit +
        1;

  const showingTo =
    pagination.total === 0
      ? 0
      : Math.min(
          pagination.page *
            pagination.limit,
          pagination.total
        );

  const pageNumbers =
    useMemo(() => {
      const totalPages =
        pagination.totalPages;

      if (totalPages <= 0) {
        return [];
      }

      const current =
        pagination.page;

      const pages: number[] =
        [];

      const addPage = (
        value: number
      ) => {
        if (
          value >= 1 &&
          value <= totalPages &&
          !pages.includes(value)
        ) {
          pages.push(value);
        }
      };

      addPage(1);

      for (
        let value = current - 1;
        value <= current + 1;
        value++
      ) {
        addPage(value);
      }

      addPage(totalPages);

      return pages.sort(
        (a, b) => a - b
      );
    }, [
      pagination.page,
      pagination.totalPages,
    ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6 pb-10">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#687086]">
            Business Operations
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#20243A]">
            Vendors
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-[#687086]">
            Manage supplier relationships,
            bills, expenses and procurement
            activity across your organization.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              void loadVendors()
            }
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8EAF0] bg-white px-4 py-2.5 text-sm font-semibold text-[#4E566B] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-60"
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
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B7A70]"
          >
            <Plus size={18} />

            Add Vendor
          </button>
        </div>
      </div>

      {/* ===================================================
          NOTICE
      =================================================== */}

      {notice && (
        <div
          role="alert"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.type ===
            "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.type ===
          "success" ? (
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />
          )}

          <span className="flex-1">
            {notice.message}
          </span>

          <button
            type="button"
            onClick={() =>
              setNotice(null)
            }
            className="rounded-md p-0.5 hover:bg-black/5"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Vendors"
          value={summary.total}
          icon={
            <Building2
              size={20}
            />
          }
        />

        <StatCard
          label="Active Vendors"
          value={summary.active}
          icon={
            <CheckCircle2
              size={20}
            />
          }
        />

        <StatCard
          label="Inactive Vendors"
          value={summary.inactive}
          icon={
            <Building2
              size={20}
            />
          }
        />
      </div>

      {/* ===================================================
          VENDOR WORKSPACE
      =================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-sm">
        {/* =================================================
            FILTER BAR
        ================================================= */}

        <div className="border-b border-[#E8EAF0] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-1 rounded-xl bg-[#F5F6F8] p-1">
              {(
                [
                  [
                    "ALL",
                    "All",
                  ],
                  [
                    "ACTIVE",
                    "Active",
                  ],
                  [
                    "INACTIVE",
                    "Inactive",
                  ],
                ] as const
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      handleTabChange(
                        value
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      tab === value
                        ? "bg-white text-[#20243A] shadow-sm"
                        : "text-[#687086] hover:text-[#20243A]"
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* SEARCH */}

              <div className="flex w-full min-w-0 items-center rounded-xl border border-[#E8EAF0] px-3 sm:w-80">
                <Search
                  size={18}
                  className="shrink-0 text-[#7B8498]"
                />

                <input
                  value={search}
                  onChange={(
                    event
                  ) =>
                    handleSearchChange(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search vendors, codes, tax numbers..."
                  className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-[#A2A8B7]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSearchChange(
                        ""
                      )
                    }
                    className="rounded-md p-1 text-[#7B8498] hover:bg-[#F5F6F8]"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* PAGE SIZE */}

              <label className="flex items-center gap-2 text-sm text-[#687086]">
                <span className="whitespace-nowrap">
                  Show
                </span>

                <div className="relative">
                  <select
                    value={pageSize}
                    onChange={(
                      event
                    ) =>
                      handlePageSizeChange(
                        event.target
                          .value
                      )
                    }
                    className="appearance-none rounded-xl border border-[#E8EAF0] bg-white py-2.5 pl-3 pr-9 text-sm font-semibold text-[#20243A] outline-none focus:border-[#0D9488]"
                  >
                    {PAGE_SIZE_OPTIONS.map(
                      (size) => (
                        <option
                          key={size}
                          value={size}
                        >
                          {size}
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7B8498]"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2
                size={30}
                className="animate-spin text-[#20243A]"
              />

              <p className="text-sm text-[#687086]">
                Loading vendors...
              </p>
            </div>
          </div>
        ) : vendors.length ===
          0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F7FA]">
              <Building2
                size={30}
                className="text-[#A2A8B7]"
              />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
              No vendors found
            </h2>

            <p className="mt-1 max-w-md text-sm text-[#687086]">
              {summary.total ===
                0 &&
              !search &&
              tab === "ALL"
                ? "Create your first vendor to start connecting suppliers across Ziya FOS."
                : "No vendors match the current search or filter. Try changing your criteria."}
            </p>

            {search && (
              <button
                type="button"
                onClick={() =>
                  handleSearchChange(
                    ""
                  )
                }
                className="mt-4 rounded-xl border border-[#E8EAF0] px-4 py-2 text-sm font-semibold text-[#20243A] hover:bg-[#F7F8FA]"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="border-b border-[#E8EAF0] bg-[#FAFBFC] text-left text-xs font-semibold uppercase tracking-wide text-[#7B8498]">
                    <SortableHeader
                      label="Vendor"
                      field="name"
                      sortBy={sortBy}
                      sortOrder={
                        sortOrder
                      }
                      onSort={
                        handleSortChange
                      }
                    />

                    <SortableHeader
                      label="Code"
                      field="vendorCode"
                      sortBy={sortBy}
                      sortOrder={
                        sortOrder
                      }
                      onSort={
                        handleSortChange
                      }
                    />

                    <th className="px-5 py-3">
                      Contact
                    </th>

                    <th className="px-5 py-3">
                      Tax Number
                    </th>

                    <SortableHeader
                      label="Status"
                      field="status"
                      sortBy={sortBy}
                      sortOrder={
                        sortOrder
                      }
                      onSort={
                        handleSortChange
                      }
                    />

                    <SortableHeader
                      label="Added"
                      field="createdAt"
                      sortBy={sortBy}
                      sortOrder={
                        sortOrder
                      }
                      onSort={
                        handleSortChange
                      }
                    />

                    <th className="px-5 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {vendors.map(
                    (vendor) => (
                      <tr
                        key={
                          vendor.id
                        }
                        className="border-b border-[#EEF0F4] last:border-0 hover:bg-[#FBFCFD]"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              void openDetail(
                                vendor
                              )
                            }
                            className="flex items-center gap-3 text-left"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F5F7]">
                              <Building2
                                size={19}
                                className="text-[#20243A]"
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#20243A]">
                                {
                                  vendor.name
                                }
                              </p>

                              <p className="mt-0.5 text-xs text-[#7B8498]">
                                {
                                  vendor.vendorCode
                                }
                              </p>
                            </div>
                          </button>
                        </td>

                        <td className="px-5 py-4 font-mono text-sm text-[#4E566B]">
                          {
                            vendor.vendorCode
                          }
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-1 text-sm text-[#687086]">
                            {vendor.email && (
                              <div className="flex items-center gap-2">
                                <Mail
                                  size={14}
                                />

                                <span className="max-w-[220px] truncate">
                                  {
                                    vendor.email
                                  }
                                </span>
                              </div>
                            )}

                            {vendor.phoneNumber && (
                              <div className="flex items-center gap-2">
                                <Phone
                                  size={14}
                                />

                                {
                                  vendor.phoneNumber
                                }
                              </div>
                            )}

                            {!vendor.email &&
                              !vendor.phoneNumber && (
                                <span className="text-[#A2A8B7]">
                                  No contact details
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono text-sm text-[#687086]">
                          {
                            vendor.taxNumber ||
                            "—"
                          }
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              vendor.status
                            }
                          />
                        </td>

                        <td className="px-5 py-4 text-sm text-[#687086]">
                          {formatDate(
                            vendor.createdAt
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <VendorActions
                            vendor={
                              vendor
                            }
                            busy={
                              busyId ===
                              vendor.id
                            }
                            onEdit={() =>
                              openEdit(
                                vendor
                              )
                            }
                            onToggle={() =>
                              void toggleStatus(
                                vendor
                              )
                            }
                            onDelete={() =>
                              void removeVendor(
                                vendor
                              )
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* =============================================
                PAGINATION
            ============================================= */}

            <div className="flex flex-col gap-4 border-t border-[#E8EAF0] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-[#687086]">
                Showing{" "}
                <span className="font-semibold text-[#20243A]">
                  {formatNumber(
                    showingFrom
                  )}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-[#20243A]">
                  {formatNumber(
                    showingTo
                  )}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[#20243A]">
                  {formatNumber(
                    pagination.total
                  )}
                </span>{" "}
                vendors
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <PaginationButton
                  label="First"
                  icon={
                    <ChevronsLeft
                      size={16}
                    />
                  }
                  disabled={
                    !pagination.hasPreviousPage
                  }
                  onClick={() =>
                    setPage(1)
                  }
                />

                <PaginationButton
                  label="Previous"
                  icon={
                    <ChevronLeft
                      size={16}
                    />
                  }
                  disabled={
                    !pagination.hasPreviousPage
                  }
                  onClick={() =>
                    setPage(
                      Math.max(
                        1,
                        pagination.page -
                          1
                      )
                    )
                  }
                />

                <div className="flex items-center gap-1">
                  {pageNumbers.map(
                    (
                      pageNumber,
                      index
                    ) => {
                      const previous =
                        pageNumbers[
                          index - 1
                        ];

                      const gap =
                        previous !==
                          undefined &&
                        pageNumber -
                          previous >
                          1;

                      return (
                        <span
                          key={
                            pageNumber
                          }
                          className="flex items-center"
                        >
                          {gap && (
                            <span className="px-1 text-sm text-[#A2A8B7]">
                              …
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setPage(
                                pageNumber
                              )
                            }
                            className={`min-w-9 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                              pagination.page ===
                              pageNumber
                                ? "bg-[#20243A] text-white"
                                : "text-[#687086] hover:bg-[#F5F6F8] hover:text-[#20243A]"
                            }`}
                          >
                            {
                              pageNumber
                            }
                          </button>
                        </span>
                      );
                    }
                  )}
                </div>

                <PaginationButton
                  label="Next"
                  icon={
                    <ChevronRight
                      size={16}
                    />
                  }
                  disabled={
                    !pagination.hasNextPage
                  }
                  onClick={() =>
                    setPage(
                      Math.min(
                        pagination.totalPages,
                        pagination.page +
                          1
                      )
                    )
                  }
                />

                <PaginationButton
                  label="Last"
                  icon={
                    <ChevronsRight
                      size={16}
                    />
                  }
                  disabled={
                    !pagination.hasNextPage
                  }
                  onClick={() =>
                    setPage(
                      pagination.totalPages
                    )
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===================================================
          CREATE / EDIT MODAL
      =================================================== */}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#E8EAF0] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  {editing
                    ? "Edit Vendor"
                    : "Add Vendor"}
                </h2>

                <p className="mt-1 text-sm text-[#687086]">
                  Vendor code is generated
                  automatically by Ziya FOS.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 hover:bg-[#F5F6F8]"
                aria-label="Close"
              >
                <X
                  size={21}
                  className="text-[#687086]"
                />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6"
            >
              {editing && (
                <div className="mb-5 rounded-xl bg-[#F7F8FA] px-4 py-3">
                  <p className="text-xs font-medium text-[#687086]">
                    Vendor Code
                  </p>

                  <p className="mt-1 font-mono text-sm font-semibold text-[#20243A]">
                    {
                      editing.vendorCode
                    }
                  </p>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <FormInput
                  label="Vendor / Business Name"
                  required
                  value={
                    form.name
                  }
                  onChange={(
                    value
                  ) =>
                    setForm(
                      (current) => ({
                        ...current,
                        name: value,
                      })
                    )
                  }
                  placeholder="Enter vendor name"
                />

                <FormInput
                  label="Email"
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(
                    value
                  ) =>
                    setForm(
                      (current) => ({
                        ...current,
                        email: value,
                      })
                    )
                  }
                  placeholder="vendor@example.com"
                />

                <FormInput
                  label="Phone Number"
                  value={
                    form.phoneNumber
                  }
                  onChange={(
                    value
                  ) =>
                    setForm(
                      (current) => ({
                        ...current,
                        phoneNumber:
                          value,
                      })
                    )
                  }
                  placeholder="+254..."
                />

                <FormInput
                  label="KRA PIN / Tax Number"
                  value={
                    form.taxNumber
                  }
                  onChange={(
                    value
                  ) =>
                    setForm(
                      (current) => ({
                        ...current,
                        taxNumber:
                          value,
                      })
                    )
                  }
                  placeholder="Enter tax number"
                />

                <div className="md:col-span-2">
                  <FormInput
                    label="Business Address"
                    value={
                      form.address
                    }
                    onChange={(
                      value
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          address:
                            value,
                        })
                      )
                    }
                    placeholder="Enter business address"
                  />
                </div>
              </div>

              <div className="mt-7 flex justify-end gap-3 border-t border-[#E8EAF0] pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-[#E8EAF0] px-5 py-2.5 text-sm font-semibold text-[#687086] transition hover:bg-[#F7F8FA] disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B7A70] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : editing ? (
                    <Edit3
                      size={17}
                    />
                  ) : (
                    <Plus
                      size={17}
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Create Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================
          VENDOR DETAIL
      =================================================== */}

      {selectedVendor && (
        <VendorDetail
          vendor={
            selectedVendor
          }
          loading={
            detailLoading
          }
          onClose={() =>
            setSelectedVendor(
              null
            )
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   SORTABLE HEADER
========================================================= */

function SortableHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string;
  field: VendorSortField;
  sortBy: VendorSortField;
  sortOrder: VendorSortOrder;
  onSort: (
    field: VendorSortField
  ) => void;
}) {
  const active =
    sortBy === field;

  return (
    <th className="px-5 py-3">
      <button
        type="button"
        onClick={() =>
          onSort(field)
        }
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-[#7B8498] hover:text-[#20243A]"
      >
        {label}

        <span
          className={
            active
              ? "text-[#0D9488]"
              : "text-[#B1B6C2]"
          }
        >
          {active
            ? sortOrder ===
              "asc"
              ? "↑"
              : "↓"
            : "↕"}
        </span>
      </button>
    </th>
  );
}

/* =========================================================
   PAGINATION BUTTON
========================================================= */

function PaginationButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E8EAF0] bg-white px-2.5 text-sm font-semibold text-[#687086] transition hover:bg-[#F7F8FA] hover:text-[#20243A] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}

      <span className="hidden xl:inline">
        {label}
      </span>
    </button>
  );
}

/* =========================================================
   FORM INPUT
========================================================= */

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#20243A]">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        type={type}
        required={required}
        className="w-full rounded-xl border border-[#E8EAF0] px-4 py-3 text-sm outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
      />
    </label>
  );
}

/* =========================================================
   VENDOR ACTIONS
========================================================= */

function VendorActions({
  vendor,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  vendor: Vendor;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        className="rounded-lg p-2 text-[#687086] hover:bg-[#F4F5F7] disabled:opacity-50"
        aria-label={`Actions for ${vendor.name}`}
      >
        {busy ? (
          <Loader2
            size={18}
            className="animate-spin"
          />
        ) : (
          <MoreVertical
            size={18}
          />
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() =>
              setOpen(false)
            }
          />

          <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-xl border border-[#E8EAF0] bg-white py-1 text-left shadow-xl">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#20243A] hover:bg-[#F7F8FA]"
            >
              <Edit3
                size={16}
              />

              Edit Vendor
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onToggle();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#20243A] hover:bg-[#F7F8FA]"
            >
              <CheckCircle2
                size={16}
              />

              {vendor.status ===
              "ACTIVE"
                ? "Deactivate"
                : "Activate"}
            </button>

            <div className="my-1 border-t border-[#E8EAF0]" />

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2
                size={16}
              />

              Delete Vendor
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* =========================================================
   VENDOR DETAIL
========================================================= */

function VendorDetail({
  vendor,
  loading,
  onClose,
}: {
  vendor: Vendor360;
  loading: boolean;
  onClose: () => void;
}) {
  const counts =
    vendor._count ?? {
      expenses: 0,
      payables: 0,
      procurementRequests: 0,
    };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        {/* HEADER */}

        <div className="sticky top-0 z-10 border-b border-[#E8EAF0] bg-white px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F3F5F7]">
                <Building2
                  size={22}
                  className="text-[#20243A]"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-bold text-[#20243A]">
                    {
                      vendor.name
                    }
                  </h2>

                  <StatusBadge
                    status={
                      vendor.status
                    }
                  />
                </div>

                <p className="mt-1 font-mono text-sm text-[#687086]">
                  {
                    vendor.vendorCode
                  }
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-[#F5F6F8]"
              aria-label="Close vendor details"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin text-[#20243A]"
            />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            {/* ACTIVITY */}

            <div className="grid gap-3 md:grid-cols-3">
              <ActivityCard
                label="Expenses"
                value={
                  counts.expenses
                }
                icon={
                  <FileText
                    size={18}
                  />
                }
              />

              <ActivityCard
                label="Payables"
                value={
                  counts.payables
                }
                icon={
                  <WalletCards
                    size={18}
                  />
                }
              />

              <ActivityCard
                label="Procurement"
                value={
                  counts.procurementRequests
                }
                icon={
                  <ShoppingCart
                    size={18}
                  />
                }
              />
            </div>

            {/* INFORMATION */}

            <section className="rounded-2xl border border-[#E8EAF0] p-5">
              <h3 className="font-semibold text-[#20243A]">
                Vendor Information
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Info
                  label="Email"
                  value={
                    vendor.email ||
                    "Not provided"
                  }
                />

                <Info
                  label="Phone"
                  value={
                    vendor.phoneNumber ||
                    "Not provided"
                  }
                />

                <Info
                  label="Tax Number"
                  value={
                    vendor.taxNumber ||
                    "Not provided"
                  }
                />

                <Info
                  label="Created"
                  value={formatDate(
                    vendor.createdAt
                  )}
                />

                <div className="md:col-span-2">
                  <Info
                    label="Address"
                    value={
                      vendor.address ||
                      "Not provided"
                    }
                  />
                </div>
              </div>
            </section>

            {/* EXPENSES */}

            <VendorActivitySection
              title="Expenses"
              count={
                counts.expenses
              }
            >
              {vendor.expenses
                ?.length ? (
                vendor.expenses.map(
                  (
                    expense
                  ) => (
                    <ActivityRow
                      key={
                        expense.id
                      }
                      title={
                        expense.expenseCode ||
                        "Expense"
                      }
                      subtitle={`${formatDate(
                        expense.expenseDate ||
                          expense.createdAt
                      )}${
                        expense.status
                          ? ` · ${expense.status}`
                          : ""
                      }`}
                      amount={formatMoney(
                        expense.amount
                      )}
                    />
                  )
                )
              ) : (
                <EmptyActivity
                  message="No expenses linked to this vendor."
                />
              )}
            </VendorActivitySection>

            {/* PAYABLES */}

            <VendorActivitySection
              title="Accounts Payable"
              count={
                counts.payables
              }
            >
              {vendor.payables
                ?.length ? (
                vendor.payables.map(
                  (
                    payable
                  ) => (
                    <ActivityRow
                      key={
                        payable.id
                      }
                      title={
                        payable.invoiceNumber ||
                        "Payable"
                      }
                      subtitle={
                        payable.status ||
                        "Recorded"
                      }
                      amount={formatMoney(
                        payable.amount
                      )}
                    />
                  )
                )
              ) : (
                <EmptyActivity
                  message="No payables linked to this vendor."
                />
              )}
            </VendorActivitySection>

            {/* PROCUREMENT */}

            <VendorActivitySection
              title="Procurement"
              count={
                counts.procurementRequests
              }
            >
              {vendor
                .procurementRequests
                ?.length ? (
                vendor.procurementRequests.map(
                  (
                    request
                  ) => (
                    <ActivityRow
                      key={
                        request.id
                      }
                      title={
                        request.requestCode ||
                        "Request"
                      }
                      subtitle={`${request.item || "Procurement request"} · ${
                        request.status ||
                        "Pending"
                      }`}
                      amount={formatMoney(
                        request.estimatedAmount
                      )}
                    />
                  )
                )
              ) : (
                <EmptyActivity
                  message="No procurement requests linked to this vendor."
                />
              )}
            </VendorActivitySection>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   VENDOR ACTIVITY SECTION
========================================================= */

function VendorActivitySection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-[#20243A]">
          {title}
        </h3>

        <span className="text-xs text-[#687086]">
          {formatNumber(
            count
          )}{" "}
          records
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E8EAF0]">
        {children}
      </div>
    </section>
  );
}

/* =========================================================
   ACTIVITY ROW
========================================================= */

function ActivityRow({
  title,
  subtitle,
  amount,
}: {
  title: string;
  subtitle: string;
  amount: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EEF0F4] px-4 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#20243A]">
          {title}
        </p>

        <p className="mt-0.5 truncate text-xs text-[#687086]">
          {subtitle}
        </p>
      </div>

      <p className="shrink-0 text-sm font-semibold text-[#20243A]">
        {amount}
      </p>
    </div>
  );
}

/* =========================================================
   EMPTY ACTIVITY
========================================================= */

function EmptyActivity({
  message,
}: {
  message: string;
}) {
  return (
    <p className="px-4 py-6 text-sm text-[#687086]">
      {message}
    </p>
  );
}

/* =========================================================
   ACTIVITY CARD
========================================================= */

function ActivityCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E8EAF0] bg-[#FAFBFC] p-4">
      <div className="flex items-center gap-2 text-[#687086]">
        {icon}

        <span className="text-xs font-medium">
          {label}
        </span>
      </div>

      <p className="mt-2 text-2xl font-bold text-[#20243A]">
        {formatNumber(
          value
        )}
      </p>
    </div>
  );
}

/* =========================================================
   INFO
========================================================= */

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[#8991A3]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm text-[#20243A]">
        {value}
      </p>
    </div>
  );
}