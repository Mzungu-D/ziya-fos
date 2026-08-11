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
    if (
      !form.reference.trim() ||
      !form.transactionDate ||
      !form.description.trim() ||
      !form.debitAccountId ||
      !form.creditAccountId ||
      !form.amount
    ) {
      throw new Error(
        "Reference, date, description, accounts and amount are required."
      );
    }

    if (
      form.debitAccountId === form.creditAccountId
    ) {
      throw new Error(
        "Debit and credit accounts must be different."
      );
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        "Amount must be greater than zero."
      );
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
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";

      case "APPROVED":
        return "bg-green-500/10 text-green-400 border-green-500/30";

      case "REVERSED":
        return "bg-red-500/10 text-red-400 border-red-500/30";

      default:
        return "bg-slate-500/10 text-[#666B84] border-slate-500/30";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Journal Entries
          </h1>

          <p className="mt-2 text-[#666B84]">
            Record, post, approve and reverse accounting
            transactions.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#F8F9FC] px-4 py-2 text-[#20243A] hover:bg-[#ECECF3] disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={
                loading ? "animate-spin" : ""
              }
            />

            Refresh
          </button>

          <button
            onClick={openNewEntry}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[#20243A] hover:bg-blue-700"
          >
            <Plus size={18} />
            New Entry
          </button>
        </div>
      </div>

      {error && !modalOpen && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-400">
          {success}
        </div>
      )}

      <div className="flex gap-4 rounded-2xl border border-[#ECECF3] bg-[#111827] p-4">
        <div className="flex flex-1 items-center rounded-lg bg-white px-3">
          <Search
            size={18}
            className="text-[#666B84]"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search reference, description or account..."
            className="flex-1 bg-transparent px-3 py-3 text-[#20243A] outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
          className="rounded-lg border border-[#ECECF3] bg-white px-4 text-[#20243A] outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
          <option value="APPROVED">Approved</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#ECECF3] bg-[#111827]">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="p-4 text-left">
                Reference
              </th>

              <th className="p-4 text-left">
                Date
              </th>

              <th className="p-4 text-left">
                Description
              </th>

              <th className="p-4 text-left">
                Debit
              </th>

              <th className="p-4 text-left">
                Credit
              </th>

              <th className="p-4 text-right">
                Amount
              </th>

              <th className="p-4 text-left">
                Status
              </th>

              <th className="p-4 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-12 text-center text-[#666B84]"
                >
                  Loading journal entries...
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-12 text-center text-[#666B84]"
                >
                  No journal entries found.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-[#ECECF3] hover:bg-white/60"
                >
                  <td className="p-4 font-medium text-blue-400">
                    {entry.reference}
                  </td>

                  <td className="p-4 text-[#666B84]">
                    {formatDate(
                      entry.transactionDate
                    )}
                  </td>

                  <td className="p-4 text-[#20243A]">
                    {entry.description}
                  </td>

                  <td className="p-4 text-green-400">
                    {entry.debitAccount
                      ? `${entry.debitAccount.code} - ${entry.debitAccount.name}`
                      : "-"}
                  </td>

                  <td className="p-4 text-red-400">
                    {entry.creditAccount
                      ? `${entry.creditAccount.code} - ${entry.creditAccount.name}`
                      : "-"}
                  </td>

                  <td className="p-4 text-right font-semibold text-[#20243A]">
                    {formatMoney(entry.amount)}
                  </td>

                  <td className="p-4">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                        entry.status
                      )}`}
                    >
                      {entry.status}
                    </span>
                  </td>

                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      {entry.status === "DRAFT" && (
                        <>
                          <button
                            onClick={() =>
                              openEditEntry(entry)
                            }
                            title="Edit"
                            className="rounded-lg bg-[#F8F9FC] p-2 text-[#666B84] hover:bg-[#ECECF3] hover:text-[#20243A]"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            onClick={() =>
                              postEntry(entry)
                            }
                            title="Post"
                            className="rounded-lg bg-blue-500/10 p-2 text-blue-400 hover:bg-blue-500/20"
                          >
                            <Send size={17} />
                          </button>

                          <button
                            onClick={() =>
                              deleteEntry(entry)
                            }
                            title="Delete"
                            className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                          >
                            <Trash2 size={17} />
                          </button>
                        </>
                      )}

                      {entry.status === "POSTED" && (
                        <button
                          onClick={() =>
                            approveEntry(entry)
                          }
                          title="Approve"
                          className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400 hover:bg-green-500/20"
                        >
                          <CheckCircle size={17} />
                          Approve
                        </button>
                      )}

                      {entry.status ===
                        "APPROVED" && (
                        <button
                          onClick={() =>
                            reverseEntry(entry)
                          }
                          title="Reverse"
                          className="flex items-center gap-2 rounded-lg bg-orange-500/10 px-3 py-2 text-sm text-orange-400 hover:bg-orange-500/20"
                        >
                          <RotateCcw size={17} />
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

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-[#111827] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-2xl font-bold text-[#20243A]">
                  {editingEntry
                    ? "Edit Journal Entry"
                    : "New Journal Entry"}
                </h2>

                <p className="mt-1 text-[#666B84]">
                  {editingEntry
                    ? "Update this draft accounting transaction."
                    : "Create a balanced double-entry transaction."}
                </p>
              </div>

              <button
                onClick={closeModal}
                className="text-[#666B84] hover:text-[#20243A]"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="mb-2 block text-[#666B84]">
                    Reference *
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
                    className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[#666B84]">
                    Transaction Date *
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
                    className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[#666B84]">
                  Description *
                </label>

                <input
                  value={form.description}
                  onChange={(e) =>
                    updateForm(
                      "description",
                      e.target.value
                    )
                  }
                  placeholder="Transaction description"
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="mb-2 block text-[#666B84]">
                    Debit Account *
                  </label>

                  <select
                    value={form.debitAccountId}
                    onChange={(e) =>
                      updateForm(
                        "debitAccountId",
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select debit account
                    </option>

                    {accounts.map((account) => (
                      <option
                        key={account.id}
                        value={account.id}
                      >
                        {account.code} -{" "}
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[#666B84]">
                    Credit Account *
                  </label>

                  <select
                    value={form.creditAccountId}
                    onChange={(e) =>
                      updateForm(
                        "creditAccountId",
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none focus:border-blue-500"
                  >
                    <option value="">
                      Select credit account
                    </option>

                    {accounts.map((account) => (
                      <option
                        key={account.id}
                        value={account.id}
                      >
                        {account.code} -{" "}
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[#666B84]">
                  Amount (KES) *
                </label>

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
                  className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-[#666B84]">
                  Notes
                </label>

                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    updateForm(
                      "notes",
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Optional notes..."
                  className="w-full resize-none rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] p-6">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl bg-[#F8F9FC] px-5 py-3 text-[#20243A] hover:bg-[#ECECF3] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={saveEntry}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-3 text-[#20243A] hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingEntry
                  ? "Save Changes"
                  : "Create Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
