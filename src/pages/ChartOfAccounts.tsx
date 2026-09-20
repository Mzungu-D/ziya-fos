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
        `Delete ${account.code} - ${account.name}?`
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
       * If deleting the final account
       * on the current page, move back
       * to the previous page when possible.
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
      } else {
        await loadAccounts(
          nextPage,
          pageSize
        );
      }
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
     DISPLAY RANGE
  ======================================================= */

  const displayStart =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          pagination.pageSize +
        1;

  const displayEnd =
    Math.min(
      pagination.page *
        pagination.pageSize,
      pagination.total
    );

  /* =======================================================
     PAGE NUMBERS
  ======================================================= */

  const visiblePages =
    useMemo(() => {
      const totalPages =
        pagination.totalPages;

      const currentPage =
        pagination.page;

      if (totalPages <= 1) {
        return [1];
      }

      const pages: (
        | number
        | "ellipsis"
      )[] = [];

      if (totalPages <= 7) {
        for (
          let i = 1;
          i <= totalPages;
          i += 1
        ) {
          pages.push(i);
        }

        return pages;
      }

      pages.push(1);

      if (currentPage > 4) {
        pages.push("ellipsis");
      }

      const start =
        Math.max(
          2,
          currentPage - 1
        );

      const end =
        Math.min(
          totalPages - 1,
          currentPage + 1
        );

      for (
        let i = start;
        i <= end;
        i += 1
      ) {
        pages.push(i);
      }

      if (
        currentPage <
        totalPages - 3
      ) {
        pages.push("ellipsis");
      }

      pages.push(
        totalPages
      );

      return pages;
    }, [
      pagination.page,
      pagination.totalPages,
    ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-w-0 space-y-6 pb-8">
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section className="rounded-2xl border border-[#ECECF3] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(32,36,58,0.03)] sm:px-6 lg:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                <Layers3
                  size={22}
                />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-[#20243A] sm:text-3xl">
                  Chart of Accounts
                </h1>

                <p className="mt-1 text-sm text-[#666B84] sm:text-[15px]">
                  Organize the accounts
                  that power your
                  financial reporting
                  and general ledger.
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <button
              type="button"
              onClick={() =>
                void loadAccounts(
                  page,
                  pageSize
                )
              }
              disabled={loading}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#E4E6EE] bg-white px-4 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
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
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F75] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/15 sm:flex-none"
            >
              <Plus
                size={18}
              />
              New Account
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================
          MESSAGES
      =================================================== */}

      {error && !modalOpen && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-[0_1px_2px_rgba(32,36,58,0.03)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
            Total Accounts
          </p>

          <p className="mt-2 text-3xl font-bold leading-none tabular-nums tracking-tight text-[#20243A] sm:text-4xl">
            {loading
              ? "—"
              : summary.total}
          </p>

          <p className="mt-1 text-xs text-[#8A8FA3]">
            Organization accounts
          </p>
        </div>

        {accountTypes.map(
          (type) => {
            const meta =
              typeMeta[type];

            const Icon =
              meta.icon;

            const count =
              type ===
              "Asset"
                ? summary.assets
                : type ===
                  "Liability"
                ? summary.liabilities
                : type ===
                  "Equity"
                ? summary.equity
                : type ===
                  "Income"
                ? summary.income
                : summary.expenses;

            return (
              <div
                key={type}
                className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-[0_1px_2px_rgba(32,36,58,0.03)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.iconClass}`}
                  >
                    <Icon
                      size={16}
                    />
                  </div>

                  <span className="text-2xl font-bold leading-none tabular-nums tracking-tight text-[#20243A] sm:text-3xl">
                    {loading
                      ? "—"
                      : count}
                  </span>
                </div>

                <p className="mt-3 text-sm font-semibold text-[#20243A]">
                  {meta.label}
                </p>
              </div>
            );
          }
        )}
      </section>

      {/* ===================================================
          SEARCH / FILTERS
      =================================================== */}

      <section className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-[0_1px_2px_rgba(32,36,58,0.03)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                handleSearchChange(
                  event.target.value
                )
              }
              placeholder="Search by code, account name, type or description..."
              className="h-11 w-full rounded-xl border border-[#E4E6EE] bg-[#FBFCFE] pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B2] focus:border-[#0D9488] focus:bg-white focus:ring-4 focus:ring-[#0D9488]/10"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative">
              <span className="sr-only">
                Account type
              </span>

              <select
                value={typeFilter}
                onChange={(event) =>
                  handleTypeFilterChange(
                    event.target.value
                  )
                }
                className="h-11 w-full appearance-none rounded-xl border border-[#E4E6EE] bg-white pl-4 pr-10 text-sm font-medium text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 sm:w-44"
              >
                <option value="All">
                  All account types
                </option>

                {accountTypes.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {typeMeta[
                        type
                      ].label}
                    </option>
                  )
                )}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
              />
            </label>

            <label className="relative">
              <span className="sr-only">
                Account structure
              </span>

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
                className="h-11 w-full appearance-none rounded-xl border border-[#E4E6EE] bg-white pl-4 pr-10 text-sm font-medium text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 sm:w-44"
              >
                <option value="all">
                  All accounts
                </option>

                <option value="parent">
                  Main accounts
                </option>

                <option value="subaccount">
                  Subaccounts
                </option>
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
              />
            </label>

            {hasFilters && (
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#666B84] transition hover:bg-[#F8F9FC] hover:text-[#20243A]"
              >
                <SlidersHorizontal
                  size={16}
                />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-[#F0F1F5] pt-3 text-xs text-[#8A8FA3] sm:flex-row sm:items-center sm:justify-between">
          <span>
            {loading
              ? "Loading accounts..."
              : `Showing ${displayStart}-${displayEnd} of ${pagination.total} accounts`}
          </span>

          <div className="flex items-center gap-3">
            {!loading &&
              hasFilters && (
                <span className="font-medium text-[#0D9488]">
                  Filters active
                </span>
              )}

            <span className="hidden sm:inline">
              {pagination.totalPages >
              1
                ? `Page ${pagination.page} of ${pagination.totalPages}`
                : "All accounts"}
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================
          ACCOUNT LIST
      =================================================== */}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-[0_1px_2px_rgba(32,36,58,0.03)]">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center px-6 text-sm text-[#666B84]">
            <div className="flex items-center gap-3">
              <RefreshCw
                size={18}
                className="animate-spin text-[#0D9488]"
              />
              Loading Chart of
              Accounts...
            </div>
          </div>
        ) : groupedAccounts.length ===
          0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F5F9] text-[#8A8FA3]">
              <Search
                size={21}
              />
            </div>

            <h3 className="mt-4 text-base font-semibold text-[#20243A]">
              No accounts found
            </h3>

            <p className="mt-1 max-w-md text-sm text-[#8A8FA3]">
              Try changing your
              search or filters,
              or create a new
              account.
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
        ) : (
          <div className="divide-y divide-[#ECECF3]">
            {groupedAccounts.map(
              (
                [
                  type,
                  typeAccounts,
                ]
              ) => {
                const meta =
                  typeMeta[type] ??
                  typeMeta.Asset;

                const Icon =
                  meta.icon;

                return (
                  <div
                    key={type}
                    className="min-w-0"
                  >
                    {/* =====================================
                        CATEGORY HEADER
                    ===================================== */}

                    <div
                      className={`flex min-w-0 flex-col gap-2 border-l-4 bg-[#FBFCFE] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${meta.sectionClass}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}
                        >
                          <Icon
                            size={18}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold uppercase tracking-wide text-[#20243A]">
                              {
                                meta.label
                              }
                            </h2>

                            <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold leading-none tabular-nums text-[#20243A] ring-1 ring-inset ring-[#E5E7EE]">
                              {
                                typeAccounts.length
                              }
                            </span>
                          </div>

                          <p className="mt-0.5 truncate text-xs text-[#8A8FA3]">
                            {
                              meta.description
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* =====================================
                        DESKTOP TABLE
                    ===================================== */}

                    <div className="hidden min-w-0 overflow-x-auto md:block">
                      <table className="w-full table-fixed">
                        <colgroup>
                          <col className="w-[110px]" />
                          <col />
                          <col className="w-[130px]" />
                          <col className="w-[260px]" />
                          <col className="w-[130px]" />
                          <col className="w-[110px]" />
                        </colgroup>

                        <thead>
                          <tr className="border-b border-[#ECECF3] bg-white text-left text-[11px] font-bold uppercase tracking-wider text-[#8A8FA3]">
                            <th className="px-6 py-3">
                              Code
                            </th>

                            <th className="px-4 py-3">
                              Account
                            </th>

                            <th className="px-4 py-3">
                              Type
                            </th>

                            <th className="px-4 py-3">
                              Parent Account
                            </th>

                            <th className="px-4 py-3">
                              Structure
                            </th>

                            <th className="px-6 py-3 text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {typeAccounts.map(
                            (
                              account
                            ) => {
                              const accountMeta =
                                typeMeta[
                                  normalizeType(
                                    account.type
                                  )
                                ] ??
                                typeMeta.Asset;

                              return (
                                <tr
                                  key={
                                    account.id
                                  }
                                  className="border-b border-[#F0F1F5] last:border-b-0 hover:bg-[#FBFCFE]"
                                >
                                  {/* CODE */}

                                  <td className="px-6 py-4 align-top">
                                    <span className="font-mono text-base font-bold tabular-nums text-[#20243A]">
                                      {
                                        account.code
                                      }
                                    </span>
                                  </td>

                                  {/* ACCOUNT */}

                                  <td className="min-w-0 px-4 py-4 align-top">
                                    <div className="min-w-0">
                                      <p
                                        className="truncate text-sm font-semibold text-[#20243A]"
                                        title={
                                          account.name
                                        }
                                      >
                                        {
                                          account.name
                                        }
                                      </p>

                                      {account.description && (
                                        <p
                                          className="mt-1 truncate text-xs text-[#8A8FA3]"
                                          title={
                                            account.description
                                          }
                                        >
                                          {
                                            account.description
                                          }
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  {/* TYPE */}

                                  <td className="px-4 py-4 align-top">
                                    <span
                                      className={`inline-flex max-w-full truncate rounded-full border px-2.5 py-1 text-xs font-semibold ${accountMeta.badgeClass}`}
                                    >
                                      {normalizeType(
                                        account.type
                                      )}
                                    </span>
                                  </td>

                                  {/* PARENT */}

                                  <td className="min-w-0 px-4 py-4 align-top">
                                    {account.parent ? (
                                      <div
                                        className="min-w-0 max-w-[230px]"
                                        title={`${account.parent.code} — ${account.parent.name}`}
                                      >
                                        <p className="truncate font-mono text-sm font-bold tabular-nums text-[#20243A]">
                                          {
                                            account
                                              .parent
                                              .code
                                          }
                                        </p>

                                        <p className="mt-0.5 truncate text-xs text-[#666B84]">
                                          {
                                            account
                                              .parent
                                              .name
                                          }
                                        </p>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-[#A0A4B2]">
                                        —
                                      </span>
                                    )}
                                  </td>

                                  {/* STRUCTURE */}

                                  <td className="px-4 py-4 align-top">
                                    {account.parentId ? (
                                      <span className="text-xs font-medium text-[#666B84]">
                                        Subaccount
                                      </span>
                                    ) : (
                                      <span className="text-xs font-medium text-[#666B84]">
                                        Main account
                                      </span>
                                    )}
                                  </td>

                                  {/* ACTIONS */}

                                  <td className="px-6 py-4 align-top">
                                    <div className="flex justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openEdit(
                                            account
                                          )
                                        }
                                        className="rounded-lg p-2 text-[#666B84] transition hover:bg-[#0D9488]/10 hover:text-[#0D9488]"
                                        title="Edit account"
                                        aria-label="Edit account"
                                      >
                                        <Pencil
                                          size={
                                            17
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
                                        className="rounded-lg p-2 text-[#8A8FA3] transition hover:bg-red-50 hover:text-red-600"
                                        title="Delete account"
                                        aria-label="Delete account"
                                      >
                                        <Trash2
                                          size={
                                            17
                                          }
                                        />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* =====================================
                        MOBILE LIST
                    ===================================== */}

                    <div className="divide-y divide-[#F0F1F5] md:hidden">
                      {typeAccounts.map(
                        (
                          account
                        ) => {
                          const accountMeta =
                            typeMeta[
                              normalizeType(
                                account.type
                              )
                            ] ??
                            typeMeta.Asset;

                          return (
                            <div
                              key={
                                account.id
                              }
                              className="min-w-0 p-4"
                            >
                              <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-bold tabular-nums text-[#20243A]">
                                      {
                                        account.code
                                      }
                                    </span>

                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${accountMeta.badgeClass}`}
                                    >
                                      {normalizeType(
                                        account.type
                                      )}
                                    </span>
                                  </div>

                                  <p
                                    className="mt-2 truncate text-sm font-semibold text-[#20243A]"
                                    title={
                                      account.name
                                    }
                                  >
                                    {
                                      account.name
                                    }
                                  </p>

                                  {account.description && (
                                    <p
                                      className="mt-1 truncate text-xs leading-5 text-[#8A8FA3]"
                                      title={
                                        account.description
                                      }
                                    >
                                      {
                                        account.description
                                      }
                                    </p>
                                  )}

                                  {account.parent ? (
                                    <div
                                      className="mt-3 min-w-0 max-w-full text-xs text-[#666B84]"
                                      title={`${account.parent.code} — ${account.parent.name}`}
                                    >
                                      <span className="text-[#8A8FA3]">
                                        Parent:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {
                                          account
                                            .parent
                                            .code
                                        }{" "}
                                        —{" "}
                                        <span className="inline-block max-w-[calc(100%-55px)] truncate align-bottom">
                                          {
                                            account
                                              .parent
                                              .name
                                          }
                                        </span>
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="mt-3 text-xs text-[#8A8FA3]">
                                      Main account
                                    </div>
                                  )}
                                </div>

                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEdit(
                                        account
                                      )
                                    }
                                    className="rounded-lg p-2 text-[#666B84] transition hover:bg-[#0D9488]/10 hover:text-[#0D9488]"
                                    title="Edit account"
                                    aria-label="Edit account"
                                  >
                                    <Pencil
                                      size={
                                        17
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
                                    className="rounded-lg p-2 text-[#8A8FA3] transition hover:bg-red-50 hover:text-red-600"
                                    title="Delete account"
                                    aria-label="Delete account"
                                  >
                                    <Trash2
                                      size={
                                        17
                                      }
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* ===================================================
          PAGINATION
      =================================================== */}

      {!loading &&
        pagination.total > 0 && (
          <section className="rounded-2xl border border-[#ECECF3] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(32,36,58,0.03)] sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* RANGE */}

              <div className="text-sm text-[#666B84]">
                Showing{" "}
                <span className="font-semibold text-[#20243A]">
                  {displayStart}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-[#20243A]">
                  {displayEnd}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[#20243A]">
                  {pagination.total}
                </span>{" "}
                accounts
              </div>

              {/* CONTROLS */}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* PAGE SIZE */}

                <label className="flex items-center gap-2 text-sm text-[#666B84]">
                  <span className="whitespace-nowrap">
                    Rows per page
                  </span>

                  <div className="relative">
                    <select
                      value={
                        pageSize
                      }
                      onChange={(
                        event
                      ) =>
                        handlePageSizeChange(
                          Number(
                            event
                              .target
                              .value
                          )
                        )
                      }
                      className="h-9 appearance-none rounded-lg border border-[#E4E6EE] bg-white pl-3 pr-8 text-sm font-semibold text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                    >
                      {PAGE_SIZE_OPTIONS.map(
                        (
                          option
                        ) => (
                          <option
                            key={
                              option
                            }
                            value={
                              option
                            }
                          >
                            {
                              option
                            }
                          </option>
                        )
                      )}
                    </select>

                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
                    />
                  </div>
                </label>

                {/* PAGE NAVIGATION */}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={
                      !pagination.hasPreviousPage
                    }
                    onClick={() =>
                      setPage(
                        (
                          current
                        ) =>
                          Math.max(
                            current -
                              1,
                            1
                          )
                      )
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E6EE] bg-white text-[#666B84] transition hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                    title="Previous page"
                  >
                    <ChevronLeft
                      size={17}
                    />
                  </button>

                  <div className="flex items-center gap-1">
                    {visiblePages.map(
                      (
                        item,
                        index
                      ) =>
                        item ===
                        "ellipsis" ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="flex h-9 w-8 items-center justify-center text-sm text-[#8A8FA3]"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={
                              item
                            }
                            type="button"
                            onClick={() =>
                              setPage(
                                item
                              )
                            }
                            className={`hidden h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold transition sm:inline-flex ${
                              item ===
                              pagination.page
                                ? "bg-[#0D9488] text-white shadow-sm"
                                : "text-[#666B84] hover:bg-[#F4F5F9] hover:text-[#20243A]"
                            }`}
                            aria-current={
                              item ===
                              pagination.page
                                ? "page"
                                : undefined
                            }
                          >
                            {item}
                          </button>
                        )
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      !pagination.hasNextPage
                    }
                    onClick={() =>
                      setPage(
                        (
                          current
                        ) =>
                          Math.min(
                            current +
                              1,
                            pagination.totalPages
                          )
                      )
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4E6EE] bg-white text-[#666B84] transition hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                    title="Next page"
                  >
                    <ChevronRight
                      size={17}
                    />
                  </button>
                </div>

                {/* MOBILE PAGE INDICATOR */}

                <span className="text-center text-xs font-medium text-[#8A8FA3] sm:hidden">
                  Page{" "}
                  {pagination.page}{" "}
                  of{" "}
                  {pagination.totalPages}
                </span>
              </div>
            </div>
          </section>
        )}

      {/* ===================================================
          CREATE / EDIT MODAL
      =================================================== */}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/55 p-3 backdrop-blur-[2px] sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#E6E8EF] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            {/* MODAL HEADER */}

            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ECECF3] px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                  <Layers3
                    size={19}
                  />
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[#20243A] sm:text-xl">
                    {editingAccount
                      ? "Edit Account"
                      : "New Account"}
                  </h2>

                  <p className="mt-0.5 text-xs leading-5 text-[#8A8FA3] sm:text-sm">
                    {editingAccount
                      ? "Update the account details and hierarchy."
                      : "Add a new account to your general ledger structure."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={saving}
                className="shrink-0 rounded-lg p-2 text-[#8A8FA3] transition hover:bg-[#F4F5F9] hover:text-[#20243A] disabled:opacity-40"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-5">
                {/* ACCOUNT TYPE + CODE */}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* ACCOUNT TYPE */}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                      Account Type
                      <span className="ml-1 text-red-500">
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
                        className="h-11 w-full appearance-none rounded-xl border border-[#E0E3EB] bg-white px-3.5 pr-10 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                      >
                        <option value="">
                          Select account
                          type
                        </option>

                        {accountTypes.map(
                          (
                            type
                          ) => (
                            <option
                              key={
                                type
                              }
                              value={
                                type
                              }
                            >
                              {
                                typeMeta[
                                  type
                                ]
                                  .label
                              }
                            </option>
                          )
                        )}
                      </select>

                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-[#8A8FA3]">
                      Determines where
                      the account is
                      reported.
                    </p>
                  </div>

                  {/* ACCOUNT CODE */}

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                      Account Code
                    </label>

                    <input
                      type="text"
                      value={
                        editingAccount
                          ? editingAccount.code
                          : "Generated automatically"
                      }
                      readOnly
                      aria-readonly="true"
                      className="h-11 w-full cursor-not-allowed rounded-xl border border-[#E0E3EB] bg-[#F8F8FA] px-3.5 text-sm font-mono font-semibold text-[#666B84] outline-none"
                    />

                    <p className="mt-1.5 text-xs text-[#8A8FA3]">
                      {editingAccount
                        ? "Account codes are system-controlled."
                        : "The account code will be generated automatically based on account type."}
                    </p>
                  </div>
                </div>

                {/* ACCOUNT NAME */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                    Account Name
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    value={
                      form.name
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        name: event
                          .target
                          .value,
                      })
                    }
                    placeholder="e.g. Accounts Receivable"
                    className="h-11 w-full rounded-xl border border-[#E0E3EB] bg-white px-3.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B2] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                  />
                </div>

                {/* SUBACCOUNT */}

                <div className="rounded-xl border border-[#E5E7EE] bg-[#FBFCFE] p-4">
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
                      className="mt-0.5 h-4 w-4 rounded border-[#CBD0DA] text-[#0D9488] focus:ring-[#0D9488]/20"
                    />

                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#20243A]">
                        Make this a
                        subaccount
                      </span>

                      <span className="mt-0.5 block text-xs leading-5 text-[#8A8FA3]">
                        Use this when the
                        account should sit
                        under another account
                        for more detailed
                        reporting.
                      </span>
                    </span>
                  </label>

                  {isSubaccount && (
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                        Parent Account
                        <span className="ml-1 text-red-500">
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
                            setForm({
                              ...form,
                              parentId:
                                event
                                  .target
                                  .value,
                            })
                          }
                          disabled={
                            !form.type ||
                            parentLoading
                          }
                          className="h-11 w-full appearance-none rounded-xl border border-[#E0E3EB] bg-white px-3.5 pr-10 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:cursor-not-allowed disabled:bg-[#F4F5F9] disabled:text-[#A0A4B2]"
                        >
                          <option value="">
                            {!form.type
                              ? "Select account type first"
                              : parentLoading
                              ? "Loading parent accounts..."
                              : parentOptions.length ===
                                0
                              ? "No parent accounts available"
                              : "Select parent account"}
                          </option>

                          {parentOptions.map(
                            (
                              account
                            ) => (
                              <option
                                key={
                                  account.id
                                }
                                value={
                                  account.id
                                }
                              >
                                {
                                  account.code
                                }{" "}
                                —{" "}
                                {
                                  account.name
                                }
                              </option>
                            )
                          )}
                        </select>

                        {parentLoading ? (
                          <RefreshCw
                            size={15}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#0D9488]"
                          />
                        ) : (
                          <ChevronDown
                            size={16}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
                          />
                        )}
                      </div>

                      <p className="mt-1.5 text-xs text-[#8A8FA3]">
                        Only main accounts of
                        the same account type
                        are available as
                        parents.
                      </p>
                    </div>
                  )}
                </div>

                {/* DESCRIPTION */}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-[#20243A]">
                      Description
                    </label>

                    <span className="text-xs text-[#A0A4B2]">
                      Optional
                    </span>
                  </div>

                  <textarea
                    value={
                      form.description
                    }
                    maxLength={500}
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        description:
                          event
                            .target
                            .value,
                      })
                    }
                    rows={4}
                    placeholder="Describe the purpose of this account..."
                    className="w-full resize-none rounded-xl border border-[#E0E3EB] bg-white px-3.5 py-3 text-sm leading-6 text-[#20243A] outline-none transition placeholder:text-[#A0A4B2] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                  />

                  <div className="mt-1 flex justify-end text-sm tabular-nums text-[#A0A4B2]">
                    {
                      form
                        .description
                        .length
                    }
                    /500
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#ECECF3] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
                className="min-h-11 rounded-xl border border-[#E0E3EB] bg-white px-5 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveAccount()
                }
                disabled={
                  saving
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F75] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    {editingAccount
                      ? "Save Changes"
                      : "Create Account"}

                    {!editingAccount && (
                      <Plus
                        size={16}
                      />
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}