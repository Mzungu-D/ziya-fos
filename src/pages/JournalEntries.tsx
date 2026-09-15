import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  RefreshCw,
  Pencil,
  Trash2,
  CheckCircle,
  Send,
  RotateCcw,
  AlertCircle,
  Save,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type JournalStatus = "DRAFT" | "POSTED" | "APPROVED" | "REVERSED";

type JournalLine = {
  id?: string;
  lineNumber: number;
  accountId: string;
  memo?: string | null;
  debit: number;
  credit: number;
  account?: Account;
};

type JournalEntry = {
  id: string;
  reference: string;
  transactionDate: string;
  description: string;
  journalType?: string | null;
  debitAccountId?: string;
  creditAccountId?: string;
  amount: number;
  status: JournalStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  debitAccount?: Account;
  creditAccount?: Account;
  lines?: JournalLine[];
};

type FormLine = {
  accountId: string;
  memo: string;
  debit: string;
  credit: string;
};

type FormState = {
  transactionDate: string;
  description: string;
  journalType: string;
  notes: string;
  lines: FormLine[];
};

const newLine = (): FormLine => ({
  accountId: "",
  memo: "",
  debit: "",
  credit: "",
});

const emptyForm = (): FormState => ({
  transactionDate: new Date().toISOString().split("T")[0],
  description: "",
  journalType: "GENERAL",
  notes: "",
  lines: [newLine(), newLine()],
});

