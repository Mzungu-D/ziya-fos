import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
  createVendor,
  deleteVendor,
  getVendors,
  updateVendor,
  updateVendorStatus,
} from "../services/vendors";
import type { Vendor, VendorInput } from "../services/vendors";

type VendorFormState = {
  vendorCode: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  taxNumber: string;
};

type Notice = { type: "success" | "error"; message: string } | null;

const EMPTY_FORM: VendorFormState = {
  vendorCode: "",
  name: "",
  email: "",
  phoneNumber: "",
  address: "",
  taxNumber: "",
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#666B84]">{label}</p>
          <p className="mt-1.5 text-3xl font-bold text-[#20243A]">{value}</p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#20243A]">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorFormState>(EMPTY_FORM);
  const [busyVendorId, setBusyVendorId] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      setNotice(null);
      const data = await getVendors();
      setVendors(Array.isArray(data) ? data : []);
    } catch (error) {
      setVendors([]);
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Failed to load vendors."),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const filteredVendors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vendors;
    return vendors.filter((vendor) =>
      [vendor.vendorCode, vendor.name, vendor.email, vendor.phoneNumber, vendor.address, vendor.taxNumber, vendor.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [search, vendors]);

  const activeCount = useMemo(
    () => vendors.filter((v) => v.status === "ACTIVE").length,
    [vendors]
  );

  const inactiveCount = useMemo(
    () => vendors.filter((v) => v.status !== "ACTIVE").length,
    [vendors]
  );

  const openCreateForm = () => {
    if (saving) return;
    setEditingVendor(null);
    setForm({ ...EMPTY_FORM });
    setNotice(null);
    setFormOpen(true);
  };

  const openEditForm = (vendor: Vendor) => {
    if (saving || busyVendorId) return;
    setEditingVendor(vendor);
    setForm({
      vendorCode: vendor.vendorCode ?? "",
      name: vendor.name ?? "",
      email: vendor.email ?? "",
      phoneNumber: vendor.phoneNumber ?? "",
      address: vendor.address ?? "",
      taxNumber: vendor.taxNumber ?? "",
    });
    setNotice(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingVendor(null);
    setForm({ ...EMPTY_FORM });
  };

  const updateField = (field: keyof VendorFormState, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const vendorCode = form.vendorCode.trim();
    const name = form.name.trim();
    const email = form.email.trim();
    if (!vendorCode) { setNotice({ type: "error", message: "Vendor code is required." }); return; }
    if (!name) { setNotice({ type: "error", message: "Vendor name is required." }); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice({ type: "error", message: "Enter a valid email address." });
      return;
    }
    const input: VendorInput = {
      vendorCode,
      name,
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      address: form.address.trim(),
      taxNumber: form.taxNumber.trim(),
    };
    try {
      setSaving(true);
      setNotice(null);
      if (editingVendor) {
        const updated = await updateVendor(editingVendor.id, input);
        setVendors((current) => current.map((v) => (v.id === updated.id ? updated : v)));
        setNotice({ type: "success", message: "Vendor updated successfully." });
      } else {
        const created = await createVendor(input);
        setVendors((current) => [created, ...current.filter((v) => v.id !== created.id)]);
        setNotice({ type: "success", message: "Vendor created successfully." });
      }
      setFormOpen(false);
      setEditingVendor(null);
      setForm({ ...EMPTY_FORM });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, editingVendor ? "Failed to update vendor." : "Failed to create vendor."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (vendor: Vendor) => {
    if (busyVendorId) return;
    const nextStatus = vendor.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const action = nextStatus === "ACTIVE" ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} "${vendor.name}"?`)) return;
    try {
      setBusyVendorId(vendor.id);
      setNotice(null);
      const updated = await updateVendorStatus(vendor.id, nextStatus);
      setVendors((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotice({
        type: "success",
        message: nextStatus === "ACTIVE" ? "Vendor activated successfully." : "Vendor deactivated successfully.",
      });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to update vendor status.") });
    } finally {
      setBusyVendorId(null);
    }
  };

  const handleDelete = async (vendor: Vendor) => {
    if (busyVendorId) return;
    if (!window.confirm(`Delete "${vendor.name}" permanently?\n\nThis cannot be undone.`)) return;
    try {
      setBusyVendorId(vendor.id);
      setNotice(null);
      const message = await deleteVendor(vendor.id);
      setVendors((current) => current.filter((v) => v.id !== vendor.id));
      setNotice({ type: "success", message: message || "Vendor deleted successfully." });
    } catch (error) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to delete vendor.") });
    } finally {
      setBusyVendorId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#666B84]">Business Operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#20243A]">Vendors</h1>
          <p className="mt-2 text-[#666B84]">Manage suppliers and service providers used across Ziya FOS.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void loadVendors()} disabled={loading || saving}
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button type="button" onClick={openCreateForm} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d3349] disabled:opacity-50">
            <Plus size={18} /> Add Vendor
          </button>
        </div>
      </div>

      {notice && (
        <div role="alert" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-red-500/20 bg-red-500/10 text-red-600"}`}>
          {notice.type === "success"
            ? <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            : <AlertCircle size={19} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total Vendors" value={vendors.length} icon={<Building2 size={20} />} />
        <SummaryCard label="Active Vendors" value={activeCount} icon={<CheckCircle2 size={20} />} />
        <SummaryCard label="Inactive Vendors" value={inactiveCount} />
      </div>

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex items-center rounded-xl border border-[#ECECF3] px-4 focus-within:border-[#20243A]">
          <Search size={18} className="shrink-0 text-[#666B84]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} type="search"
            placeholder="Search by vendor name, code, KRA PIN, phone, email or address..."
            className="w-full bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-slate-400" />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="text-[#666B84] hover:text-[#20243A]">
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white">
          <div className="text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-[#20243A]" />
            <p className="mt-3 text-sm text-[#666B84]">Loading vendors...</p>
          </div>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[#ECECF3] bg-white px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F9FC]">
            <Building2 size={27} className="text-[#20243A]" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
            {vendors.length === 0 ? "No vendors registered" : "No matching vendors"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#666B84]">
            {vendors.length === 0 ? "Add your first vendor to begin managing supplier bills and expenses." : "Try another search term."}
          </p>
          {vendors.length === 0 && (
            <button type="button" onClick={openCreateForm}
              className="mt-5 flex items-center gap-2 rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2d3349]">
              <Plus size={18} /> Add First Vendor
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredVendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} busy={busyVendorId === vendor.id}
              onEdit={() => openEditForm(vendor)}
              onToggleStatus={() => void handleToggleStatus(vendor)}
              onDelete={() => void handleDelete(vendor)} />
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">{editingVendor ? "Edit Vendor" : "Add Vendor"}</h2>
                <p className="mt-1 text-sm text-[#666B84]">{editingVendor ? "Update this supplier master record." : "Create a supplier master record for Ziya FOS."}</p>
              </div>
              <button type="button" onClick={closeForm} disabled={saving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:opacity-50">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <FormField label="Vendor Code" required>
                  <input value={form.vendorCode} onChange={(e) => updateField("vendorCode", e.target.value)}
                    disabled={saving} required autoComplete="off" placeholder="e.g. VEN-0001"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </FormField>
                <FormField label="Vendor / Business Name" required>
                  <input value={form.name} onChange={(e) => updateField("name", e.target.value)}
                    disabled={saving} required autoComplete="organization" placeholder="Enter vendor name"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </FormField>
                <FormField label="Email">
                  <input value={form.email} onChange={(e) => updateField("email", e.target.value)}
                    disabled={saving} type="email" autoComplete="email" placeholder="vendor@example.com"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </FormField>
                <FormField label="Phone Number">
                  <input value={form.phoneNumber} onChange={(e) => updateField("phoneNumber", e.target.value)}
                    disabled={saving} type="tel" autoComplete="tel" placeholder="+254..."
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </FormField>
                <FormField label="KRA PIN / Tax Number">
                  <input value={form.taxNumber} onChange={(e) => updateField("taxNumber", e.target.value)}
                    disabled={saving} autoComplete="off" placeholder="Enter KRA PIN or tax number"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </FormField>
                <FormField label="Address">
                  <input value={form.address} onChange={(e) => updateField("address", e.target.value)}
                    disabled={saving} autoComplete="street-address" placeholder="Enter business address"
                    className="w-full rounded-xl border border-[#ECECF3] px-4 py-3 text-sm text-[#20243A] outline-none focus:border-[#20243A] disabled:opacity-60" />
                </FormField>
              </div>
              {notice?.type === "error" && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={17} className="shrink-0" />{notice.message}
                </div>
              )}
              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#ECECF3] pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} disabled={saving}
                  className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#20243A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2d3349] disabled:opacity-60">
                  {saving ? <Loader2 size={17} className="animate-spin" /> : editingVendor ? <Edit3 size={17} /> : <Plus size={17} />}
                  {saving ? "Saving..." : editingVendor ? "Save Changes" : "Create Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VendorCard({
  vendor, busy, onEdit, onToggleStatus, onDelete,
}: {
  vendor: Vendor; busy: boolean; onEdit: () => void; onToggleStatus: () => void; onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = vendor.status === "ACTIVE";

  return (
    <div className="relative rounded-2xl border border-[#ECECF3] bg-white p-6 transition hover:border-[#20243A]/20 hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC]">
            <Building2 size={27} className="text-[#20243A]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-[#20243A]">{vendor.name}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? "bg-emerald-500/10 text-emerald-700" : "bg-[#F8F9FC] text-[#666B84]"}`}>
                {active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-sm font-medium text-[#666B84]">{vendor.vendorCode}</p>
          </div>
        </div>
        <div className="relative">
          <button type="button" disabled={busy} onClick={() => setMenuOpen((c) => !c)}
            className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A] disabled:opacity-50">
            {busy ? <Loader2 size={19} className="animate-spin" /> : <MoreVertical size={19} />}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl border border-[#ECECF3] bg-white shadow-lg">
                <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#20243A] hover:bg-[#F8F9FC]">
                  <Edit3 size={16} className="text-[#666B84]" /> Edit Vendor
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); onToggleStatus(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#20243A] hover:bg-[#F8F9FC]">
                  <CheckCircle2 size={16} className="text-[#666B84]" /> {active ? "Deactivate" : "Activate"}
                </button>
                <div className="border-t border-[#ECECF3]" />
                <button type="button" onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50">
                  <Trash2 size={16} /> Delete Vendor
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {vendor.email && <div className="flex items-center gap-2 text-sm text-[#666B84]"><Mail size={15} className="shrink-0" /><span className="truncate">{vendor.email}</span></div>}
        {vendor.phoneNumber && <div className="flex items-center gap-2 text-sm text-[#666B84]"><Phone size={15} className="shrink-0" /><span>{vendor.phoneNumber}</span></div>}
        {vendor.address && <div className="flex items-center gap-2 text-sm text-[#666B84]"><MapPin size={15} className="shrink-0" /><span className="truncate">{vendor.address}</span></div>}
      </div>
      {(vendor.taxNumber || vendor.createdAt) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#ECECF3] pt-4 text-xs text-[#666B84]">
          {vendor.taxNumber && <span className="font-mono">KRA: {vendor.taxNumber}</span>}
          {vendor.createdAt && (
            <span>Added {new Intl.DateTimeFormat("en-KE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(vendor.createdAt))}</span>
          )}
        </div>
      )}
    </div>
  );
}