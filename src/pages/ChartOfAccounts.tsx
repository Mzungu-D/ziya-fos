import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Wallet,
  Landmark,
  ShieldCheck,
  TrendingUp,
  ReceiptText,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

type AccountParent = {
  id: string;
  code: string;
  name: string;
};

type AccountChild = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  description?: string | null;
  parentId?: string | null;
  parent?: AccountParent | null;
  children?: AccountChild[];
};

type AccountForm = {
  name: string;
  type: string;
  description: string;
  parentId: string;
};

type StructureFilter =
  | "all"
  | "parent"
  | "subaccount";

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type AccountSummary = {
  total: number;
  assets: number;
  liabilities: number;
  equity: number;
  income: number;
  expenses: number;
};

type AccountsResponse = {
  success?: boolean;
  accounts?: Account[];
  pagination?: Pagination;
  summary?: AccountSummary;
  message?: string;
};

type ParentAccountsResponse = {
  success?: boolean;
  accounts?: Account[];
  message?: string;
};

type InitializeDefaultsResponse = {
  success?: boolean;
  message?: string;
  createdCount?: number;
  totalStandardAccounts?: number;
};

/* =========================================================
   CONSTANTS
========================================================= */

const emptyForm: AccountForm = {
  name: "",
  type: "",
  description: "",
  parentId: "",
};

const accountTypes = [
  "Asset",
  "Liability",
  "Equity",
  "Income",
  "Expense",
] as const;

const typeOrder: Record<string, number> = {
  Asset: 1,
  Liability: 2,
  Equity: 3,
  Income: 4,
  Expense: 5,
};

const PAGE_SIZE_OPTIONS = [
  25,
  50,
  100,
] as const;

const typeMeta: Record<
  string,
  {
    label: string;
    description: string;
    icon: typeof Wallet;
    iconClass: string;
    badgeClass: string;
    sectionClass: string;
  }
> = {
  Asset: {
    label: "Assets",
    description:
      "Resources owned or controlled by the organization",
    icon: Wallet,
    iconClass:
      "bg-emerald-50 text-emerald-600",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-100",
    sectionClass:
      "border-l-emerald-400",
  },

  Liability: {
    label: "Liabilities",
    description:
      "Amounts the organization owes to others",
    icon: Landmark,
    iconClass:
      "bg-blue-50 text-blue-600",
    badgeClass:
      "bg-blue-50 text-blue-700 border-blue-100",
    sectionClass:
      "border-l-blue-400",
  },

  Equity: {
    label: "Equity",
    description:
      "Owner or shareholder interest in the organization",
    icon: ShieldCheck,
    iconClass:
      "bg-violet-50 text-violet-600",
    badgeClass:
      "bg-violet-50 text-violet-700 border-violet-100",
    sectionClass:
      "border-l-violet-400",
  },

  Income: {
    label: "Income",
    description:
      "Revenue and other income earned by the organization",
    icon: TrendingUp,
    iconClass:
      "bg-amber-50 text-amber-600",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-100",
    sectionClass:
      "border-l-amber-400",
  },

  Expense: {
    label: "Expenses",
    description:
      "Costs incurred in operating the organization",
    icon: ReceiptText,
    iconClass:
      "bg-rose-50 text-rose-600",
    badgeClass:
      "bg-rose-50 text-rose-700 border-rose-100",
    sectionClass:
      "border-l-rose-400",
  },
};

/* =========================================================
   HELPERS
========================================================= */

const normalizeType = (
  type: string
): string => {
  const match = accountTypes.find(
    (item) =>
      item.toLowerCase() ===
      type.toLowerCase()
  );

  return match ?? type;
};

const sortAccounts = (
  items: Account[]
): Account[] =>
  [...items].sort((a, b) => {
    const typeDifference =
      (typeOrder[
        normalizeType(a.type)
      ] ?? 99) -
      (typeOrder[
        normalizeType(b.type)
      ] ?? 99);

    if (typeDifference !== 0) {
      return typeDifference;
    }

    return a.code.localeCompare(
      b.code,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      }
    );
  });

const emptyPagination: Pagination = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

const emptySummary: AccountSummary = {
  total: 0,
  assets: 0,
  liabilities: 0,
  equity: 0,
  income: 0,
  expenses: 0,
};

/* =========================================================
   COMPONENT
========================================================= */

