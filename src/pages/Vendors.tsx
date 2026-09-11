import {
  AlertCircle,
  Building2,
  CheckCircle2,  Edit3,
  Loader2,
  Mail,  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  FileText,
  ShoppingCart,
  WalletCards,
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
  Vendor,
  VendorInput,
} from "../services/vendors";

type Tab = "ALL" | "ACTIVE" | "INACTIVE";

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

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phoneNumber: "",
  address: "",
  taxNumber: "",
};

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : dateFormatter.format(date);
}

function formatMoney(value?: number) {
  return currency.format(
    Number.isFinite(value) ? Number(value) : 0
  );
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
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F7FA] text-[#20243A]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const active = status === "ACTIVE";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function Vendors() {
  const [vendors, setVendors] =
    useState<Vendor[]>([]);

  const [search, setSearch] =
    useState("");

  const [tab, setTab] =
    useState<Tab>("ALL");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<{
      type: "success" | "error";
      message: string;
    } | null>(null);

  const [formOpen, setFormOpen] =
    useState(false);

  const [editing, setEditing] =
    useState<Vendor | null>(null);

  const [form, setForm] =
    useState<FormState>(EMPTY_FORM);

  const [selectedVendor, setSelectedVendor] =
    useState<Vendor360 | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const loadVendors = useCallback(
    async () => {
      try {
        setLoading(true);
        const result = await getVendors();

        setVendors(
          Array.isArray(result)
            ? result
            : []
        );
      } catch (error) {
        setNotice({
          type: "error",
          message: getErrorMessage(
            error,
            "Failed to load vendors."
          ),
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const activeCount = vendors.filter(
    (vendor) =>
      vendor.status === "ACTIVE"
  ).length;

  const inactiveCount =
    vendors.length - activeCount;

  const filteredVendors = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return vendors.filter((vendor) => {
      const tabMatch =
        tab === "ALL" ||
        (tab === "ACTIVE" &&
          vendor.status === "ACTIVE") ||
        (tab === "INACTIVE" &&
          vendor.status !== "ACTIVE");

      if (!tabMatch) return false;

      if (!term) return true;

      return [
        vendor.vendorCode,
        vendor.name,
        vendor.email,
        vendor.phoneNumber,
        vendor.address,
        vendor.taxNumber,
        vendor.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [vendors, search, tab]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setNotice(null);
    setFormOpen(true);
  };

  const openEdit = (
    vendor: Vendor
  ) => {
    setEditing(vendor);

    setForm({
      name: vendor.name ?? "",
      email: vendor.email ?? "",
      phoneNumber:
        vendor.phoneNumber ?? "",
      address: vendor.address ?? "",
      taxNumber:
        vendor.taxNumber ?? "",
    });

    setNotice(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;

    setFormOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const openDetail = async (
    vendor: Vendor
  ) => {
    try {
      setDetailLoading(true);

      const detail =
        await getVendorById(vendor.id);

      setSelectedVendor(
        detail as Vendor360
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Unable to load vendor details."
        ),
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (saving) return;

    const name = form.name.trim();
    const email = form.email.trim();

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

    const input: VendorInput = {
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
            "Vendor updated successfully.",
        });
      } else {
        const created =
          await createVendor(input);

        setVendors((current) => [
          created,
          ...current.filter(
            (vendor) =>
              vendor.id !== created.id
          ),
        ]);

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
        message: getErrorMessage(
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

  const toggleStatus = async (
    vendor: Vendor
  ) => {
    if (busyId) return;

    const next =
      vendor.status === "ACTIVE"
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
      setBusyId(vendor.id);

      const updated =
        await updateVendorStatus(
          vendor.id,
          next
        );

      setVendors((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item
        )
      );

      if (
        selectedVendor?.id ===
        updated.id
      ) {
        setSelectedVendor(
          (current) =>
            current
              ? {
                  ...current,
                  ...updated,
                }
              : current
        );
      }

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
        message: getErrorMessage(
          error,
          "Failed to update vendor status."
        ),
      });
    } finally {
      setBusyId(null);
    }
  };

  const removeVendor = async (
    vendor: Vendor
  ) => {
    if (busyId) return;

    if (
      !window.confirm(
        `Delete "${vendor.name}" permanently?\n\nVendors with financial or procurement records cannot be deleted.`
      )
    ) {
      return;
    }

    try {
      setBusyId(vendor.id);

      const message =
        await deleteVendor(
          vendor.id
        );

      setVendors((current) =>
        current.filter(
          (item) =>
            item.id !== vendor.id
        )
      );

      if (
        selectedVendor?.id ===
        vendor.id
      ) {
        setSelectedVendor(null);
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
        message: getErrorMessage(
          error,
          "Vendor could not be deleted."
        ),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#687086]">
            Business Operations
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#20243A]">
            Vendors
          </h1>

          <p className="mt-2 text-sm text-[#687086]">
            Manage supplier relationships
            across expenses, payables and
            procurement.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              void loadVendors()
            }
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8EAF0] bg-white px-4 py-2.5 text-sm font-semibold text-[#4E566B] hover:bg-[#F7F8FA]"
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
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70]"
          >
            <Plus size={18} />
            Add Vendor
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="alert"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2
              size={18}
            />
          ) : (
            <AlertCircle
              size={18}
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
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Vendors"
          value={vendors.length}
          icon={
            <Building2 size={20} />
          }
        />

        <StatCard
          label="Active Vendors"
          value={activeCount}
          icon={
            <CheckCircle2 size={20} />
          }
        />

        <StatCard
          label="Inactive Vendors"
          value={inactiveCount}
          icon={
            <Building2 size={20} />
          }
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E8EAF0] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-xl bg-[#F5F6F8] p-1">
            {(
              [
                ["ALL", "All"],
                ["ACTIVE", "Active"],
                ["INACTIVE", "Inactive"],
              ] as const
            ).map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setTab(value)
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    tab === value
                      ? "bg-white text-[#20243A] shadow-sm"
                      : "text-[#687086]"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>

          <div className="flex w-full max-w-md items-center rounded-xl border border-[#E8EAF0] px-3">
            <Search
              size={18}
              className="text-[#7B8498]"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search vendors..."
              className="w-full bg-transparent px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin text-[#20243A]"
            />
          </div>
        ) : filteredVendors.length ===
          0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <Building2
              size={32}
              className="text-[#A2A8B7]"
            />

            <h2 className="mt-3 text-lg font-semibold text-[#20243A]">
              No vendors found
            </h2>

            <p className="mt-1 text-sm text-[#687086]">
              {vendors.length === 0
                ? "Create your first vendor to start connecting suppliers across FOS."
                : "Try another search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-[#E8EAF0] bg-[#FAFBFC] text-left text-xs font-semibold uppercase tracking-wide text-[#7B8498]">
                  <th className="px-5 py-3">
                    Vendor
                  </th>
                  <th className="px-5 py-3">
                    Code
                  </th>
                  <th className="px-5 py-3">
                    Contact
                  </th>
                  <th className="px-5 py-3">
                    Tax Number
                  </th>
                  <th className="px-5 py-3">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredVendors.map(
                  (vendor) => (
                    <tr
                      key={vendor.id}
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
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F5F7]">
                            <Building2
                              size={19}
                              className="text-[#20243A]"
                            />
                          </div>

                          <div>
                            <p className="font-semibold text-[#20243A]">
                              {vendor.name}
                            </p>

                            <p className="text-xs text-[#7B8498]">
                              Added{" "}
                              {formatDate(
                                vendor.createdAt
                              )}
                            </p>
                          </div>
                        </button>
                      </td>

                      <td className="px-5 py-4 font-mono text-sm text-[#4E566B]">
                        {vendor.vendorCode}
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1 text-sm text-[#687086]">
                          {vendor.email && (
                            <div className="flex items-center gap-2">
                              <Mail
                                size={14}
                              />
                              {vendor.email}
                            </div>
                          )}

                          {vendor.phoneNumber && (
                            <div className="flex items-center gap-2">
                              <Phone
                                size={14}
                              />
                              {vendor.phoneNumber}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 font-mono text-sm text-[#687086]">
                        {vendor.taxNumber ||
                          "—"}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={
                            vendor.status
                          }
                        />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <VendorActions
                          vendor={vendor}
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
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
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
                    {editing.vendorCode}
                  </p>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <FormInput
                  label="Vendor / Business Name"
                  required
                  value={form.name}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      name: value,
                    }))
                  }
                  placeholder="Enter vendor name"
                />

                <FormInput
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      email: value,
                    }))
                  }
                  placeholder="vendor@example.com"
                />

                <FormInput
                  label="Phone Number"
                  value={
                    form.phoneNumber
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      phoneNumber:
                        value,
                    }))
                  }
                  placeholder="+254..."
                />

                <FormInput
                  label="KRA PIN / Tax Number"
                  value={
                    form.taxNumber
                  }
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      taxNumber:
                        value,
                    }))
                  }
                  placeholder="Enter tax number"
                />

                <div className="md:col-span-2">
                  <FormInput
                    label="Business Address"
                    value={
                      form.address
                    }
                    onChange={(value) =>
                      setForm(
                        (current) => ({
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
                  className="rounded-xl border border-[#E8EAF0] px-5 py-2.5 text-sm font-semibold text-[#687086]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={17} />
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

      {selectedVendor && (
        <VendorDetail
          vendor={selectedVendor}
          loading={detailLoading}
          onClose={() =>
            setSelectedVendor(null)
          }
        />
      )}
    </div>
  );
}

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
  onChange: (value: string) => void;
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
        placeholder={placeholder}
        type={type}
        required={required}
        className="w-full rounded-xl border border-[#E8EAF0] px-4 py-3 text-sm outline-none focus:border-[#0D9488]"
      />
    </label>
  );
}

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
  const [open, setOpen] =
    useState(false);

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
        className="rounded-lg p-2 text-[#687086] hover:bg-[#F4F5F7]"
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
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F7F8FA]"
            >
              <Edit3 size={16} />
              Edit Vendor
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onToggle();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F7F8FA]"
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
              <Trash2 size={16} />
              Delete Vendor
            </button>
          </div>
        </>
      )}
    </div>
  );
}

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
        <div className="sticky top-0 z-10 border-b border-[#E8EAF0] bg-white px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3F5F7]">
                <Building2
                  size={22}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#20243A]">
                    {vendor.name}
                  </h2>

                  <StatusBadge
                    status={
                      vendor.status
                    }
                  />
                </div>

                <p className="mt-1 font-mono text-sm text-[#687086]">
                  {vendor.vendorCode}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-[#F5F6F8]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
            />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="grid gap-3 md:grid-cols-3">
              <ActivityCard
                label="Expenses"
                value={counts.expenses}
                icon={
                  <FileText
                    size={18}
                  />
                }
              />

              <ActivityCard
                label="Payables"
                value={counts.payables}
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

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-[#20243A]">
                  Expenses
                </h3>

                <span className="text-xs text-[#687086]">
                  {counts.expenses} records
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#E8EAF0]">
                {vendor.expenses?.length ? (
                  vendor.expenses
                    .slice(0, 8)
                    .map((expense) => (
                      <div
                        key={
                          expense.id
                        }
                        className="flex items-center justify-between border-b border-[#EEF0F4] px-4 py-3 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#20243A]">
                            {expense.expenseCode ||
                              "Expense"}
                          </p>

                          <p className="text-xs text-[#687086]">
                            {formatDate(
                              expense.expenseDate ||
                                expense.createdAt
                            )}
                          </p>
                        </div>

                        <p className="text-sm font-semibold text-[#20243A]">
                          {formatMoney(
                            expense.amount
                          )}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="px-4 py-6 text-sm text-[#687086]">
                    No expenses linked
                    to this vendor.
                  </p>
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-[#20243A]">
                  Accounts Payable
                </h3>

                <span className="text-xs text-[#687086]">
                  {counts.payables} records
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#E8EAF0]">
                {vendor.payables?.length ? (
                  vendor.payables
                    .slice(0, 8)
                    .map((payable) => (
                      <div
                        key={
                          payable.id
                        }
                        className="flex items-center justify-between border-b border-[#EEF0F4] px-4 py-3 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#20243A]">
                            {payable.invoiceNumber ||
                              "Payable"}
                          </p>

                          <p className="text-xs text-[#687086]">
                            {payable.status ||
                              "Recorded"}
                          </p>
                        </div>

                        <p className="text-sm font-semibold text-[#20243A]">
                          {formatMoney(
                            payable.amount
                          )}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="px-4 py-6 text-sm text-[#687086]">
                    No payables linked
                    to this vendor.
                  </p>
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-[#20243A]">
                  Procurement
                </h3>

                <span className="text-xs text-[#687086]">
                  {counts.procurementRequests} records
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#E8EAF0]">
                {vendor.procurementRequests?.length ? (
                  vendor.procurementRequests
                    .slice(0, 8)
                    .map((request) => (
                      <div
                        key={
                          request.id
                        }
                        className="flex items-center justify-between border-b border-[#EEF0F4] px-4 py-3 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#20243A]">
                            {request.requestCode ||
                              "Request"}
                          </p>

                          <p className="text-xs text-[#687086]">
                            {request.item ||
                              "Procurement request"}{" "}
                            ·{" "}
                            {request.status ||
                              "Pending"}
                          </p>
                        </div>

                        <p className="text-sm font-semibold text-[#20243A]">
                          {formatMoney(
                            request.estimatedAmount
                          )}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="px-4 py-6 text-sm text-[#687086]">
                    No procurement requests
                    linked to this vendor.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

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
        {value}
      </p>
    </div>
  );
}

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

      <p className="mt-1 text-sm text-[#20243A]">
        {value}
      </p>
    </div>
  );
}

