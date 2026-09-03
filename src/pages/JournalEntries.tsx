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
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type JournalStatus = "DRAFT" | "POSTED" | "APPROVED" | "REVERSED";

type JournalEntry = {
  id: string;
  reference: string;
  transactionDate: string;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  status: JournalStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  debitAccount: Account;
  creditAccount: Account;
};

type FormState = {
  reference: string;
  transactionDate: string;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  reference: "",
  transactionDate: new Date().toISOString().split("T")[0],
  description: "",
  debitAccountId: "",
  creditAccountId: "",
  amount: "",
  notes: "",
});

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

  const apiRequest = async (
    url: string,
    options: RequestInit = {}
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
        `API returned ${response.status} instead of JSON.`
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || `Request failed (${response.status})`
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
          : "Failed to load journal entries"
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
      const matchesSearch =
        !query ||
        entry.reference.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        entry.debitAccount?.name
          ?.toLowerCase()
          .includes(query) ||
        entry.debitAccount?.code
          ?.toLowerCase()
          .includes(query) ||
        entry.creditAccount?.name
          ?.toLowerCase()
          .includes(query) ||
        entry.creditAccount?.code
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        entry.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [entries, search, statusFilter]);

  const updateForm = (
    field: keyof FormState,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openNewEntry = () => {
    setEditingEntry(null);
    setForm(emptyForm());
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    if (entry.status !== "DRAFT") return;

    setEditingEntry(entry);

    setForm({
      reference: entry.reference,
      transactionDate: entry.transactionDate.split("T")[0],
      description: entry.description,
      debitAccountId: entry.debitAccountId,
      creditAccountId: entry.creditAccountId,
      amount: String(entry.amount),
      notes: entry.notes || "",
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

  const validateForm = () => {
    if (!form.reference.trim()) {
      throw new Error("Reference is required.");
    }

    if (!form.transactionDate) {
      throw new Error("Transaction date is required.");
    }

    if (!form.description.trim()) {
      throw new Error("Description is required.");
    }

    if (!form.debitAccountId || !form.creditAccountId) {
      throw new Error(
        "Both debit and credit accounts are required."
      );
    }

    if (form.debitAccountId === form.creditAccountId) {
      throw new Error(
        "Debit and credit accounts must be different."
      );
    }

    if (!form.amount) {
      throw new Error("Amount is required.");
    }

    if (!form.notes.trim()) {
      throw new Error(
        "Notes are required. Add supporting details for this journal entry."
      );
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than zero.");
    }

    return amount;
  };

  const saveEntry = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const amount = validateForm();

      const body = {
        reference: form.reference.trim(),
        transactionDate: form.transactionDate,
        description: form.description.trim(),
        debitAccountId: form.debitAccountId,
        creditAccountId: form.creditAccountId,
        amount,
        notes: form.notes.trim() || null,
      };

      if (editingEntry) {
        await apiRequest(
          `/api/journals/${editingEntry.id}`,
          {
            method: "PUT",
            body: JSON.stringify(body),
          }
        );

        setSuccess(
          "Journal entry updated successfully."
        );
      } else {
        await apiRequest("/api/journals", {
          method: "POST",
          body: JSON.stringify(body),
        });

        setSuccess(
          "Journal entry created as draft."
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
          : "Failed to save journal entry"
      );
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    action: () => Promise<unknown>,
    message: string
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
          : "Journal action failed"
      );
    }
  };

  const postEntry = (entry: JournalEntry) => {
    if (
      !window.confirm(
        `Post journal entry ${entry.reference}? It will no longer be editable.`
      )
    ) {
      return;
    }

    runAction(
      () =>
        apiRequest(
          `/api/journals/${entry.id}/post`,
          { method: "PATCH" }
        ),
      `${entry.reference} posted successfully.`
    );
  };

  const approveEntry = (entry: JournalEntry) => {
    if (
      !window.confirm(
        `Approve journal entry ${entry.reference}?`
      )
    ) {
      return;
    }

    runAction(
      () =>
        apiRequest(
          `/api/journals/${entry.id}/approve`,
          { method: "PATCH" }
        ),
      `${entry.reference} approved successfully.`
    );
  };

  const reverseEntry = (entry: JournalEntry) => {
    const reason = window.prompt(
      `Reason for reversing ${entry.reference}:`
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
          }
        ),
      `${entry.reference} reversed successfully.`
    );
  };

  const deleteEntry = (entry: JournalEntry) => {
    if (
      !window.confirm(
        `Delete draft ${entry.reference}? This cannot be undone.`
      )
    ) {
      return;
    }

    runAction(
      () =>
        apiRequest(`/api/journals/${entry.id}`, {
          method: "DELETE",
        }),
      `${entry.reference} deleted.`
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

  const totalAmount = Number(form.amount || 0);

  const selectedDebit = accounts.find(
    (account) => account.id === form.debitAccountId
  );

  const selectedCredit = accounts.find(
    (account) => account.id === form.creditAccountId
  );

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
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
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
            <table className="w-full min-w-[1050px]">

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
                    Debit
                  </th>

                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Credit
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#858B9D]">
                    Amount
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
                  filteredEntries.map((entry) => (
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
                          entry.transactionDate
                        )}
                      </td>

                      <td className="max-w-[240px] px-4 py-4">
                        <div
                          className="truncate text-sm font-medium text-[#30364A]"
                          title={entry.description}
                        >
                          {entry.description}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-[#4F556B]">
                        {entry.debitAccount ? (
                          <div>
                            <div className="font-medium text-[#30364A]">
                              {entry.debitAccount.name}
                            </div>

                            <div className="mt-0.5 text-xs text-[#8A90A3]">
                              {entry.debitAccount.code}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm text-[#4F556B]">
                        {entry.creditAccount ? (
                          <div>
                            <div className="font-medium text-[#30364A]">
                              {entry.creditAccount.name}
                            </div>

                            <div className="mt-0.5 text-xs text-[#8A90A3]">
                              {entry.creditAccount.code}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#20243A]">
                        {formatMoney(entry.amount)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                            entry.status
                          )}`}
                        >
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          {entry.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">

                          {entry.status === "DRAFT" && (
                            <>
                              <button
                                onClick={() =>
                                  openEditEntry(entry)
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
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}

                          {entry.status === "POSTED" && (
                            <button
                              onClick={() =>
                                approveEntry(entry)
                              }
                              title="Approve"
                              className="flex items-center gap-1.5 rounded-lg bg-[#F0FAF4] px-3 py-2 text-xs font-semibold text-[#25834B] transition hover:bg-[#E3F6EB]"
                            >
                              <CheckCircle size={15} />
                              Approve
                            </button>
                          )}

                          {entry.status === "APPROVED" && (
                            <button
                              onClick={() =>
                                reverseEntry(entry)
                              }
                              title="Reverse"
                              className="flex items-center gap-1.5 rounded-lg bg-[#FFF7ED] px-3 py-2 text-xs font-semibold text-[#B7681E] transition hover:bg-[#FFEDD5]"
                            >
                              <RotateCcw size={15} />
                              Reverse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* NEW / EDIT JOURNAL ENTRY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#111827]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 lg:p-6">

          <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:rounded-2xl lg:max-w-4xl">

            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-start justify-between border-b border-[#E9EBEF] px-5 py-4 sm:px-7 sm:py-5">

              <div className="min-w-0">

                <div className="mb-2 inline-flex items-center rounded-md bg-[#EAF8F6] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0D7F75]">
                  Journal
                </div>

                <h2 className="text-xl font-semibold tracking-tight text-[#171A2B] sm:text-2xl">
                  {editingEntry
                    ? "Edit journal entry"
                    : "New journal entry"}
                </h2>

                <p className="mt-1 text-sm text-[#7A8094]">
                  {editingEntry
                    ? "Update this draft before posting."
                    : "Create a balanced accounting transaction."}
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
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {error}
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
                        Identify and describe the transaction.
                      </p>
                    </div>

                    <span className="hidden text-[11px] font-medium text-[#9A9FAF] sm:block">
                      * Required
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                        Reference{" "}
                        <span className="text-[#0D9488]">*</span>
                      </label>

                      <input
                        value={form.reference}
                        onChange={(e) =>
                          updateForm(
                            "reference",
                            e.target.value
                          )
                        }
                        placeholder="e.g. JE-0001"
                        autoComplete="off"
                        className="h-11 w-full rounded-xl border border-[#DFE2E8] bg-white px-3.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A5B3] hover:border-[#C9CDD5] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                        Transaction date{" "}
                        <span className="text-[#0D9488]">*</span>
                      </label>

                      <input
                        type="date"
                        value={form.transactionDate}
                        onChange={(e) =>
                          updateForm(
                            "transactionDate",
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-[#DFE2E8] bg-white px-3.5 text-sm text-[#20243A] outline-none transition hover:border-[#C9CDD5] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                      />
                    </div>
                  </div>

                  <div className="mt-4">

                    <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                      Description{" "}
                      <span className="text-[#0D9488]">*</span>
                    </label>

                    <input
                      value={form.description}
                      onChange={(e) =>
                        updateForm(
                          "description",
                          e.target.value
                        )
                      }
                      placeholder="What is this transaction for?"
                      className="h-11 w-full rounded-xl border border-[#DFE2E8] bg-white px-3.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A5B3] hover:border-[#C9CDD5] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                    />
                  </div>
                </section>

                {/* DOUBLE ENTRY */}
                <section className="rounded-2xl border border-[#E4E7EC] bg-[#F9FAFB] p-4 sm:p-5">

                  <div className="mb-4">

                    <div className="flex items-center justify-between gap-3">

                      <h3 className="text-sm font-semibold text-[#20243A]">
                        Double-entry allocation
                      </h3>

                      <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7E8496] shadow-sm ring-1 ring-[#E6E8ED]">
                        Balanced transaction
                      </div>
                    </div>

                    <p className="mt-1 text-xs text-[#8A90A3]">
                      Every journal entry must have equal debit and credit values.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_36px_1fr] lg:items-end">

                    {/* DEBIT */}
                    <div className="rounded-xl border border-[#E1E4EA] bg-white p-3.5">

                      <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                        Debit account{" "}
                        <span className="text-[#0D9488]">*</span>
                      </label>

                      <select
                        value={form.debitAccountId}
                        onChange={(e) =>
                          updateForm(
                            "debitAccountId",
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-lg border border-[#DFE2E8] bg-white px-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                      >
                        <option value="">
                          Select debit account
                        </option>

                        {accounts.map((account) => (
                          <option
                            key={account.id}
                            value={account.id}
                          >
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>

                      {selectedDebit && (
                        <div className="mt-2 text-[11px] text-[#8A90A3]">
                          {selectedDebit.type}
                        </div>
                      )}
                    </div>

                    {/* RELATIONSHIP */}
                    <div className="hidden h-9 w-9 items-center justify-center self-center rounded-full bg-white text-xs font-bold text-[#8A90A3] ring-1 ring-[#E2E5EA] lg:flex">
                      ↔
                    </div>

                    {/* CREDIT */}
                    <div className="rounded-xl border border-[#E1E4EA] bg-white p-3.5">

                      <label className="mb-1.5 block text-xs font-semibold text-[#52586B]">
                        Credit account{" "}
                        <span className="text-[#0D9488]">*</span>
                      </label>

                      <select
                        value={form.creditAccountId}
                        onChange={(e) =>
                          updateForm(
                            "creditAccountId",
                            e.target.value
                          )
                        }
                        className="h-11 w-full rounded-lg border border-[#DFE2E8] bg-white px-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                      >
                        <option value="">
                          Select credit account
                        </option>

                        {accounts.map((account) => (
                          <option
                            key={account.id}
                            value={account.id}
                          >
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>

                      {selectedCredit && (
                        <div className="mt-2 text-[11px] text-[#8A90A3]">
                          {selectedCredit.type}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AMOUNT */}
                  <div className="mt-3 rounded-xl border border-[#E1E4EA] bg-white p-3.5">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div>
                        <label className="block text-xs font-semibold text-[#52586B]">
                          Transaction amount{" "}
                          <span className="text-[#0D9488]">*</span>
                        </label>

                        <p className="mt-1 text-[11px] text-[#8A90A3]">
                          Currency: Kenyan Shilling (KES)
                        </p>
                      </div>

                      <div className="relative w-full sm:w-64">

                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-[#8A90A3]">
                          KES
                        </span>

                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.amount}
                          onChange={(e) =>
                            updateForm(
                              "amount",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                          inputMode="decimal"
                          className="h-11 w-full rounded-lg border border-[#DFE2E8] bg-white pl-12 pr-3 text-right text-sm font-semibold tabular-nums text-[#20243A] outline-none transition placeholder:font-normal placeholder:text-[#A0A5B3] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* TOTALS */}
                  <div className="mt-3 grid grid-cols-2 gap-3">

                    <div className="rounded-xl border border-[#E1E4EA] bg-white px-3.5 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A90A3]">
                        Debit
                      </div>

                      <div className="mt-1 text-sm font-semibold tabular-nums text-[#20243A]">
                        {formatMoney(totalAmount)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#E1E4EA] bg-white px-3.5 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A90A3]">
                        Credit
                      </div>

                      <div className="mt-1 text-sm font-semibold tabular-nums text-[#20243A]">
                        {formatMoney(totalAmount)}
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
                    <span className="text-[#0D9488]">*</span>
                  </label>

                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      updateForm(
                        "notes",
                        e.target.value
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

              <div className="text-[11px] text-[#8A90A3]">
                {editingEntry
                  ? "Changes will remain in draft until posted."
                  : "This entry will be created as a draft."}
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
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F75] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[145px] sm:flex-none"
                >
                  {saving
                    ? "Saving..."
                    : editingEntry
                    ? "Save changes"
                    : "Create draft"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}