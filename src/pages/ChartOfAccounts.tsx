import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";

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

const emptyForm: AccountForm = {
  code: "",
  name: "",
  type: "",
  description: "",
  parentId: "",
};

const accountTypes = ["Asset", "Liability", "Equity", "Income", "Expense"];

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);

  const getToken = () => localStorage.getItem("token");

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/accounts", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load accounts");
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("ACCOUNT LOAD ERROR:", error);
      setError(error instanceof Error ? error.message : "Unable to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) =>
      account.code.toLowerCase().includes(query) ||
      account.name.toLowerCase().includes(query) ||
      account.type.toLowerCase().includes(query) ||
      account.description?.toLowerCase().includes(query) ||
      account.parent?.name.toLowerCase().includes(query)
    );
  }, [accounts, search]);

  const openCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setForm({
      code: account.code,
      name: account.name,
      type: account.type,
      description: account.description || "",
      parentId: account.parentId || "",
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const saveAccount = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.type) {
      setError("Account code, account name and type are required.");
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
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim() || null,
          parentId: form.parentId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save account");
      setModalOpen(false);
      setEditingAccount(null);
      setForm(emptyForm);
      setSuccess(editing ? "Account updated successfully." : "Account created successfully.");
      await loadAccounts();
    } catch (error) {
      console.error("SAVE ACCOUNT ERROR:", error);
      setError(error instanceof Error ? error.message : "Unable to save account");
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (account: Account) => {
    if (!window.confirm(`Delete ${account.code} - ${account.name}?`)) return;
    try {
      setError("");
      setSuccess("");
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to delete account");
      setSuccess("Account deleted successfully.");
      await loadAccounts();
    } catch (error) {
      console.error("DELETE ACCOUNT ERROR:", error);
      setError(error instanceof Error ? error.message : "Unable to delete account");
    }
  };

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Chart of Accounts</h1>
          <p className="text-slate-400 mt-2">Manage your organization's financial accounts.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadAccounts}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-white disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white"
          >
            <Plus size={18} />
            New Account
          </button>
        </div>
      </div>

      {/* MESSAGES */}
      {error && !modalOpen && (
        <div className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-xl p-4">
          {error}
        </div>
      )}
      {success && (
        <div className="border border-green-500/30 bg-green-500/10 text-green-400 rounded-xl p-4">
          {success}
        </div>
      )}

      {/* SEARCH */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center bg-slate-900 rounded-lg px-3">
          <Search size={18} className="text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, account name or type..."
            className="bg-transparent outline-none px-3 py-3 text-white flex-1"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Code</th>
              <th className="text-left p-4">Account Name</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Parent Account</th>
              <th className="text-left p-4">Description</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400">
                  Loading Chart of Accounts...
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400">
                  No accounts found.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => (
                <tr key={account.id} className="border-t border-slate-800 hover:bg-slate-900/70">
                  <td className="p-4 text-blue-400 font-medium">{account.code}</td>
                  <td className="p-4 text-white">{account.name}</td>
                  <td className="p-4 text-slate-300">{account.type}</td>
                  <td className="p-4 text-slate-400">
                    {account.parent ? `${account.parent.code} - ${account.parent.name}` : "-"}
                  </td>
                  <td className="p-4 text-slate-400">{account.description || "-"}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(account)}
                        className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10"
                        title="Edit account"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => deleteAccount(account)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                        title="Delete account"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl">

            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {editingAccount ? "Edit Account" : "New Account"}
                </h2>
                <p className="text-slate-400 mt-1">
                  {editingAccount
                    ? "Update the financial account."
                    : "Add an account to the Chart of Accounts."}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-xl p-4">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-slate-300 mb-2">Account Code *</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. 1100"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Account Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500"
                  >
                    <option value="">Select type</option>
                    {accountTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-2">Account Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Accounts Receivable"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-2">Parent Account</label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="">No Parent Account</option>
                  {accounts
                    .filter((a) => a.id !== editingAccount?.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the purpose of this account..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={saveAccount}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingAccount ? "Save Changes" : "Create Account"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}