export default function ChartOfAccounts() {
  /* =======================================================
     DATA
  ======================================================= */

  const [accounts, setAccounts] =
    useState<Account[]>([]);

  const [parentAccounts, setParentAccounts] =
    useState<Account[]>([]);

  const [pagination, setPagination] =
    useState<Pagination>(
      emptyPagination
    );

  const [summary, setSummary] =
    useState<AccountSummary>(
      emptySummary
    );

  /* =======================================================
     FILTERS
  ======================================================= */

  const [search, setSearch] =
    useState("");

  const [typeFilter, setTypeFilter] =
    useState("All");

  const [structureFilter, setStructureFilter] =
    useState<StructureFilter>("all");

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  /* =======================================================
     UI STATE
  ======================================================= */

  const [loading, setLoading] =
    useState(true);

  const [parentLoading, setParentLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [initializingDefaults, setInitializingDefaults] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingAccount, setEditingAccount] =
    useState<Account | null>(null);

  const [form, setForm] =
    useState<AccountForm>(
      emptyForm
    );

  const [isSubaccount, setIsSubaccount] =
    useState(false);

  /* =======================================================
     LOAD ACCOUNTS
  ======================================================= */

  const loadAccounts = useCallback(
    async (
      requestedPage = page,
      requestedPageSize = pageSize
    ) => {
      try {
        setLoading(true);
        setError("");

        const params =
          new URLSearchParams();

        params.set(
          "page",
          String(requestedPage)
        );

        params.set(
          "pageSize",
          String(requestedPageSize)
        );

        const trimmedSearch =
          search.trim();

        if (trimmedSearch) {
          params.set(
            "search",
            trimmedSearch
          );
        }

        if (
          typeFilter !== "All"
        ) {
          params.set(
            "type",
            typeFilter.toUpperCase()
          );
        }

        if (
          structureFilter !==
          "all"
        ) {
          params.set(
            "structure",
            structureFilter
          );
        }

        const response =
          await authenticatedFetch(
            `/api/accounts?${params.toString()}`
          );

        const data =
          (await response.json()) as AccountsResponse;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load accounts"
          );
        }

        const nextAccounts =
          Array.isArray(
            data.accounts
          )
            ? data.accounts
            : [];

        const nextPagination =
          data.pagination ??
          emptyPagination;

        setAccounts(
          nextAccounts
        );

        setPagination(
          nextPagination
        );

        setSummary(
          data.summary ??
            emptySummary
        );

        /*
         * Backend can move the requested
         * page to the final valid page
         * after filtering.
         */
        if (
          nextPagination.page !==
          requestedPage
        ) {
          setPage(
            nextPagination.page
          );
        }
      } catch (requestError) {
        console.error(
          "ACCOUNT LOAD ERROR:",
          requestError
        );

        setAccounts([]);

        setPagination(
          emptyPagination
        );

        setSummary(
          emptySummary
        );

        setError(
          requestError instanceof
          Error
            ? requestError.message
            : "Unable to load accounts"
        );
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      pageSize,
      search,
      typeFilter,
      structureFilter,
    ]
  );

  /* =======================================================
     LOAD ALL PARENT ACCOUNTS

     Parent options cannot use the paginated
     table endpoint because an account may be
     on another page.
  ======================================================= */

  const loadParentAccounts =
    useCallback(
      async (
        accountType?: string
      ) => {
        try {
          setParentLoading(true);

          const params =
            new URLSearchParams();

          params.set(
            "page",
            "1"
          );

          /*
           * The backend supports a maximum
           * page size of 100. For the parent
           * selector we request the maximum
           * supported page size.
           */
          params.set(
            "pageSize",
            "100"
          );

          if (accountType) {
            params.set(
              "type",
              accountType.toUpperCase()
            );
          }

          params.set(
            "structure",
            "parent"
          );

          const response =
            await authenticatedFetch(
              `/api/accounts?${params.toString()}`
            );

          const data =
            (await response.json()) as ParentAccountsResponse;

          if (!response.ok) {
            throw new Error(
              data.message ||
                "Failed to load parent accounts"
            );
          }

          setParentAccounts(
            Array.isArray(
              data.accounts
            )
              ? sortAccounts(
                  data.accounts
                )
              : []
          );
        } catch (requestError) {
          console.error(
            "PARENT ACCOUNT LOAD ERROR:",
            requestError
          );

          setParentAccounts([]);
        } finally {
          setParentLoading(false);
        }
      },
      []
    );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void loadAccounts(
      page,
      pageSize
    );
  }, [
    page,
    pageSize,
    search,
    typeFilter,
    structureFilter,
    loadAccounts,
  ]);

  /* =======================================================
     LOAD PARENTS WHEN TYPE CHANGES
  ======================================================= */

  useEffect(() => {
    if (
      isSubaccount &&
      form.type
    ) {
      void loadParentAccounts(
        form.type
      );
    } else {
      setParentAccounts([]);
    }
  }, [
    isSubaccount,
    form.type,
    loadParentAccounts,
  ]);

  /* =======================================================
     GROUP CURRENT PAGE
  ======================================================= */

  const groupedAccounts =
    useMemo(() => {
      const groups =
        new Map<
          string,
          Account[]
        >();

      for (
        const account of accounts
      ) {
        const type =
          normalizeType(
            account.type
          );

        if (!groups.has(type)) {
          groups.set(
            type,
            []
          );
        }

        groups
          .get(type)!
          .push(account);
      }

      return Array.from(
        groups.entries()
      ).sort(
        ([a], [b]) =>
          (typeOrder[a] ??
            99) -
          (typeOrder[b] ??
            99)
      );
    }, [accounts]);

  /* =======================================================
     PARENT OPTIONS
  ======================================================= */

  const parentOptions =
    useMemo(() => {
      if (!form.type) {
        return [];
      }

      const selectedType =
        normalizeType(
          form.type
        );

      return sortAccounts(
        parentAccounts.filter(
          (account) => {
            if (
              account.id ===
              editingAccount?.id
            ) {
              return false;
            }

            return (
              normalizeType(
                account.type
              ) ===
              selectedType
            );
          }
        )
      );
    }, [
      parentAccounts,
      editingAccount,
      form.type,
    ]);

  /* =======================================================
     FILTER HANDLERS
  ======================================================= */

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("All");
    setStructureFilter("all");
    setPage(1);
  };

  const hasFilters =
    Boolean(search.trim()) ||
    typeFilter !== "All" ||
    structureFilter !==
      "all";

  const isEmptyOrganization =
    !loading &&
    pagination.total === 0 &&
    !hasFilters;

  const handleSearchChange = (
    value: string
  ) => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeFilterChange = (
    value: string
  ) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleStructureFilterChange =
    (
      value: StructureFilter
    ) => {
      setStructureFilter(
        value
      );
      setPage(1);
    };

  const handlePageSizeChange = (
    value: number
  ) => {
    setPageSize(value);
    setPage(1);
  };

  /* =======================================================
     INITIALIZE STANDARD CHART

     This is the ONLY frontend action that can request
     creation of the standard chart of accounts.

     GET /api/accounts remains strictly read-only.
  ======================================================= */

  const initializeDefaultAccounts =
    async () => {
      if (initializingDefaults) {
        return;
      }

      const confirmed =
        window.confirm(
          "This will add the standard chart of accounts to this organization. Continue?"
        );

      if (!confirmed) {
        return;
      }

      try {
        setInitializingDefaults(true);
        setError("");
        setSuccess("");

        const response =
          await authenticatedFetch(
            "/api/accounts/initialize-defaults",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },
            }
          );

        const data =
          (await response.json()) as InitializeDefaultsResponse;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to initialize the standard chart of accounts."
          );
        }

        setPage(1);

        setSuccess(
          data.message ||
            "Standard chart of accounts initialized successfully."
        );

        await loadAccounts(
          1,
          pageSize
        );
      } catch (requestError) {
        console.error(
          "INITIALIZE DEFAULT ACCOUNTS ERROR:",
          requestError
        );

        setError(
          requestError instanceof
          Error
            ? requestError.message
            : "Unable to initialize the standard chart of accounts."
        );
      } finally {
        setInitializingDefaults(false);
      }
    };

  /* =======================================================
     MODAL
  ======================================================= */

  const openCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setIsSubaccount(false);
    setParentAccounts([]);
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEdit = (
    account: Account
  ) => {
    setEditingAccount(account);

    const normalizedType =
      normalizeType(
        account.type
      );

    setForm({
      name: account.name,
      type: normalizedType,
      description:
        account.description ||
        "",
      parentId:
        account.parentId ||
        "",
    });

    setIsSubaccount(
      Boolean(account.parentId)
    );

    setError("");
    setSuccess("");
    setModalOpen(true);

    if (account.parentId) {
      void loadParentAccounts(
        normalizedType
      );
    }
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingAccount(null);
    setForm(emptyForm);
    setIsSubaccount(false);
    setParentAccounts([]);
    setError("");
  };

  /* =======================================================
     ACCOUNT FORM
  ======================================================= */

  const handleTypeChange = (
    type: string
  ) => {
    setForm((current) => ({
      ...current,
      type,
      parentId: "",
    }));

    setParentAccounts([]);
    setIsSubaccount(false);
  };

  const handleSubaccountChange =
    (
      checked: boolean
    ) => {
      setIsSubaccount(
        checked
      );

      if (!checked) {
        setForm((current) => ({
          ...current,
          parentId: "",
        }));

        setParentAccounts([]);
      }
    };

  /* =======================================================
     SAVE ACCOUNT
  ======================================================= */

  const saveAccount = async () => {
    const name =
      form.name.trim();

    const type =
      normalizeType(
        form.type
      );

    if (!name || !type) {
      setError(
        "Account name and account type are required."
      );
      return;
    }

    if (
      isSubaccount &&
      !form.parentId
    ) {
      setError(
        "Select a parent account for this subaccount."
      );
      return;
    }

    if (
      isSubaccount &&
      form.parentId ===
        editingAccount?.id
    ) {
      setError(
        "An account cannot be its own parent."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const editing =
        Boolean(
          editingAccount
        );

      const url = editing
        ? `/api/accounts/${editingAccount!.id}`
        : "/api/accounts";

      /*
       * Account codes are generated by
       * the backend when creating.
       *
       * Existing codes are preserved
       * when editing.
       */
      const payload = editing
        ? {
            code:
              editingAccount!.code,

            name,

            type,

            description:
              form.description.trim() ||
              null,

            parentId:
              isSubaccount &&
              form.parentId
                ? form.parentId
                : null,
          }
        : {
            name,

            type,

            description:
              form.description.trim() ||
              null,

            parentId:
              isSubaccount &&
              form.parentId
                ? form.parentId
                : null,
          };

      const response =
        await authenticatedFetch(
          url,
          {
            method: editing
              ? "PUT"
              : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              payload
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to save account"
        );
      }

      setModalOpen(false);
      setEditingAccount(null);
      setForm(emptyForm);
      setIsSubaccount(false);
      setParentAccounts([]);

      setSuccess(
        editing
          ? "Account updated successfully."
          : "Account created successfully."
      );

      /*
       * Reload the current page so the
       * table and summary reflect the
       * newly saved account.
       */
      await loadAccounts(
        page,
        pageSize
      );
    } catch (saveError) {
      console.error(
        "SAVE ACCOUNT ERROR:",
        saveError
      );

      setError(
        saveError instanceof
        Error
          ? saveError.message
          : "Unable to save account"
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     DELETE ACCOUNT
  ======================================================= */

  const deleteAccount = async (
    account: Account
  ) => {
    const confirmed =
      window.confirm(
        `Delete account ${account.code} — ${account.name}? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response =
        await authenticatedFetch(
          `/api/accounts/${account.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to delete account"
        );
      }

      setSuccess(
        "Account deleted successfully."
      );

      /*
       * If deleting the final row on a
       * page, move back one page when
       * necessary.
       */
      const shouldMoveBack =
        accounts.length === 1 &&
        page > 1;

      const nextPage =
        shouldMoveBack
          ? page - 1
          : page;

      if (
        shouldMoveBack
      ) {
        setPage(nextPage);
      }

      await loadAccounts(
        nextPage,
        pageSize
      );
    } catch (deleteError) {
      console.error(
        "DELETE ACCOUNT ERROR:",
        deleteError
      );

      setError(
        deleteError instanceof
        Error
          ? deleteError.message
          : "Unable to delete account"
      );
    }
  };

/* =======================================================
   FORMATTERS
======================================================= */

const getTypeMeta = (
  type: string
) =>
  typeMeta[
    normalizeType(type)
  ] ??
  typeMeta.Asset;

  /* =======================================================
     PAGINATION CONTROLS
  ======================================================= */

  const goToPreviousPage =
    () => {
      if (
        pagination.hasPreviousPage
      ) {
        setPage(
          Math.max(
            page - 1,
            1
          )
        );
      }
    };

  const goToNextPage = () => {
    if (
      pagination.hasNextPage
    ) {
      setPage(
        Math.min(
          page + 1,
          pagination.totalPages
        )
      );
    }
  };

  const firstVisibleRow =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          pagination.pageSize +
        1;

  const lastVisibleRow =
    pagination.total === 0
      ? 0
      : Math.min(
          pagination.page *
            pagination.pageSize,
          pagination.total
        );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full w-full bg-[#F7F8FB] px-3 py-4 sm:px-5 sm:py-6 lg:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0D9488] text-white shadow-sm">
                <Layers3
                  size={21}
                />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight text-[#20243A] sm:text-2xl">
                  Chart of Accounts
                </h1>

                <p className="mt-1 text-sm text-[#697386]">
                  Manage the accounts used to
                  organize your organization's
                  financial activity.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            disabled={
              initializingDefaults
            }
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F75] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus
              size={18}
            />

            Create Account
          </button>
        </div>

        {/* =================================================
            ALERTS
        ================================================= */}

        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="min-w-0">
              <p className="font-semibold">
                Something went wrong
              </p>

              <p className="mt-1 break-words">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="shrink-0 rounded-lg p-1 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="min-w-0">
              <p className="font-semibold">
                Success
              </p>

              <p className="mt-1 break-words">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              className="shrink-0 rounded-lg p-1 text-emerald-500 transition hover:bg-emerald-100 hover:text-emerald-700"
              aria-label="Dismiss success message"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Total */}
          <div className="rounded-2xl border border-[#E6E8EF] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#8A91A3]">
                  Total Accounts
                </p>

                <p className="mt-2 text-2xl font-bold text-[#20243A]">
                  {summary.total}
                </p>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
                <Layers3
                  size={17}
                />
              </div>
            </div>
          </div>

          {/* Assets */}
          <div className="rounded-2xl border border-[#E6E8EF] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#8A91A3]">
                  Assets
                </p>

                <p className="mt-2 text-2xl font-bold text-[#20243A]">
                  {summary.assets}
                </p>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet
                  size={17}
                />
              </div>
            </div>
          </div>

          {/* Liabilities */}
          <div className="rounded-2xl border border-[#E6E8EF] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#8A91A3]">
                  Liabilities
                </p>

                <p className="mt-2 text-2xl font-bold text-[#20243A]">
                  {summary.liabilities}
                </p>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Landmark
                  size={17}
                />
              </div>
            </div>
          </div>

          {/* Equity */}
          <div className="rounded-2xl border border-[#E6E8EF] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#8A91A3]">
                  Equity
                </p>

                <p className="mt-2 text-2xl font-bold text-[#20243A]">
                  {summary.equity}
                </p>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <ShieldCheck
                  size={17}
                />
              </div>
            </div>
          </div>

          {/* Income */}
          <div className="rounded-2xl border border-[#E6E8EF] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#8A91A3]">
                  Income
                </p>

                <p className="mt-2 text-2xl font-bold text-[#20243A]">
                  {summary.income}
                </p>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <TrendingUp
                  size={17}
                />
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className="rounded-2xl border border-[#E6E8EF] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#8A91A3]">
                  Expenses
                </p>

                <p className="mt-2 text-2xl font-bold text-[#20243A]">
                  {summary.expenses}
                </p>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <ReceiptText
                  size={17}
                />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            FILTER TOOLBAR
        ================================================= */}

        <div className="mt-6 rounded-2xl border border-[#E6E8EF] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA1B2]"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  handleSearchChange(
                    event.target.value
                  )
                }
                placeholder="Search accounts by code, name, type or description..."
                className="h-11 w-full rounded-xl border border-[#E4E6EE] bg-[#FBFCFE] pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#A2A8B7] focus:border-[#0D9488] focus:bg-white focus:ring-4 focus:ring-[#0D9488]/10"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {/* Type */}
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(event) =>
                    handleTypeFilterChange(
                      event.target.value
                    )
                  }
                  className="h-11 min-w-[150px] appearance-none rounded-xl border border-[#E4E6EE] bg-[#FBFCFE] pl-4 pr-10 text-sm font-medium text-[#3D4356] outline-none transition focus:border-[#0D9488] focus:bg-white focus:ring-4 focus:ring-[#0D9488]/10"
                >
                  <option value="All">
                    All Types
                  </option>

                  {accountTypes.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A6]"
                />
              </div>

              {/* Structure */}
              <div className="relative">
                <select
                  value={
                    structureFilter
                  }
                  onChange={(event) =>
                    handleStructureFilterChange(
                      event.target
                        .value as StructureFilter
                    )
                  }
                  className="h-11 min-w-[165px] appearance-none rounded-xl border border-[#E4E6EE] bg-[#FBFCFE] pl-4 pr-10 text-sm font-medium text-[#3D4356] outline-none transition focus:border-[#0D9488] focus:bg-white focus:ring-4 focus:ring-[#0D9488]/10"
                >
                  <option value="all">
                    All Accounts
                  </option>

                  <option value="parent">
                    Parent Accounts
                  </option>

                  <option value="subaccount">
                    Subaccounts
                  </option>
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A6]"
                />
              </div>

              {/* Page Size */}
              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(event) =>
                    handlePageSizeChange(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  className="h-11 min-w-[125px] appearance-none rounded-xl border border-[#E4E6EE] bg-[#FBFCFE] pl-4 pr-10 text-sm font-medium text-[#3D4356] outline-none transition focus:border-[#0D9488] focus:bg-white focus:ring-4 focus:ring-[#0D9488]/10"
                >
                  {PAGE_SIZE_OPTIONS.map(
                    (size) => (
                      <option
                        key={size}
                        value={size}
                      >
                        {size} / page
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A6]"
                />
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E4E6EE] bg-white px-4 text-sm font-semibold text-[#4C5367] transition hover:bg-[#F8F9FC]"
                >
                  <X size={16} />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-[#8990A2]">
            <SlidersHorizontal
              size={14}
            />

            <span>
              {hasFilters
                ? "Filters are active."
                : "Showing accounts for this organization."}
            </span>
          </div>
        </div>

        {/* =================================================
            CONTENT
        ================================================= */}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-[#E6E8EF] bg-white p-10 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <RefreshCw
                size={28}
                className="animate-spin text-[#0D9488]"
              />

              <p className="mt-4 text-sm font-semibold text-[#3D4356]">
                Loading Chart of Accounts...
              </p>

              <p className="mt-1 text-xs text-[#8A91A3]">
                Retrieving accounts for this
                organization.
              </p>
            </div>
          </div>
        ) : isEmptyOrganization ? (
          /* =================================================
             BRAND NEW / EMPTY ORGANIZATION
          ================================================= */

          <div className="mt-6 rounded-2xl border border-[#E6E8EF] bg-white px-5 py-12 shadow-sm sm:px-8 sm:py-16">
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ECFDFB] text-[#0D9488]">
                <Layers3
                  size={30}
                />
              </div>

              <h2 className="mt-5 text-xl font-bold tracking-tight text-[#20243A] sm:text-2xl">
                Your Chart of Accounts is empty
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#697386]">
                This organization has not created
                any accounts yet. You can start
                with the standard Chart of Accounts
                or create your own accounts based
                on the organization's accounting
                structure.
              </p>

              <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E6E8EF] bg-[#FBFCFE] p-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDFB] text-[#0D9488]">
                      <Layers3
                        size={17}
                      />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-[#20243A]">
                        Standard Accounts
                      </p>

                      <p className="mt-0.5 text-xs text-[#7B8395]">
                        Start with the FOS standard
                        account structure.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E6E8EF] bg-[#FBFCFE] p-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Plus
                        size={17}
                      />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-[#20243A]">
                        Custom Account
                      </p>

                      <p className="mt-0.5 text-xs text-[#7B8395]">
                        Build the organization's
                        structure manually.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    void initializeDefaultAccounts()
                  }
                  disabled={
                    initializingDefaults
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F75] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {initializingDefaults ? (
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Layers3
                      size={17}
                    />
                  )}

                  {initializingDefaults
                    ? "Setting up accounts..."
                    : "Use Standard Accounts"}
                </button>

                <button
                  type="button"
                  onClick={
                    openCreate
                  }
                  disabled={
                    initializingDefaults
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E4E6EE] bg-white px-5 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F9FC] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus
                    size={17}
                  />

                  Create Account
                </button>
              </div>

              <p className="mt-4 text-xs text-[#9299AA]">
                Standard accounts will only be added
                to this organization after you confirm.
              </p>
            </div>
          </div>
        ) : accounts.length === 0 ? (
          /* =================================================
             FILTERED EMPTY STATE
          ================================================= */

          <div className="mt-6 rounded-2xl border border-[#E6E8EF] bg-white p-10 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                <Search
                  size={22}
                />
              </div>

              <h2 className="mt-4 text-lg font-bold text-[#20243A]">
                No accounts found
              </h2>

              <p className="mt-2 max-w-md text-sm text-[#697386]">
                No accounts match the current
                search or filters.
              </p>

              {hasFilters && (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="mt-4 text-sm font-semibold text-[#0D9488] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          /* =================================================
             ACCOUNT GROUPS
          ================================================= */

          <div className="mt-6 space-y-5">
            {groupedAccounts.map(
              ([type, typeAccounts]) => {
                const meta =
                  getTypeMeta(type);

                const Icon =
                  meta.icon;

                return (
                  <section
                    key={type}
                    className={`overflow-hidden rounded-2xl border border-[#E6E8EF] border-l-4 bg-white shadow-sm ${meta.sectionClass}`}
                  >
                    {/* Group Header */}
                    <div className="flex flex-col gap-3 border-b border-[#EEF0F4] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconClass}`}
                        >
                          <Icon
                            size={18}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-bold text-[#20243A] sm:text-base">
                              {meta.label}
                            </h2>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                            >
                              {typeAccounts.length}
                              {" "}
                              shown
                            </span>
                          </div>

                          <p className="mt-0.5 text-xs text-[#7B8395]">
                            {meta.description}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 text-xs font-medium text-[#8A91A3]">
                        {summary[
                          type ===
                          "Asset"
                            ? "assets"
                            : type ===
                              "Liability"
                            ? "liabilities"
                            : type ===
                              "Equity"
                            ? "equity"
                            : type ===
                              "Income"
                            ? "income"
                            : "expenses"
                        ]}{" "}
                        total
                      </span>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[900px]">
                        <thead>
                          <tr className="border-b border-[#EEF0F4] bg-[#FBFCFE] text-left">
                            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A91A3]">
                              Code
                            </th>

                            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A91A3]">
                              Account
                            </th>

                            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A91A3]">
                              Description
                            </th>

                            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A91A3]">
                              Structure
                            </th>

                            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A91A3]">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {sortAccounts(
                            typeAccounts
                          ).map(
                            (
                              account
                            ) => (
                              <tr
                                key={
                                  account.id
                                }
                                className="border-b border-[#F0F1F5] last:border-b-0 transition hover:bg-[#FBFCFE]"
                              >
                                <td className="whitespace-nowrap px-5 py-4 align-top">
                                  <span className="inline-flex rounded-lg bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-[#4A5266]">
                                    {
                                      account.code
                                    }
                                  </span>
                                </td>

                                <td className="px-5 py-4 align-top">
                                  <div className="min-w-[180px]">
                                    <p className="break-words text-sm font-semibold text-[#20243A]">
                                      {
                                        account.name
                                      }
                                    </p>

                                    {account.parent && (
                                      <p className="mt-1 text-xs text-[#8A91A3]">
                                        Subaccount of{" "}
                                        <span className="font-medium text-[#626A7D]">
                                          {
                                            account
                                              .parent
                                              .code
                                          }{" "}
                                          —{" "}
                                          {
                                            account
                                              .parent
                                              .name
                                          }
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                </td>

                                <td className="px-5 py-4 align-top">
                                  <p className="max-w-[420px] break-words text-sm leading-5 text-[#697386]">
                                    {account.description ||
                                      "—"}
                                  </p>
                                </td>

                                <td className="px-5 py-4 align-top">
                                  {account.parent ? (
                                    <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                      Subaccount
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                      Parent
                                    </span>
                                  )}
                                </td>

                                <td className="px-5 py-4 align-top">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEdit(
                                          account
                                        )
                                      }
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E6EE] bg-white text-[#5C6477] transition hover:border-[#CBD0DB] hover:bg-[#F8F9FC] hover:text-[#20243A]"
                                      title="Edit account"
                                    >
                                      <Pencil
                                        size={
                                          15
                                        }
                                      />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void deleteAccount(
                                          account
                                        )
                                      }
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                      title="Delete account"
                                    >
                                      <Trash2
                                        size={
                                          15
                                        }
                                      />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="divide-y divide-[#EEF0F4] md:hidden">
                      {sortAccounts(
                        typeAccounts
                      ).map(
                        (
                          account
                        ) => (
                          <div
                            key={
                              account.id
                            }
                            className="p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex rounded-lg bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-[#4A5266]">
                                    {
                                      account.code
                                    }
                                  </span>

                                  {account.parent ? (
                                    <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                                      Subaccount
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                      Parent
                                    </span>
                                  )}
                                </div>

                                <h3 className="mt-2 break-words text-sm font-semibold text-[#20243A]">
                                  {
                                    account.name
                                  }
                                </h3>

                                {account.parent && (
                                  <p className="mt-1 break-words text-xs text-[#8A91A3]">
                                    Subaccount of{" "}
                                    <span className="font-medium text-[#626A7D]">
                                      {
                                        account
                                          .parent
                                          .code
                                      }{" "}
                                      —{" "}
                                      {
                                        account
                                          .parent
                                          .name
                                      }
                                    </span>
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEdit(
                                      account
                                    )
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E6EE] bg-white text-[#5C6477]"
                                  title="Edit account"
                                >
                                  <Pencil
                                    size={
                                      15
                                    }
                                  />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteAccount(
                                      account
                                    )
                                  }
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-500"
                                  title="Delete account"
                                >
                                  <Trash2
                                    size={
                                      15
                                    }
                                  />
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl bg-[#FBFCFE] p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A91A3]">
                                Description
                              </p>

                              <p className="mt-1 break-words text-xs leading-5 text-[#697386]">
                                {account.description ||
                                  "No description provided."}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                );
              }
            )}
          </div>
        )}

        {/* =================================================
            PAGINATION
        ================================================= */}

        {!loading &&
          !isEmptyOrganization &&
          pagination.total > 0 && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#E6E8EF] bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#7B8395] sm:text-sm">
                Showing{" "}
                <span className="font-semibold text-[#3D4356]">
                  {firstVisibleRow}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-[#3D4356]">
                  {lastVisibleRow}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[#3D4356]">
                  {pagination.total}
                </span>{" "}
                accounts
              </p>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs font-medium text-[#8A91A3]">
                  Page{" "}
                  <span className="text-[#3D4356]">
                    {pagination.page}
                  </span>{" "}
                  of{" "}
                  <span className="text-[#3D4356]">
                    {pagination.totalPages}
                  </span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={
                      goToPreviousPage
                    }
                    disabled={
                      !pagination.hasPreviousPage
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E6EE] bg-white text-[#5C6477] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft
                      size={16}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={
                      goToNextPage
                    }
                    disabled={
                      !pagination.hasNextPage
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E6EE] bg-white text-[#5C6477] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight
                      size={16}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* ===================================================
          CREATE / EDIT MODAL
      =================================================== */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
          <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#EEF0F4] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#20243A]">
                  {editingAccount
                    ? "Edit Account"
                    : "Create Account"}
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#7B8395]">
                  {editingAccount
                    ? "Update the account details and accounting classification."
                    : "Create an account for this organization's Chart of Accounts."}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={saving}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#7C8497] transition hover:bg-[#F5F6F9] hover:text-[#20243A] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              {error && (
                <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#626A7D]">
                    Account Name
                    <span className="ml-1 text-rose-500">
                      *
                    </span>
                  </label>

                  <input
                    type="text"
                    value={
                      form.name
                    }
                    onChange={(event) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          name:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="e.g. Main Operating Bank Account"
                    disabled={saving}
                    className="h-11 w-full rounded-xl border border-[#E4E6EE] bg-white px-3.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A2A8B7] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:bg-[#F7F8FB]"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#626A7D]">
                    Account Type
                    <span className="ml-1 text-rose-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <select
                      value={
                        form.type
                      }
                      onChange={(
                        event
                      ) =>
                        handleTypeChange(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                      className="h-11 w-full appearance-none rounded-xl border border-[#E4E6EE] bg-white px-3.5 pr-10 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:bg-[#F7F8FB]"
                    >
                      <option value="">
                        Select account type
                      </option>

                      {accountTypes.map(
                        (type) => (
                          <option
                            key={
                              type
                            }
                            value={
                              type
                            }
                          >
                            {
                              type
                            }
                          </option>
                        )
                      )}
                    </select>

                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A6]"
                    />
                  </div>
                </div>

                {/* Code */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#626A7D]">
                    Account Code
                  </label>

                  <div className="flex h-11 items-center rounded-xl border border-[#E4E6EE] bg-[#F7F8FB] px-3.5">
                    <span className="font-mono text-sm font-semibold text-[#697386]">
                      {editingAccount
                        ? editingAccount.code
                        : "Auto-generated"}
                    </span>
                  </div>

                  {!editingAccount && (
                    <p className="mt-1.5 text-[11px] text-[#8A91A3]">
                      The FOS will generate the
                      account code automatically
                      based on the account type.
                    </p>
                  )}
                </div>

                {/* Subaccount */}
                <div className="sm:col-span-2">
                  <div className="rounded-xl border border-[#E6E8EF] bg-[#FBFCFE] p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={
                          isSubaccount
                        }
                        onChange={(
                          event
                        ) =>
                          handleSubaccountChange(
                            event
                              .target
                              .checked
                          )
                        }
                        disabled={
                          saving ||
                          !form.type
                        }
                        className="mt-0.5 h-4 w-4 rounded border-[#CDD2DD] text-[#0D9488] focus:ring-[#0D9488]"
                      />

                      <span>
                        <span className="block text-sm font-semibold text-[#20243A]">
                          Make this a subaccount
                        </span>

                        <span className="mt-0.5 block text-xs leading-5 text-[#7B8395]">
                          Use this when the account
                          should sit underneath another
                          account of the same type.
                        </span>
                      </span>
                    </label>

                    {isSubaccount && (
                      <div className="mt-4">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#626A7D]">
                          Parent Account
                          <span className="ml-1 text-rose-500">
                            *
                          </span>
                        </label>

                        <div className="relative">
                          <select
                            value={
                              form.parentId
                            }
                            onChange={(
                              event
                            ) =>
                              setForm(
                                (
                                  current
                                ) => ({
                                  ...current,
                                  parentId:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            disabled={
                              saving ||
                              parentLoading ||
                              !form.type
                            }
                            className="h-11 w-full appearance-none rounded-xl border border-[#E4E6EE] bg-white px-3.5 pr-10 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:bg-[#F7F8FB]"
                          >
                            <option value="">
                              {parentLoading
                                ? "Loading parent accounts..."
                                : parentOptions.length ===
                                  0
                                ? "No parent accounts available"
                                : "Select parent account"}
                            </option>

                            {parentOptions.map(
                              (
                                parent
                              ) => (
                                <option
                                  key={
                                    parent.id
                                  }
                                  value={
                                    parent.id
                                  }
                                >
                                  {
                                    parent.code
                                  }{" "}
                                  —{" "}
                                  {
                                    parent.name
                                  }
                                </option>
                              )
                            )}
                          </select>

                          <ChevronDown
                            size={
                              16
                            }
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A6]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#626A7D]">
                    Description
                  </label>

                  <textarea
                    value={
                      form.description
                    }
                    onChange={(event) =>
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
                    placeholder="Describe what this account is used for..."
                    rows={4}
                    disabled={saving}
                    className="w-full resize-y rounded-xl border border-[#E4E6EE] bg-white px-3.5 py-3 text-sm leading-6 text-[#20243A] outline-none transition placeholder:text-[#A2A8B7] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:bg-[#F7F8FB]"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col-reverse gap-3 border-t border-[#EEF0F4] bg-[#FBFCFE] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E4E6EE] bg-white px-5 text-sm font-semibold text-[#4C5367] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveAccount()
                }
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F75] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                )}

                {saving
                  ? "Saving..."
                  : editingAccount
                  ? "Save Changes"
                  : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}