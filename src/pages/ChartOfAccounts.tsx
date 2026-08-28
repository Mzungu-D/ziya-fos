import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Layers3,
  Wallet,
  Landmark,
  ShieldCheck,
  TrendingUp,
  ReceiptText,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  description?: string | null;
  parentId?: string | null;
  parent?: {
    id: string;
    code: string;
    name: string;
  } | null;
  children?: {
    id: string;
    code: string;
    name: string;
    type: string;
  }[];
};

type AccountForm = {
  code: string;
  name: string;
  type: string;
  description: string;
  parentId: string;
};

type StructureFilter = "all" | "parent" | "subaccount";

const emptyForm: AccountForm = {
  code: "",
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
];

const typeOrder: Record<string, number> = {
  Asset: 1,
  Liability: 2,
  Equity: 3,
  Income: 4,
  Expense: 5,
};

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
    description: "Resources owned or controlled by the organization",
    icon: Wallet,
    iconClass: "bg-emerald-50 text-emerald-600",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sectionClass: "border-l-emerald-400",
  },
  Liability: {
    label: "Liabilities",
    description: "Amounts the organization owes to others",
    icon: Landmark,
    iconClass: "bg-blue-50 text-blue-600",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-100",
    sectionClass: "border-l-blue-400",
  },
  Equity: {
    label: "Equity",
    description: "Owner or shareholder interest in the organization",
    icon: ShieldCheck,
    iconClass: "bg-violet-50 text-violet-600",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-100",
    sectionClass: "border-l-violet-400",
  },
  Income: {
    label: "Income",
    description: "Revenue and other income earned by the organization",
    icon: TrendingUp,
    iconClass: "bg-amber-50 text-amber-600",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
    sectionClass: "border-l-amber-400",
  },
  Expense: {
    label: "Expenses",
    description: "Costs incurred in operating the organization",
    icon: ReceiptText,
    iconClass: "bg-rose-50 text-rose-600",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-100",
    sectionClass: "border-l-rose-400",
  },
};

const normalizeType = (type: string) => {
  const match = accountTypes.find(
    (item) => item.toLowerCase() === type.toLowerCase(),
  );

  return match ?? type;
};

