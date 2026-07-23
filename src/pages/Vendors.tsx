import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit3,
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
import type {
  FormEvent,
  ReactNode,
} from "react";

import {
  createVendor,
  deleteVendor,
  getVendors,
  updateVendor,
  updateVendorStatus,
} from "../services/vendors";

import type {
  Vendor,
  VendorInput,
} from "../services/vendors";

/* =========================================================
   TYPES
========================================================= */

type VendorFormState = {
  vendorCode: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  taxNumber: string;
};

type Notice = {
  type: "success" | "error";
  message: string;
} | null;

/* =========================================================
   CONSTANTS
========================================================= */

const EMPTY_FORM: VendorFormState = {
  vendorCode: "",
  name: "",
  email: "",
  phoneNumber: "",
  address: "",
  taxNumber: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";

/* =========================================================
   HELPERS
========================================================= */

const getErrorMessage = (
  error: unknown,
  fallback: string
) => {
  return error instanceof Error
    ? error.message
    : fallback;
};

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

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] =
    useState<Notice>(null);

  const [formOpen, setFormOpen] =
    useState(false);

  const [editingVendor, setEditingVendor] =
    useState<Vendor | null>(null);

  const [form, setForm] =
    useState<VendorFormState>(EMPTY_FORM);

  const [busyVendorId, setBusyVendorId] =
    useState<string | null>(null);

  /* =======================================================
     LOAD VENDORS
  ======================================================= */

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getVendors();

      setVendors(data);
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Failed to load vendors"
        ),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredVendors = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase();

    if (!term) {
      return vendors;
    }

    return vendors.filter((vendor) => {
      const searchable = [
        vendor.vendorCode,
        vendor.name,
        vendor.email ?? "",
        vendor.phoneNumber ?? "",
        vendor.address ?? "",
        vendor.taxNumber ?? "",
        vendor.status,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [search, vendors]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const activeCount = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          vendor.status === "ACTIVE"
      ).length,
    [vendors]
  );

  const inactiveCount =
    vendors.length - activeCount;

  /* =======================================================
     CREATE FORM
  ======================================================= */

  const openCreateForm = () => {
    setEditingVendor(null);
    setForm(EMPTY_FORM);
    setNotice(null);
    setFormOpen(true);
  };

  /* =======================================================
     EDIT FORM
  ======================================================= */

  const openEditForm = (vendor: Vendor) => {
    setEditingVendor(vendor);

    setForm({
      vendorCode: vendor.vendorCode,
      name: vendor.name,
      email: vendor.email ?? "",
      phoneNumber:
        vendor.phoneNumber ?? "",
      address: vendor.address ?? "",
      taxNumber: vendor.taxNumber ?? "",
    });

    setNotice(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingVendor(null);
    setForm(EMPTY_FORM);
  };

  const updateFormField = (
    field: keyof VendorFormState,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  /* =======================================================
     CREATE / UPDATE VENDOR
  ======================================================= */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const vendorCode =
      form.vendorCode.trim();

    const name =
      form.name.trim();

    if (!vendorCode) {
      setNotice({
        type: "error",
        message: "Vendor code is required",
      });

      return;
    }

    if (!name) {
      setNotice({
        type: "error",
        message: "Vendor name is required",
      });

      return;
    }

    const input: VendorInput = {
      vendorCode,
      name,
      email: form.email.trim(),
      phoneNumber:
        form.phoneNumber.trim(),
      address: form.address.trim(),
      taxNumber:
        form.taxNumber.trim(),
    };

    try {
      setSaving(true);
      setNotice(null);

      if (editingVendor) {
        const updated =
          await updateVendor(
            editingVendor.id,
            input
          );

        setVendors((current) =>
          current.map((vendor) =>
            vendor.id === updated.id
              ? updated
              : vendor
          )
        );

        setNotice({
          type: "success",
          message:
            "Vendor updated successfully",
        });
      } else {
        const created =
          await createVendor(input);

        setVendors((current) => [
          created,
          ...current,
        ]);

        setNotice({
          type: "success",
          message:
            "Vendor created successfully",
        });
      }

      setFormOpen(false);
      setEditingVendor(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          editingVendor
            ? "Failed to update vendor"
            : "Failed to create vendor"
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     ACTIVATE / DEACTIVATE
  ======================================================= */

  const handleToggleStatus = async (
    vendor: Vendor
  ) => {
    const nextStatus =
      vendor.status === "ACTIVE"
        ? "INACTIVE"
        : "ACTIVE";

    const action =
      nextStatus === "ACTIVE"
        ? "activate"
        : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${vendor.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyVendorId(vendor.id);
      setNotice(null);

      const updated =
        await updateVendorStatus(
          vendor.id,
          nextStatus
        );

      setVendors((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item
        )
      );

      setNotice({
        type: "success",
        message:
          nextStatus === "ACTIVE"
            ? "Vendor activated successfully"
            : "Vendor deactivated successfully",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Failed to update vendor status"
        ),
      });
    } finally {
      setBusyVendorId(null);
    }
  };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete = async (
    vendor: Vendor
  ) => {
    const confirmed = window.confirm(
      `Delete "${vendor.name}" permanently?\n\nIf this vendor has financial transactions, Ziya FOS will block the deletion to protect accounting history.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyVendorId(vendor.id);
      setNotice(null);

      const message =
        await deleteVendor(vendor.id);

      setVendors((current) =>
        current.filter(
          (item) =>
            item.id !== vendor.id
        )
      );

      setNotice({
        type: "success",
        message,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Failed to delete vendor"
        ),
      });
    } finally {
      setBusyVendorId(null);
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Vendors
          </h1>

          <p className="mt-2 text-slate-400">
            Manage suppliers and service
            providers used across Ziya FOS.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              void loadVendors();
            }}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
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
            onClick={openCreateForm}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Notice */}

      {notice && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            notice.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0"
            />
          )}

          <span>{notice.message}</span>
        </div>
      )}

      {/* Summary */}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total Vendors"
          value={vendors.length}
        />

        <SummaryCard
          label="Active Vendors"
          value={activeCount}
        />

        <SummaryCard
          label="Inactive Vendors"
          value={inactiveCount}
        />
      </div>

      {/* Search */}

      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/40 px-4">
          <Search
            size={19}
            className="shrink-0 text-slate-500"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            type="search"
            placeholder="Search by vendor name, code, KRA PIN, phone, email or address..."
            className="w-full bg-transparent px-3 py-3.5 text-white outline-none placeholder:text-slate-600"
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              className="rounded-lg p-1 text-slate-500 hover:text-white"
              aria-label="Clear search"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Vendor Content */}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-[#111827]">
          <div className="text-center">
            <RefreshCw
              size={28}
              className="mx-auto animate-spin text-blue-400"
            />

            <p className="mt-3 text-slate-400">
              Loading vendors...
            </p>
          </div>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-800 bg-[#111827] px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
            <Building2
              size={27}
              className="text-blue-400"
            />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-white">
            {vendors.length === 0
              ? "No vendors registered"
              : "No matching vendors"}
          </h2>

          <p className="mt-2 max-w-md text-sm text-slate-400">
            {vendors.length === 0
              ? "Add your first vendor to begin managing supplier bills and expenses."
              : "Try another search term."}
          </p>

          {vendors.length === 0 && (
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              <Plus size={18} />
              Add First Vendor
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredVendors.map(
            (vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                busy={
                  busyVendorId ===
                  vendor.id
                }
                onEdit={() =>
                  openEditForm(vendor)
                }
                onToggleStatus={() => {
                  void handleToggleStatus(
                    vendor
                  );
                }}
                onDelete={() => {
                  void handleDelete(
                    vendor
                  );
                }}
              />
            )
          )}
        </div>
      )}

      {/* Create / Edit Modal */}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#111827] shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {editingVendor
                    ? "Edit Vendor"
                    : "Add Vendor"}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {editingVendor
                    ? "Update this supplier master record."
                    : "Create a supplier master record for financial transactions."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  label="Vendor Code"
                  required
                >
                  <input
                    value={
                      form.vendorCode
                    }
                    onChange={(event) =>
                      updateFormField(
                        "vendorCode",
                        event.target.value
                      )
                    }
                    placeholder="e.g. VEN-0001"
                    className={inputClass}
                  />
                </FormField>

                <FormField
                  label="Vendor / Business Name"
                  required
                >
                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateFormField(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="Enter vendor name"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Email">
                  <input
                    value={form.email}
                    onChange={(event) =>
                      updateFormField(
                        "email",
                        event.target.value
                      )
                    }
                    type="email"
                    placeholder="vendor@example.com"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Phone Number">
                  <input
                    value={
                      form.phoneNumber
                    }
                    onChange={(event) =>
                      updateFormField(
                        "phoneNumber",
                        event.target.value
                      )
                    }
                    type="tel"
                    placeholder="+254..."
                    className={inputClass}
                  />
                </FormField>

                <FormField label="KRA PIN / Tax Number">
                  <input
                    value={
                      form.taxNumber
                    }
                    onChange={(event) =>
                      updateFormField(
                        "taxNumber",
                        event.target.value
                      )
                    }
                    placeholder="Enter KRA PIN or tax number"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Address">
                  <input
                    value={
                      form.address
                    }
                    onChange={(event) =>
                      updateFormField(
                        "address",
                        event.target.value
                      )
                    }
                    placeholder="Enter business address"
                    className={inputClass}
                  />
                </FormField>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw
                      size={18}
                      className="animate-spin"
                    />
                  ) : editingVendor ? (
                    <Edit3 size={18} />
                  ) : (
                    <Plus size={18} />
                  )}

                  {saving
                    ? "Saving..."
                    : editingVendor
                      ? "Save Changes"
                      : "Create Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   VENDOR CARD
========================================================= */

function VendorCard({
  vendor,
  busy,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  vendor: Vendor;
  busy: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const active =
    vendor.status === "ACTIVE";

  return (
    <div className="relative rounded-2xl border border-slate-800 bg-[#111827] p-6 transition hover:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
            <Building2
              size={27}
              className="text-blue-400"
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-white">
                {vendor.name}
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  active
                    ? "bg-green-500/10 text-green-400"
                    : "bg-slate-700/60 text-slate-400"
                }`}
              >
                {active
                  ? "Active"
                  : "Inactive"}
              </span>
            </div>

            <p className="mt-1 font-mono text-sm text-blue-400">
              {vendor.vendorCode}
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setMenuOpen(
                (current) => !current
              )
            }
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
            aria-label={`Actions for ${vendor.name}`}
          >
            {busy ? (
              <RefreshCw
                size={19}
                className="animate-spin"
              />
            ) : (
              <MoreVertical
                size={19}
              />
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-slate-800"
              >
                <Edit3 size={16} />
                Edit Vendor
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleStatus();
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-slate-800"
              >
                <CheckCircle2
                  size={16}
                />

                {active
                  ? "Deactivate Vendor"
                  : "Activate Vendor"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-3 border-t border-slate-800 px-4 py-3 text-left text-sm text-red-400 transition hover:bg-red-500/10"
              >
                <Trash2 size={16} />
                Delete Vendor
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <VendorDetail
          icon={<Phone size={16} />}
          label="Phone"
          value={
            vendor.phoneNumber ??
            "Not provided"
          }
        />

        <VendorDetail
          icon={<Mail size={16} />}
          label="Email"
          value={
            vendor.email ??
            "Not provided"
          }
        />

        <VendorDetail
          icon={<MapPin size={16} />}
          label="Address"
          value={
            vendor.address ??
            "Not provided"
          }
        />

        <VendorDetail
          icon={
            <Building2 size={16} />
          }
          label="KRA PIN / Tax Number"
          value={
            vendor.taxNumber ??
            "Not provided"
          }
        />
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
        Added{" "}
        {formatDate(
          vendor.createdAt
        )}
      </div>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   VENDOR DETAIL
========================================================= */

function VendorDetail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <div className="mt-0.5 text-slate-500">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>

        <p className="mt-1 break-words text-sm text-slate-300">
          {value}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}

        {required && (
          <span className="ml-1 text-red-400">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}