const numberValue = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function JournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] =
    useState<JournalEntry | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const apiRequest = async (
    url: string,
    options: RequestInit = {},
  ) => {
    const response = await authenticatedFetch(url, {
      ...options,
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {}),
      },
    });

    const contentType = response.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      throw new Error(
        `API returned ${response.status} instead of JSON.`,
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || `Request failed (${response.status})`,
      );
    }

    return data;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [journalData, accountData] = await Promise.all([
        apiRequest("/api/journals"),
        apiRequest("/api/accounts"),
      ]);

      setEntries(journalData.entries || []);
      setAccounts(accountData.accounts || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load journal entries",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return entries.filter((entry) => {
      const lines = entry.lines || [];

      const lineText = lines
        .map(
          (line) =>
            `${line.account?.code || ""} ${
              line.account?.name || ""
            } ${line.memo || ""}`,
        )
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        entry.reference.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        lineText.includes(query) ||
        entry.debitAccount?.name
          ?.toLowerCase()
          .includes(query) ||
        entry.creditAccount?.name
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        entry.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [entries, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEntries.length / pageSize),
  );

  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, page, pageSize]);

  const pageNumbers = useMemo<(number | "ellipsis")[]>(() => {
    if (totalPages <= 7) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1,
      );
    }

    const pages: (number | "ellipsis")[] = [1];

    if (page > 3) {
      pages.push("ellipsis");
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let current = start; current <= end; current++) {
      pages.push(current);
    }

    if (page < totalPages - 2) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);

    return pages;
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const openNewEntry = () => {
    setEditingEntry(null);
    setForm(emptyForm());
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    if (entry.status !== "DRAFT") return;

    const lines =
      entry.lines && entry.lines.length >= 2
        ? [...entry.lines]
            .sort(
              (a, b) => a.lineNumber - b.lineNumber,
            )
            .map((line) => ({
              accountId: line.accountId,
              memo: line.memo || "",
              debit:
                line.debit > 0
                  ? String(line.debit)
                  : "",
              credit:
                line.credit > 0
                  ? String(line.credit)
                  : "",
            }))
        : [
            {
              accountId:
                entry.debitAccountId || "",
              memo: entry.description || "",
              debit: String(entry.amount || ""),
              credit: "",
            },
            {
              accountId:
                entry.creditAccountId || "",
              memo: entry.description || "",
              debit: "",
              credit: String(entry.amount || ""),
            },
          ];

    setEditingEntry(entry);

    setForm({
      transactionDate:
        entry.transactionDate.split("T")[0],
      description: entry.description,
      journalType:
        entry.journalType || "GENERAL",
      notes: entry.notes || "",
      lines,
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingEntry(null);
    setForm(emptyForm());
    setError("");
  };

  const updateHeader = (
    field: keyof Omit<FormState, "lines">,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateLine = (
    index: number,
    field: keyof FormLine,
    value: string,
  ) => {
    setForm((current) => {
      const lines = [...current.lines];

      lines[index] = {
        ...lines[index],
        [field]: value,
      };

      if (field === "debit" && value !== "") {
        lines[index].credit = "";
      }

      if (field === "credit" && value !== "") {
        lines[index].debit = "";
      }

      return {
        ...current,
        lines,
      };
    });
  };

  const addLine = () => {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, newLine()],
    }));
  };

  const removeLine = (index: number) => {
    setForm((current) => {
      if (current.lines.length <= 2) {
        return current;
      }

      return {
        ...current,
        lines: current.lines.filter(
          (_, lineIndex) => lineIndex !== index,
        ),
      };
    });
  };

  const totals = useMemo(() => {
    return form.lines.reduce(
      (result, line) => {
        result.debit += numberValue(line.debit);
        result.credit += numberValue(line.credit);

        return result;
      },
      {
        debit: 0,
        credit: 0,
      },
    );
  }, [form.lines]);

  const difference = totals.debit - totals.credit;

  const isBalanced =
    Math.abs(difference) < 0.005 &&
    totals.debit > 0 &&
    totals.credit > 0;

  const populatedLines = form.lines.filter(
    (line) =>
      line.accountId ||
      line.memo.trim() ||
      line.debit ||
      line.credit,
  );

  const validateForm = () => {
    if (!form.transactionDate) {
      throw new Error("Transaction date is required.");
    }

    if (!form.description.trim()) {
      throw new Error("Description is required.");
    }

    if (form.lines.length < 2) {
      throw new Error(
        "A journal entry must contain at least two lines.",
      );
    }

    for (let index = 0; index < form.lines.length; index++) {
      const line = form.lines[index];

      const debit = numberValue(line.debit);
      const credit = numberValue(line.credit);

      if (!line.accountId) {
        throw new Error(
          `Select an account for journal line ${
            index + 1
          }.`,
        );
      }

      if (debit > 0 && credit > 0) {
        throw new Error(
          `Line ${index + 1} cannot contain both debit and credit.`,
        );
      }

      if (debit <= 0 && credit <= 0) {
        throw new Error(
          `Line ${index + 1} must contain a debit or credit amount.`,
        );
      }

      if (debit < 0 || credit < 0) {
        throw new Error(
          `Line ${index + 1} cannot contain negative amounts.`,
        );
      }
    }

    if (totals.debit <= 0) {
      throw new Error(
        "The journal must contain at least one debit.",
      );
    }

    if (totals.credit <= 0) {
      throw new Error(
        "The journal must contain at least one credit.",
      );
    }

    if (!isBalanced) {
      throw new Error(
        `Journal is not balanced. Difference: ${formatMoney(
          Math.abs(difference),
        )}.`,
      );
    }

    if (!form.notes.trim()) {
      throw new Error(
        "Notes are required. Add supporting details for this journal entry.",
      );
    }

    return form.lines.map((line, index) => ({
      accountId: line.accountId,
      lineNumber: index + 1,
      memo: line.memo.trim() || null,
      debit: numberValue(line.debit),
      credit: numberValue(line.credit),
    }));
  };

  const saveEntry = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const lines = validateForm();

      const body = {
        transactionDate: form.transactionDate,
        description: form.description.trim(),
        journalType: form.journalType,
        notes: form.notes.trim() || null,
        lines,
      };

      if (editingEntry) {
        await apiRequest(
          `/api/journals/${editingEntry.id}`,
          {
            method: "PUT",
            body: JSON.stringify(body),
          },
        );

        setSuccess(
          "Journal entry updated successfully.",
        );
      } else {
        await apiRequest("/api/journals", {
          method: "POST",
          body: JSON.stringify(body),
        });

        setSuccess(
          "Journal entry created as draft.",
        );
      }

      setModalOpen(false);
      setEditingEntry(null);
      setForm(emptyForm());

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save journal entry",
      );
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    action: () => Promise<unknown>,
    message: string,
  ) => {
    try {
      setError("");
      setSuccess("");

      await action();

      setSuccess(message);

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Journal action failed",
      );
    }
  };

  const postEntry = (entry: JournalEntry) => {
    if (
      !window.confirm(
        `Post journal entry ${entry.reference}? It will no longer be editable.`,
      )
    ) {
      return;
    }

    runAction(
      () =>
        apiRequest(
          `/api/journals/${entry.id}/post`,
          {
            method: "PATCH",
          },
        ),
      `${entry.reference} posted successfully.`,
    );
  };

  const approveEntry = (entry: JournalEntry) => {
    if (
      !window.confirm(
        `Approve journal entry ${entry.reference}?`,
      )
    ) {
      return;
    }

    runAction(
      () =>
        apiRequest(
          `/api/journals/${entry.id}/approve`,
          {
            method: "PATCH",
          },
        ),
      `${entry.reference} approved successfully.`,
    );
  };

  const reverseEntry = (entry: JournalEntry) => {
    const reason = window.prompt(
      `Reason for reversing ${entry.reference}:`,
    );

    if (reason === null) return;

    if (!reason.trim()) {
      setError("A reversal reason is required.");
      return;
    }

    runAction(
      () =>
        apiRequest(
          `/api/journals/${entry.id}/reverse`,
          {
            method: "POST",
            body: JSON.stringify({
              reason: reason.trim(),
            }),
          },
        ),
      `${entry.reference} reversed successfully.`,
    );
  };

  const deleteEntry = (entry: JournalEntry) => {
    if (
      !window.confirm(
        `Delete draft ${entry.reference}? This cannot be undone.`,
      )
    ) {
      return;
    }

    runAction(
      () =>
        apiRequest(
          `/api/journals/${entry.id}`,
          {
            method: "DELETE",
          },
        ),
      `${entry.reference} deleted.`,
    );
  };

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(value);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const statusClass = (status: JournalStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-slate-500/10 text-[#666B84] border-slate-500/30";

      case "POSTED":
        return "bg-[#0D9488]/10 text-[#20243A] border-[#20243A]/30";

      case "APPROVED":
        return "bg-green-500/10 text-green-400 border-green-500/30";

      case "REVERSED":
        return "bg-red-500/10 text-red-400 border-red-500/30";

      default:
        return "bg-slate-500/10 text-[#666B84] border-slate-500/30";
    }
  };

  const entryTotals = (entry: JournalEntry) => {
    if (entry.lines?.length) {
      return entry.lines.reduce(
        (result, line) => {
          result.debit += Number(line.debit || 0);
          result.credit += Number(line.credit || 0);

          return result;
        },
        {
          debit: 0,
          credit: 0,
        },
      );
    }

    return {
      debit: Number(entry.amount || 0),
      credit: Number(entry.amount || 0),
    };
  };

  return (
    <div className="min-h-full bg-[#F7F8FA] text-[#171A2B]">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* PAGE HEADER */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7A8094]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0D9488]" />
              Accounting
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-[#171A2B] sm:text-3xl">
              Journal Entries
            </h1>

            <p className="mt-1.5 max-w-2xl text-sm text-[#73798D] sm:text-[15px]">
              Record, review and manage your double-entry accounting transactions.
            </p>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E3E6EC] bg-white px-4 py-2.5 text-sm font-medium text-[#4D5368] shadow-sm transition hover:border-[#D3D7E0] hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>

            <button
              onClick={openNewEntry}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(13,148,136,0.18)] transition hover:bg-[#0B7F75] sm:flex-none"
            >
              <Plus size={17} />
              New entry
            </button>
          </div>
        </div>

        {/* GLOBAL ERROR */}
        {error && !modalOpen && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle
              size={17}
              className="mt-0.5 shrink-0"
            />
            <span>{error}</span>
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle
              size={17}
              className="mt-0.5 shrink-0"
            />
            <span>{success}</span>
          </div>
        )}

        {/* FILTERS */}
        <div className="rounded-2xl border border-[#E5E7EC] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-[#E3E6EC] bg-[#FAFBFC] px-3 transition focus-within:border-[#0D9488] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0D9488]/10">
              <Search
                size={18}
                className="shrink-0 text-[#8A90A3]"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search by reference, description or account..."
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[#20243A] outline-none placeholder:text-[#9BA0B0]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-lg p-1.5 text-[#8A90A3] hover:bg-[#EEF0F4] hover:text-[#20243A]"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className="h-11 rounded-xl border border-[#E3E6EC] bg-white px-4 text-sm font-medium text-[#42485D] outline-none transition hover:border-[#CDD1DA] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 lg:w-48"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="DRAFT">
                Draft
              </option>
              <option value="POSTED">
                Posted
              </option>
              <option value="APPROVED">
                Approved
              </option>
              <option value="REVERSED">
                Reversed
              </option>
            </select>
          </div>
        </div>

        {/* JOURNAL TABLE */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EC] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between border-b border-[#ECEEF2] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-[#20243A]">
                Journal activity
              </h2>

              <p className="mt-0.5 text-xs text-[#8A90A3]">
                {filteredEntries.length}{" "}
                {filteredEntries.length === 1
                  ? "entry"
                  : "entries"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px]">
              <thead>
                <tr className="border-b border-[#ECEEF2] bg-[#FAFBFC] text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Reference
                  </th>

                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Date
                  </th>

                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Description
                  </th>

                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Lines
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Debit
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Credit
                  </th>

                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-16 text-center text-sm text-[#7D8396]"
                    >
                      <div className="mx-auto flex items-center justify-center gap-2">
                        <RefreshCw
                          size={17}
                          className="animate-spin"
                        />
                        Loading journal entries...
                      </div>
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-16 text-center"
                    >
                      <div className="mx-auto max-w-sm">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F3F6] text-[#7E8497]">
                          <Search size={18} />
                        </div>

                        <p className="text-sm font-semibold text-[#33384C]">
                          No journal entries found
                        </p>

                        <p className="mt-1 text-xs text-[#8A90A3]">
                          Try changing your search or status filter.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => {
                    const totals = entryTotals(entry);

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-[#F0F1F4] last:border-0 transition hover:bg-[#FBFCFD]"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[#20243A]">
                            {entry.reference}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-sm text-[#687085]">
                          {formatDate(
                            entry.transactionDate,
                          )}
                        </td>

                        <td className="max-w-[260px] px-4 py-4">
                          <div
                            className="truncate text-sm font-medium text-[#30364A]"
                            title={entry.description}
                          >
                            {entry.description}
                          </div>

                          {entry.journalType && (
                            <div className="mt-1 text-[11px] uppercase tracking-wide text-[#9A9FAF]">
                              {entry.journalType}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-[#687085]">
                          <span className="inline-flex rounded-lg bg-[#F4F5F7] px-2.5 py-1 text-xs font-semibold text-[#555B6F]">
                            {entry.lines?.length || 2}
                            {" "}
                            lines
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#20243A]">
                          {formatMoney(totals.debit)}
                        </td>

                        <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#20243A]">
                          {formatMoney(totals.credit)}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                              entry.status,
                            )}`}
                          >
                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                            {entry.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            {entry.status ===
                              "DRAFT" && (
                              <>
                                <button
                                  onClick={() =>
                                    openEditEntry(
                                      entry,
                                    )
                                  }
                                  title="Edit"
                                  className="rounded-lg border border-transparent p-2 text-[#73798D] transition hover:border-[#E2E5EA] hover:bg-white hover:text-[#20243A]"
                                >
                                  <Pencil size={16} />
                                </button>

                                <button
                                  onClick={() =>
                                    postEntry(entry)
                                  }
                                  title="Post"
                                  className="rounded-lg border border-[#BFE8E3] bg-[#EFFAF8] p-2 text-[#0D7F75] transition hover:bg-[#DDF5F1]"
                                >
                                  <Send size={16} />
                                </button>

                                <button
                                  onClick={() =>
                                    deleteEntry(entry)
                                  }
                                  title="Delete"
                                  className="rounded-lg border border-transparent p-2 text-[#A36C73] transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2
                                    size={16}
                                  />
                                </button>
                              </>
                            )}

                            {entry.status ===
                              "POSTED" && (
                              <button
                                onClick={() =>
                                  approveEntry(
                                    entry,
                                  )
                                }
                                title="Approve"
                                className="flex items-center gap-1.5 rounded-lg bg-[#F0FAF4] px-3 py-2 text-xs font-semibold text-[#25834B] transition hover:bg-[#E3F6EB]"
                              >
                                <CheckCircle
                                  size={15}
                                />
                                Approve
                              </button>
                            )}

                            {entry.status ===
                              "APPROVED" && (
                              <button
                                onClick={() =>
                                  reverseEntry(
                                    entry,
                                  )
                                }
                                title="Reverse"
                                className="flex items-center gap-1.5 rounded-lg bg-[#FFF7ED] px-3 py-2 text-xs font-semibold text-[#B7681E] transition hover:bg-[#FFEDD5]"
                              >
                                <RotateCcw
                                  size={15}
                                />
                                Reverse
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>


          {/* PAGINATION */}
          <div className="flex flex-col gap-3 border-t border-[#ECEEF2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-xs text-[#7A8094]">
              {filteredEntries.length === 0 ? (
                "Showing 0 to 0 of 0 entries"
              ) : (
                <>
                  Showing{" "}
                  <span className="font-semibold text-[#4D5368]">
                    {(page - 1) * pageSize + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-[#4D5368]">
                    {Math.min(page * pageSize, filteredEntries.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#4D5368]">
                    {filteredEntries.length}
                  </span>{" "}
                  entries
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex items-center gap-2 text-xs text-[#7A8094]">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-[#E0E3E8] bg-white px-2.5 text-xs font-semibold text-[#4D5368] outline-none focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E0E3E8] bg-white px-3 text-xs font-semibold text-[#555B6F] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} />
                Previous
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((item, index) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="flex h-9 w-8 items-center justify-center text-xs text-[#9A9FAF]"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`h-9 min-w-9 rounded-lg px-2 text-xs font-semibold transition ${
                        page === item
                          ? "bg-[#0D9488] text-white shadow-sm"
                          : "border border-[#E0E3E8] bg-white text-[#555B6F] hover:bg-[#F7F8FA]"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page === totalPages}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E0E3E8] bg-white px-3 text-xs font-semibold text-[#555B6F] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NEW / EDIT JOURNAL ENTRY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#111827]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 lg:p-6">
          <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl lg:max-w-6xl">
            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-start justify-between border-b border-[#E9EBEF] px-5 py-4 sm:px-7 sm:py-5">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-md bg-[#EAF8F6] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0D7F75]">
                  Accounting / Journal
                </div>

                <h2 className="text-xl font-semibold tracking-tight text-[#171A2B] sm:text-2xl">
                  {editingEntry
                    ? "Edit journal entry"
                    : "New journal entry"}
                </h2>

                <p className="mt-1 text-sm text-[#7A8094]">
                  {editingEntry
                    ? "Update this draft before posting."
                    : "Create a balanced multi-line accounting transaction."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#7B8194] transition hover:bg-[#F3F4F7] hover:text-[#20243A] disabled:opacity-50"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0"
                    />
                    <span>{error}</span>
                  </div>
                )}

                {/* TRANSACTION DETAILS */}
                <section>
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#20243A]">
                        Transaction details
                      </h3>

                      <p className="mt-1 text-xs text-[#8A90A3]">
                        Identify and describe the accounting transaction.
                      </p>
                    </div>

                    <span className="hidden text-[11px] font-medium text-[#9A9FAF] sm:block">
                      * Required
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* REFERENCE */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                        Reference
                      </label>

                      <div className="flex h-11 items-center gap-2 rounded-xl border border-[#DFE2E8] bg-[#F8F9FA] px-3.5">
                        <span className="text-sm font-semibold text-[#20243A]">
                          {editingEntry
                            ? editingEntry.reference
                            : "Auto-generated"}
                        </span>

                        {!editingEntry && (
                          <span className="ml-auto rounded-md bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#0D7F75] ring-1 ring-[#E0E5E7]">
                            System
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 text-[10px] text-[#8A90A3]">
                        {editingEntry
                          ? "Reference numbers cannot be changed."
                          : "Generated automatically by the server."}
                      </p>
                    </div>

                    {/* DATE */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                        Journal date{" "}
                        <span className="text-[#0D9488]">
                          *
                        </span>
                      </label>

                      <input
                        type="date"
                        value={form.transactionDate}
                        onChange={(e) =>
                          updateHeader(
                            "transactionDate",
                            e.target.value,
                          )
                        }
                        className="h-11 w-full rounded-xl border border-[#DFE2E8] bg-white px-3.5 text-sm text-[#20243A] outline-none transition hover:border-[#C9CDD5] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                      />
                    </div>

                    {/* TYPE */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                        Journal type
                      </label>

                      <div className="relative">
                        <select
                          value={form.journalType}
                          onChange={(e) =>
                            updateHeader(
                              "journalType",
                              e.target.value,
                            )
                          }
                          className="h-11 w-full appearance-none rounded-xl border border-[#DFE2E8] bg-white px-3.5 pr-9 text-sm text-[#20243A] outline-none transition hover:border-[#C9CDD5] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                        >
                          <option value="GENERAL">
                            General Journal
                          </option>
                          <option value="ADJUSTMENT">
                            Adjustment
                          </option>
                          <option value="ACCRUAL">
                            Accrual
                          </option>
                          <option value="CLOSING">
                            Closing
                          </option>
                          <option value="OPENING">
                            Opening
                          </option>
                          <option value="CORRECTION">
                            Correction
                          </option>
                        </select>

                        <ChevronDown
                          size={15}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A90A3]"
                        />
                      </div>
                    </div>

                    {/* DESCRIPTION */}
                    <div className="md:col-span-2 lg:col-span-1">
                      <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                        Description{" "}
                        <span className="text-[#0D9488]">
                          *
                        </span>
                      </label>

                      <input
                        value={form.description}
                        onChange={(e) =>
                          updateHeader(
                            "description",
                            e.target.value,
                          )
                        }
                        placeholder="What is this transaction for?"
                        className="h-11 w-full rounded-xl border border-[#DFE2E8] bg-white px-3.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A5B3] hover:border-[#C9CDD5] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                      />
                    </div>
                  </div>
                </section>

                {/* JOURNAL LINES */}
                <section className="rounded-2xl border border-[#E4E7EC] bg-[#F9FAFB] p-4 sm:p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[#20243A]">
                        Journal lines
                      </h3>

                      <p className="mt-1 text-xs text-[#8A90A3]">
                        Add as many debit and credit lines as required. Total debits must equal total credits.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addLine}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#CFE7E4] bg-white px-3 py-2 text-xs font-semibold text-[#0D7F75] shadow-sm transition hover:bg-[#EFFAF8]"
                    >
                      <Plus size={15} />
                      Add line
                    </button>
                  </div>

                  {/* DESKTOP HEADER */}
                  <div className="hidden grid-cols-[42px_minmax(220px,1.3fr)_minmax(180px,1fr)_150px_150px_44px] gap-2 rounded-xl bg-[#F1F3F5] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7B8192] lg:grid">
                    <div>#</div>
                    <div>Account</div>
                    <div>Description / Memo</div>
                    <div className="text-right">
                      Debit (KES)
                    </div>
                    <div className="text-right">
                      Credit (KES)
                    </div>
                    <div />
                  </div>

                  <div className="mt-2 space-y-2">
                    {form.lines.map((line, index) => {
                      const selectedAccount =
                        accounts.find(
                          (account) =>
                            account.id ===
                            line.accountId,
                        );

                      return (
                        <div
                          key={index}
                          className="rounded-xl border border-[#E1E4EA] bg-white p-3 shadow-sm lg:grid lg:grid-cols-[42px_minmax(220px,1.3fr)_minmax(180px,1fr)_150px_150px_44px] lg:items-center lg:gap-2 lg:border-[#E7E9ED] lg:p-2"
                        >
                          <div className="mb-3 flex items-center justify-between lg:mb-0 lg:block">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F3F6] text-xs font-bold text-[#71778A]">
                              {index + 1}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removeLine(index)
                              }
                              disabled={
                                form.lines.length <= 2
                              }
                              className="rounded-lg p-2 text-[#9A7B82] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 lg:hidden"
                              title="Remove line"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* ACCOUNT */}
                          <div>
                            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#858B9D] lg:hidden">
                              Account
                            </label>

                            <select
                              value={line.accountId}
                              onChange={(e) =>
                                updateLine(
                                  index,
                                  "accountId",
                                  e.target.value,
                                )
                              }
                              className="h-10 w-full rounded-lg border border-[#DFE2E8] bg-white px-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                            >
                              <option value="">
                                Select account
                              </option>

                              {accounts.map(
                                (account) => (
                                  <option
                                    key={account.id}
                                    value={account.id}
                                  >
                                    {account.code} -{" "}
                                    {account.name}
                                  </option>
                                ),
                              )}
                            </select>

                            {selectedAccount && (
                              <div className="mt-1 text-[10px] text-[#8A90A3] lg:hidden">
                                {selectedAccount.type}
                              </div>
                            )}
                          </div>

                          {/* MEMO */}
                          <div className="mt-3 lg:mt-0">
                            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#858B9D] lg:hidden">
                              Memo
                            </label>

                            <input
                              value={line.memo}
                              onChange={(e) =>
                                updateLine(
                                  index,
                                  "memo",
                                  e.target.value,
                                )
                              }
                              placeholder="Line description or memo"
                              className="h-10 w-full rounded-lg border border-[#DFE2E8] bg-white px-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A5B3] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                            />
                          </div>

                          {/* DEBIT */}
                          <div className="mt-3 lg:mt-0">
                            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#858B9D] lg:hidden">
                              Debit (KES)
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={line.debit}
                              onChange={(e) =>
                                updateLine(
                                  index,
                                  "debit",
                                  e.target.value,
                                )
                              }
                              placeholder="0.00"
                              className="h-10 w-full rounded-lg border border-[#DFE2E8] bg-white px-3 text-right text-sm font-semibold tabular-nums text-[#20243A] outline-none transition placeholder:font-normal placeholder:text-[#A0A5B3] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                            />
                          </div>

                          {/* CREDIT */}
                          <div className="mt-3 lg:mt-0">
                            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#858B9D] lg:hidden">
                              Credit (KES)
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={line.credit}
                              onChange={(e) =>
                                updateLine(
                                  index,
                                  "credit",
                                  e.target.value,
                                )
                              }
                              placeholder="0.00"
                              className="h-10 w-full rounded-lg border border-[#DFE2E8] bg-white px-3 text-right text-sm font-semibold tabular-nums text-[#20243A] outline-none transition placeholder:font-normal placeholder:text-[#A0A5B3] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                            />
                          </div>

                          {/* REMOVE */}
                          <div className="hidden lg:flex lg:justify-center">
                            <button
                              type="button"
                              onClick={() =>
                                removeLine(index)
                              }
                              disabled={
                                form.lines.length <= 2
                              }
                              className="rounded-lg p-2 text-[#9A7B82] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                              title="Remove line"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ADD LINE */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={addLine}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#CBD2D8] bg-white py-3 text-xs font-semibold text-[#687085] transition hover:border-[#0D9488] hover:bg-[#F7FCFB] hover:text-[#0D7F75]"
                    >
                      <Plus size={15} />
                      Add journal line
                    </button>
                  </div>

                  {/* TOTALS */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[#E1E4EA] bg-white px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A90A3]">
                        Total Debit
                      </div>

                      <div className="mt-1 text-base font-semibold tabular-nums text-[#20243A]">
                        {formatMoney(totals.debit)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#E1E4EA] bg-white px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A90A3]">
                        Total Credit
                      </div>

                      <div className="mt-1 text-base font-semibold tabular-nums text-[#20243A]">
                        {formatMoney(totals.credit)}
                      </div>
                    </div>

                    <div
                      className={`rounded-xl border px-4 py-3 ${
                        isBalanced
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <div
                        className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          isBalanced
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }`}
                      >
                        Balance status
                      </div>

                      <div
                        className={`mt-1 flex items-center gap-2 text-sm font-semibold ${
                          isBalanced
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }`}
                      >
                        {isBalanced ? (
                          <>
                            <CheckCircle size={16} />
                            Balanced
                          </>
                        ) : (
                          <>
                            <AlertCircle size={16} />
                            Difference{" "}
                            {formatMoney(
                              Math.abs(difference),
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* SUPPORTING DETAILS */}
                <section>
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-[#20243A]">
                      Supporting details
                    </h3>

                    <p className="mt-1 text-xs text-[#8A90A3]">
                      Add context that helps reviewers and auditors understand the entry.
                    </p>
                  </div>

                  <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                    Notes{" "}
                    <span className="text-[#0D9488]">
                      *
                    </span>
                  </label>

                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      updateHeader(
                        "notes",
                        e.target.value,
                      )
                    }
                    rows={4}
                    placeholder="Enter supporting notes, references or business context..."
                    className="w-full resize-y rounded-xl border border-[#DFE2E8] bg-white px-3.5 py-3 text-sm leading-6 text-[#20243A] outline-none transition placeholder:text-[#A0A5B3] hover:border-[#C9CDD5] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                  />

                  <p className="mt-1.5 text-[11px] text-[#9096A7]">
                    Required for audit context and transaction traceability.
                  </p>
                </section>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex shrink-0 flex-col gap-3 border-t border-[#E9EBEF] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex items-center gap-2 text-[11px] text-[#8A90A3]">
                <Save size={14} />

                {editingEntry
                  ? "Changes will remain in draft until posted."
                  : "Reference number will be generated automatically and this entry will be created as a draft."}
              </div>

              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-[#DDE0E6] bg-white px-5 py-2.5 text-sm font-semibold text-[#52586B] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveEntry}
                  disabled={
                    saving ||
                    !isBalanced ||
                    populatedLines.length < 2
                  }
                  className="flex-1 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F75] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[160px] sm:flex-none"
                >
                  {saving
                    ? "Saving..."
                    : editingEntry
                    ? "Save changes"
                    : "Save draft"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}