const sortAccounts = (items: Account[]) =>
  [...items].sort((a, b) => {
    const typeDifference =
      (typeOrder[normalizeType(a.type)] ?? 99) -
      (typeOrder[normalizeType(b.type)] ?? 99);

    if (typeDifference !== 0) {
      return typeDifference;
    }

    return a.code.localeCompare(b.code, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [structureFilter, setStructureFilter] =
    useState<StructureFilter>("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<Account | null>(null);

  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [isSubaccount, setIsSubaccount] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await authenticatedFetch("/api/accounts");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load accounts",
        );
      }

      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("ACCOUNT LOAD ERROR:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load accounts",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = accounts.filter((account) => {
      const matchesSearch =
        !query ||
        account.code.toLowerCase().includes(query) ||
        account.name.toLowerCase().includes(query) ||
        account.type.toLowerCase().includes(query) ||
        account.description
          ?.toLowerCase()
          .includes(query) ||
        account.parent?.name
          .toLowerCase()
          .includes(query);

      const normalizedAccountType =
        normalizeType(account.type);

      const matchesType =
        typeFilter === "All" ||
        normalizedAccountType === typeFilter;

      const matchesStructure =
        structureFilter === "all" ||
        (structureFilter === "parent" &&
          !account.parentId) ||
        (structureFilter === "subaccount" &&
          Boolean(account.parentId));

      return (
        matchesSearch &&
        matchesType &&
        matchesStructure
      );
    });

    return sortAccounts(result);
  }, [
    accounts,
    search,
    typeFilter,
    structureFilter,
  ]);

  const groupedAccounts = useMemo(() => {
    const groups = new Map<string, Account[]>();

    for (const account of filteredAccounts) {
      const type = normalizeType(account.type);

      if (!groups.has(type)) {
        groups.set(type, []);
      }

      groups.get(type)!.push(account);
    }

    return Array.from(groups.entries()).sort(
      ([a], [b]) =>
        (typeOrder[a] ?? 99) -
        (typeOrder[b] ?? 99),
    );
  }, [filteredAccounts]);

  const counts = useMemo(() => {
    return accountTypes.reduce(
      (result, type) => {
        result[type] = accounts.filter(
          (account) =>
            normalizeType(account.type) === type,
        ).length;

        return result;
      },
      {} as Record<string, number>,
    );
  }, [accounts]);

  const openCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setIsSubaccount(false);
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);

    setForm({
      code: account.code,
      name: account.name,
      type: normalizeType(account.type),
      description: account.description || "",
      parentId: account.parentId || "",
    });

    setIsSubaccount(Boolean(account.parentId));
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingAccount(null);
    setForm(emptyForm);
    setIsSubaccount(false);
    setError("");
  };

  const handleTypeChange = (type: string) => {
    setForm((current) => ({
      ...current,
      type,
      parentId: "",
    }));

    setIsSubaccount(false);
  };

  const handleSubaccountChange = (
    checked: boolean,
  ) => {
    setIsSubaccount(checked);

    if (!checked) {
      setForm((current) => ({
        ...current,
        parentId: "",
      }));
    }
  };

  const saveAccount = async () => {
    const code = form.code.trim();
    const name = form.name.trim();
    const type = normalizeType(form.type);

    if (!code || !name || !type) {
      setError(
        "Account code, account name and account type are required.",
      );
      return;
    }

    if (isSubaccount && !form.parentId) {
      setError(
        "Select a parent account for this subaccount.",
      );
      return;
    }

    if (
      isSubaccount &&
      form.parentId === editingAccount?.id
    ) {
      setError(
        "An account cannot be its own parent.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const editing = Boolean(editingAccount);

      const url = editing
        ? `/api/accounts/${editingAccount!.id}`
        : "/api/accounts";

      const response =
        await authenticatedFetch(url, {
          method: editing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            name,
            type,
            description:
              form.description.trim() || null,
            parentId:
              isSubaccount && form.parentId
                ? form.parentId
                : null,
          }),
        });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to save account",
        );
      }

      setModalOpen(false);
      setEditingAccount(null);
      setForm(emptyForm);
      setIsSubaccount(false);

      setSuccess(
        editing
          ? "Account updated successfully."
          : "Account created successfully.",
      );

      await loadAccounts();
    } catch (error) {
      console.error(
        "SAVE ACCOUNT ERROR:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to save account",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (
    account: Account,
  ) => {
    if (
      !window.confirm(
        `Delete ${account.code} - ${account.name}?`,
      )
    ) {
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
          },
        );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to delete account",
        );
      }

      setSuccess(
        "Account deleted successfully.",
      );

      await loadAccounts();
    } catch (error) {
      console.error(
        "DELETE ACCOUNT ERROR:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to delete account",
      );
    }
  };

  const parentOptions = useMemo(() => {
    if (!form.type) return [];

    return sortAccounts(
      accounts.filter((account) => {
        if (account.id === editingAccount?.id) {
          return false;
        }

        return (
          normalizeType(account.type) ===
          normalizeType(form.type)
        );
      }),
    );
  }, [
    accounts,
    editingAccount,
    form.type,
  ]);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("All");
    setStructureFilter("all");
  };

  const hasFilters =
    search.trim() ||
    typeFilter !== "All" ||
    structureFilter !== "all";

  return (
    <div className="min-w-0 space-y-6 pb-8">
      {/* PAGE HEADER */}
      <section className="rounded-2xl border border-[#ECECF3] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(32,36,58,0.03)] sm:px-6 lg:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                <Layers3 size={22} />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-[#20243A] sm:text-3xl">
                  Chart of Accounts
                </h1>

                <p className="mt-1 text-sm text-[#666B84] sm:text-[15px]">
                  Organize the accounts that power your
                  financial reporting and general ledger.
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <button
              type="button"
              onClick={loadAccounts}
              disabled={loading}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#E4E6EE] bg-white px-4 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <RefreshCw
                size={17}
                className={
                  loading ? "animate-spin" : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F75] focus:outline-none focus:ring-4 focus:ring-[#0D9488]/15 sm:flex-none"
            >
              <Plus size={18} />
              New Account
            </button>
          </div>
        </div>
      </section>

      {/* MESSAGES */}
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

      {/* SUMMARY */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-[0_1px_2px_rgba(32,36,58,0.03)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
            Total Accounts
          </p>
          <p className="mt-2 text-4xl font-bold leading-none tabular-nums tracking-tight text-[#20243A]">
            {loading ? "â€”" : accounts.length}
          </p>
          <p className="mt-1 text-xs text-[#8A8FA3]">
            Organization accounts
          </p>
        </div>

        {accountTypes.map((type) => {
          const meta = typeMeta[type];
          const Icon = meta.icon;

          return (
            <div
              key={type}
              className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-[0_1px_2px_rgba(32,36,58,0.03)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.iconClass}`}
                >
                  <Icon size={16} />
                </div>

                <span className="text-3xl font-bold leading-none tabular-nums tracking-tight text-[#20243A]">
                  {loading
                    ? "â€”"
                    : counts[type] ?? 0}
                </span>
              </div>

              <p className="mt-3 text-sm font-semibold text-[#20243A]">
                {meta.label}
              </p>
            </div>
          );
        })}
      </section>

      {/* SEARCH / FILTERS */}
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
                setSearch(event.target.value)
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
                  setTypeFilter(event.target.value)
                }
                className="h-11 w-full appearance-none rounded-xl border border-[#E4E6EE] bg-white pl-4 pr-10 text-sm font-medium text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 sm:w-44"
              >
                <option value="All">
                  All account types
                </option>

                {accountTypes.map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {typeMeta[type].label}
                  </option>
                ))}
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
                value={structureFilter}
                onChange={(event) =>
                  setStructureFilter(
                    event.target.value as StructureFilter,
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
                onClick={clearFilters}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#666B84] transition hover:bg-[#F8F9FC] hover:text-[#20243A]"
              >
                <SlidersHorizontal size={16} />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#F0F1F5] pt-3 text-xs text-[#8A8FA3]">
          <span>
            {loading
              ? "Loading accounts..."
              : `Showing ${filteredAccounts.length} of ${accounts.length} accounts`}
          </span>

          {!loading && hasFilters && (
            <span className="font-medium text-[#0D9488]">
              Filters active
            </span>
          )}
        </div>
      </section>

      {/* ACCOUNT LIST */}
      <section className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-[0_1px_2px_rgba(32,36,58,0.03)]">
        {loading ? (
          <div className="flex min-h-72 items-center justify-center px-6 text-sm text-[#666B84]">
            <div className="flex items-center gap-3">
              <RefreshCw
                size={18}
                className="animate-spin text-[#0D9488]"
              />
              Loading Chart of Accounts...
            </div>
          </div>
        ) : groupedAccounts.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F5F9] text-[#8A8FA3]">
              <Search size={21} />
            </div>

            <h3 className="mt-4 text-base font-semibold text-[#20243A]">
              No accounts found
            </h3>

            <p className="mt-1 max-w-md text-sm text-[#8A8FA3]">
              Try changing your search or filters,
              or create a new account.
            </p>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-sm font-semibold text-[#0D9488] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#ECECF3]">
            {groupedAccounts.map(
              ([type, typeAccounts]) => {
                const meta =
                  typeMeta[type] ??
                  typeMeta.Asset;

                const Icon = meta.icon;

                return (
                  <div key={type}>
                    {/* CATEGORY HEADER */}
                    <div
                      className={`flex flex-col gap-2 border-l-4 bg-[#FBFCFE] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${meta.sectionClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.iconClass}`}
                        >
                          <Icon size={18} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold uppercase tracking-wide text-[#20243A]">
                              {meta.label}
                            </h2>

                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#8A8FA3] ring-1 ring-inset ring-[#E5E7EE]">
                              {typeAccounts.length}
                            </span>
                          </div>

                          <p className="mt-0.5 text-xs text-[#8A8FA3]">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* DESKTOP TABLE */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="min-w-[900px] w-full">
                        <thead>
                          <tr className="border-b border-[#ECECF3] bg-white text-left text-[11px] font-bold uppercase tracking-wider text-[#8A8FA3]">
                            <th className="w-32 px-6 py-3">
                              Code
                            </th>
                            <th className="px-4 py-3">
                              Account
                            </th>
                            <th className="w-32 px-4 py-3">
                              Type
                            </th>
                            <th className="w-64 px-4 py-3">
                              Parent Account
                            </th>
                            <th className="w-28 px-4 py-3">
                              Structure
                            </th>
                            <th className="w-28 px-6 py-3 text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {typeAccounts.map(
                            (account) => {
                              const accountMeta =
                                typeMeta[
                                  normalizeType(
                                    account.type,
                                  )
                                ] ??
                                typeMeta.Asset;

                              return (
                                <tr
                                  key={account.id}
                                  className="border-b border-[#F0F1F5] last:border-b-0 hover:bg-[#FBFCFE]"
                                >
                                  <td className="px-6 py-4 align-top">
                                    <span className="font-mono text-sm font-semibold text-[#20243A]">
                                      {account.code}
                                    </span>
                                  </td>

                                  <td className="px-4 py-4 align-top">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-[#20243A]">
                                        {account.name}
                                      </p>

                                      {account.description && (
                                        <p className="mt-1 max-w-md truncate text-xs text-[#8A8FA3]">
                                          {account.description}
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 align-top">
                                    <span
                                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${accountMeta.badgeClass}`}
                                    >
                                      {normalizeType(
                                        account.type,
                                      )}
                                    </span>
                                  </td>

                                  <td className="px-4 py-4 align-top">
                                    {account.parent ? (
                                      <div>
                                        <p className="font-mono text-xs font-semibold text-[#20243A]">
                                          {account.parent.code}
                                        </p>

                                        <p className="mt-0.5 truncate text-xs text-[#666B84]">
                                          {account.parent.name}
                                        </p>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-[#A0A4B2]">
                                        â€”
                                      </span>
                                    )}
                                  </td>

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

                                  <td className="px-6 py-4 align-top">
                                    <div className="flex justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openEdit(
                                            account,
                                          )
                                        }
                                        className="rounded-lg p-2 text-[#666B84] transition hover:bg-[#0D9488]/10 hover:text-[#0D9488]"
                                        title="Edit account"
                                      >
                                        <Pencil
                                          size={17}
                                        />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteAccount(
                                            account,
                                          )
                                        }
                                        className="rounded-lg p-2 text-[#8A8FA3] transition hover:bg-red-50 hover:text-red-600"
                                        title="Delete account"
                                      >
                                        <Trash2
                                          size={17}
                                        />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* MOBILE LIST */}
                    <div className="divide-y divide-[#F0F1F5] md:hidden">
                      {typeAccounts.map(
                        (account) => {
                          const accountMeta =
                            typeMeta[
                              normalizeType(
                                account.type,
                              )
                            ] ??
                            typeMeta.Asset;

                          return (
                            <div
                              key={account.id}
                              className="p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-[#20243A]">
                                      {account.code}
                                    </span>

                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${accountMeta.badgeClass}`}
                                    >
                                      {normalizeType(
                                        account.type,
                                      )}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-sm font-semibold text-[#20243A]">
                                    {account.name}
                                  </p>

                                  {account.description && (
                                    <p className="mt-1 text-xs leading-5 text-[#8A8FA3]">
                                      {account.description}
                                    </p>
                                  )}

                                  <div className="mt-3 text-xs text-[#666B84]">
                                    {account.parent ? (
                                      <>
                                        <span className="text-[#8A8FA3]">
                                          Parent:
                                        </span>{" "}
                                        <span className="font-medium">
                                          {
                                            account
                                              .parent
                                              .code
                                          }{" "}
                                          â€”{" "}
                                          {
                                            account
                                              .parent
                                              .name
                                          }
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[#8A8FA3]">
                                        Main account
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEdit(
                                        account,
                                      )
                                    }
                                    className="rounded-lg p-2 text-[#666B84] hover:bg-[#0D9488]/10 hover:text-[#0D9488]"
                                    title="Edit account"
                                  >
                                    <Pencil
                                      size={17}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteAccount(
                                        account,
                                      )
                                    }
                                    className="rounded-lg p-2 text-[#8A8FA3] hover:bg-red-50 hover:text-red-600"
                                    title="Delete account"
                                  >
                                    <Trash2
                                      size={17}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </section>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/55 p-3 backdrop-blur-[2px] sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#E6E8EF] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ECECF3] px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                  <Layers3 size={19} />
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
                onClick={closeModal}
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
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                      Account Type
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <div className="relative">
                      <select
                        value={form.type}
                        onChange={(event) =>
                          handleTypeChange(
                            event.target.value,
                          )
                        }
                        className="h-11 w-full appearance-none rounded-xl border border-[#E0E3EB] bg-white px-3.5 pr-10 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                      >
                        <option value="">
                          Select account type
                        </option>

                        {accountTypes.map(
                          (type) => (
                            <option
                              key={type}
                              value={type}
                            >
                              {typeMeta[type].label}
                            </option>
                          ),
                        )}
                      </select>

                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-[#8A8FA3]">
                      Determines where the account is
                      reported.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                      Account Code
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      value={form.code}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          code: event.target.value,
                        })
                      }
                      placeholder="e.g. 1100"
                      className="h-11 w-full rounded-xl border border-[#E0E3EB] bg-white px-3.5 text-sm font-mono text-[#20243A] outline-none transition placeholder:font-sans placeholder:text-[#A0A4B2] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                    />

                    <p className="mt-1.5 text-xs text-[#8A8FA3]">
                      Use a unique code that fits your
                      numbering structure.
                    </p>
                  </div>
                </div>

                {/* NAME */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                    Account Name
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        name: event.target.value,
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
                      checked={isSubaccount}
                      onChange={(event) =>
                        handleSubaccountChange(
                          event.target.checked,
                        )
                      }
                      className="mt-0.5 h-4 w-4 rounded border-[#CBD0DA] text-[#0D9488] focus:ring-[#0D9488]/20"
                    />

                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#20243A]">
                        Make this a subaccount
                      </span>

                      <span className="mt-0.5 block text-xs leading-5 text-[#8A8FA3]">
                        Use this when the account should
                        sit under another account for
                        more detailed reporting.
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
                          value={form.parentId}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              parentId:
                                event.target.value,
                            })
                          }
                          disabled={!form.type}
                          className="h-11 w-full appearance-none rounded-xl border border-[#E0E3EB] bg-white px-3.5 pr-10 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:cursor-not-allowed disabled:bg-[#F4F5F9] disabled:text-[#A0A4B2]"
                        >
                          <option value="">
                            {form.type
                              ? "Select parent account"
                              : "Select account type first"}
                          </option>

                          {parentOptions.map(
                            (account) => (
                              <option
                                key={account.id}
                                value={account.id}
                              >
                                {account.code} â€”{" "}
                                {account.name}
                              </option>
                            ),
                          )}
                        </select>

                        <ChevronDown
                          size={16}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
                        />
                      </div>

                      <p className="mt-1.5 text-xs text-[#8A8FA3]">
                        Only accounts of the same account
                        type are available as parents.
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
                    value={form.description}
                    maxLength={500}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description:
                          event.target.value,
                      })
                    }
                    rows={4}
                    placeholder="Describe the purpose of this account..."
                    className="w-full resize-none rounded-xl border border-[#E0E3EB] bg-white px-3.5 py-3 text-sm leading-6 text-[#20243A] outline-none transition placeholder:text-[#A0A4B2] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                  />

                  <div className="mt-1 flex justify-end text-xs text-[#A0A4B2]">
                    {form.description.length}/500
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#ECECF3] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="min-h-11 rounded-xl border border-[#E0E3EB] bg-white px-5 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveAccount}
                disabled={saving}
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
                      <Plus size={16} />
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
