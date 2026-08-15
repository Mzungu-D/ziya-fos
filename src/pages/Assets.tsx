import {
  AlertCircle,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { authenticatedFetch } from "../lib/auth-session";

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  value: number | string;
  status: string;
  createdAt: string;
}

interface AssetResponse {
  success: boolean;
  asset?: Asset;
  message?: string;
}

interface AssetsResponse {
  success: boolean;
  assets?: Asset[];
  message?: string;
}

interface AssetForm {
  assetCode: string;
  name: string;
  category: string;
  value: string;
  status: string;
}

const emptyForm: AssetForm = {
  assetCode: "",
  name: "",
  category: "",
  value: "",
  status: "ACTIVE",
};

function formatCurrency(
  value: number | string
): string {
  const amount =
    typeof value === "number"
      ? value
      : Number(
          String(value).replace(
            /,/g,
            ""
          )
        );

  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }
  ).format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
}

function formatDate(
  value: string
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function statusLabel(
  value: string
): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
    );
}

export default function Assets() {
  const [assets, setAssets] =
    useState<Asset[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    editingSaving,
    setEditingSaving,
  ] = useState(false);

  const [
    deletingAssetId,
    setDeletingAssetId,
  ] = useState<string | null>(
    null
  );

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [formError, setFormError] =
    useState("");

  const [
    editError,
    setEditError,
  ] = useState("");

  const [
    actionError,
    setActionError,
  ] = useState("");

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    viewingAsset,
    setViewingAsset,
  ] = useState<Asset | null>(
    null
  );

  const [
    editingAsset,
    setEditingAsset,
  ] = useState<Asset | null>(
    null
  );

  const [form, setForm] =
    useState<AssetForm>(
      emptyForm
    );

  const [
    editForm,
    setEditForm,
  ] = useState<AssetForm>(
    emptyForm
  );

  const loadAssets =
    async () => {
      try {
        setLoading(true);
        setError("");

        const query =
          search.trim()
            ? `?search=${encodeURIComponent(
                search.trim()
              )}`
            : "";

        const response =
          await authenticatedFetch(
            `/api/assets${query}`,
            {
              method: "GET",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as
            | AssetsResponse
            | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to load assets (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to load assets."
          );
        }

        setAssets(
          data.assets ?? []
        );
      } catch (err) {
        setAssets([]);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load assets."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadAssets();
        },
        search.trim()
          ? 300
          : 0
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [search]);

  const totalValue =
    useMemo(
      () =>
        assets.reduce(
          (total, asset) =>
            total +
            Number(asset.value),
          0
        ),
      [assets]
    );

  const assignedCount =
    useMemo(
      () =>
        assets.filter(
          (asset) =>
            asset.status.toUpperCase() ===
            "ASSIGNED"
        ).length,
      [assets]
    );

  const inactiveCount =
    useMemo(
      () =>
        assets.filter(
          (asset) =>
            [
              "INACTIVE",
              "DISPOSED",
            ].includes(
              asset.status.toUpperCase()
            )
        ).length,
      [assets]
    );

  const openAddModal =
    () => {
      setForm(emptyForm);
      setFormError("");
      setShowAddModal(true);
    };

  const closeAddModal =
    () => {
      if (saving) {
        return;
      }

      setShowAddModal(false);
      setForm(emptyForm);
      setFormError("");
    };

  const submitAsset =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setFormError("");

      const value =
        Number(form.value);

      if (
        !form.assetCode.trim() ||
        !form.name.trim() ||
        !form.category.trim()
      ) {
        setFormError(
          "Asset code, name and category are required."
        );
        return;
      }

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        setFormError(
          "Please enter a valid non-negative asset value."
        );
        return;
      }

      try {
        setSaving(true);

        const response =
          await authenticatedFetch(
            "/api/assets",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body: JSON.stringify({
                assetCode:
                  form.assetCode.trim(),
                name:
                  form.name.trim(),
                category:
                  form.category.trim(),
                value,
                status:
                  form.status ||
                  "ACTIVE",
              }),
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as AssetResponse | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to create asset (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to create asset."
          );
        }

        closeAddModal();

        await loadAssets();
      } catch (err) {
        setFormError(
          err instanceof Error
            ? err.message
            : "Failed to create asset."
        );
      } finally {
        setSaving(false);
      }
    };

  const viewAsset =
    async (
      asset: Asset
    ) => {
      try {
        setActionError("");

        const response =
          await authenticatedFetch(
            `/api/assets/${asset.id}`,
            {
              method: "GET",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as AssetResponse | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to load asset (${response.status}).`
          );
        }

        if (
          !data?.success ||
          !data.asset
        ) {
          throw new Error(
            data?.message ||
              "Failed to load asset."
          );
        }

        setViewingAsset(
          data.asset
        );
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : "Failed to load asset."
        );
      }
    };

  const openEditModal =
    (asset: Asset) => {
      setEditError("");

      setEditForm({
        assetCode:
          asset.assetCode,
        name:
          asset.name,
        category:
          asset.category,
        value:
          String(asset.value),
        status:
          asset.status,
      });

      setEditingAsset(
        asset
      );
    };

  const closeEditModal =
    () => {
      if (editingSaving) {
        return;
      }

      setEditingAsset(
        null
      );

      setEditForm(
        emptyForm
      );

      setEditError("");
    };

  const submitEdit =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (!editingAsset) {
        return;
      }

      setEditError("");

      const value =
        Number(
          editForm.value
        );

      if (
        !editForm.name.trim() ||
        !editForm.category.trim()
      ) {
        setEditError(
          "Asset name and category are required."
        );
        return;
      }

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        setEditError(
          "Please enter a valid non-negative asset value."
        );
        return;
      }

      try {
        setEditingSaving(
          true
        );

        const response =
          await authenticatedFetch(
            `/api/assets/${editingAsset.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body: JSON.stringify({
                name:
                  editForm.name.trim(),
                category:
                  editForm.category.trim(),
                value,
                status:
                  editForm.status,
              }),
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as AssetResponse | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to update asset (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to update asset."
          );
        }

        closeEditModal();

        await loadAssets();
      } catch (err) {
        setEditError(
          err instanceof Error
            ? err.message
            : "Failed to update asset."
        );
      } finally {
        setEditingSaving(
          false
        );
      }
    };

  const deleteAsset =
    async (
      asset: Asset
    ) => {
      const confirmed =
        window.confirm(
          `Delete ${asset.name} (${asset.assetCode})? This action cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingAssetId(
          asset.id
        );

        setActionError("");

        const response =
          await authenticatedFetch(
            `/api/assets/${asset.id}`,
            {
              method: "DELETE",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as {
            success?: boolean;
            message?: string;
          } | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to delete asset (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to delete asset."
          );
        }

        setViewingAsset(
          null
        );

        await loadAssets();
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : "Failed to delete asset."
        );
      } finally {
        setDeletingAssetId(
          null
        );
      }
    };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Assets Management
          </h1>

          <p className="mt-2 text-[#666B84]">
            Manage company assets and
            their current status.
          </p>
        </div>

        <button
          type="button"
          onClick={
            openAddModal
          }
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 font-medium text-white transition hover:bg-[#0f766e]"
        >
          <Plus size={18} />
          Add Asset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Total Assets
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : assets.length}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Asset Value
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : formatCurrency(
                  totalValue
                )}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Assigned Assets
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : assignedCount}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Inactive / Disposed
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : inactiveCount}
          </h2>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex items-center rounded-lg px-3">
          <Search
            size={18}
            className="text-[#666B84]"
          />

          <input
            type="text"
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search assets..."
            className="flex-1 bg-transparent px-3 py-3 text-[#20243A] outline-none"
          />

          {loading && (
            <Loader2
              size={18}
              className="animate-spin text-[#666B84]"
            />
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 text-red-600"
            />

            <div>
              <p className="font-semibold text-red-700">
                Unable to load assets
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadAssets()
                }
                className="mt-3 text-sm font-semibold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-700">
            Asset action failed
          </p>

          <p className="mt-1 text-sm text-red-600">
            {actionError}
          </p>
        </div>
      )}

      {!error && (
        <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
          {loading ? (
            <div className="flex min-h-[20rem] items-center justify-center">
              <div className="flex items-center gap-3 text-[#666B84]">
                <Loader2
                  size={22}
                  className="animate-spin"
                />
                Loading assets...
              </div>
            </div>
          ) : assets.length ===
            0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-[#20243A]">
                No assets found
              </p>

              <p className="mt-2 text-sm text-[#666B84]">
                {search.trim()
                  ? "Try a different search."
                  : "Add your first company asset."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead className="bg-[#F8F9FC] text-[#666B84]">
                  <tr>
                    <th className="p-4 text-left">
                      Asset ID
                    </th>

                    <th className="p-4 text-left">
                      Asset
                    </th>

                    <th className="p-4 text-left">
                      Category
                    </th>

                    <th className="p-4 text-right">
                      Value
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
                  {assets.map(
                    (asset) => (
                      <tr
                        key={
                          asset.id
                        }
                        className="border-t border-[#ECECF3] hover:bg-[#FAFBFD]"
                      >
                        <td className="p-4 font-medium text-[#20243A]">
                          {
                            asset.assetCode
                          }
                        </td>

                        <td className="p-4 text-[#20243A]">
                          {
                            asset.name
                          }
                        </td>

                        <td className="p-4 text-[#666B84]">
                          {
                            asset.category
                          }
                        </td>

                        <td className="p-4 text-right font-medium text-[#20243A]">
                          {formatCurrency(
                            asset.value
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`rounded-full px-3 py-1 text-sm ${
                              asset.status.toUpperCase() ===
                              "ACTIVE"
                                ? "bg-green-100 text-green-700"
                                : asset.status.toUpperCase() ===
                                  "ASSIGNED"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {statusLabel(
                              asset.status
                            )}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void viewAsset(
                                  asset
                                )
                              }
                              className="rounded-lg border border-[#DCDDEA] p-2 text-[#20243A] hover:bg-[#F8F9FC]"
                              title="View asset"
                            >
                              <Eye
                                size={16}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  asset
                                )
                              }
                              className="rounded-lg border border-[#DCDDEA] p-2 text-[#20243A] hover:bg-[#F8F9FC]"
                              title="Edit asset"
                            >
                              <Pencil
                                size={16}
                              />
                            </button>

                            <button
                              type="button"
                              disabled={
                                deletingAssetId ===
                                asset.id
                              }
                              onClick={() =>
                                void deleteAsset(
                                  asset
                                )
                              }
                              className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Delete asset"
                            >
                              {deletingAssetId ===
                              asset.id ? (
                                <Loader2
                                  size={16}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2
                                  size={16}
                                />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Add Asset
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Add a new company asset.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeAddModal
                }
                disabled={saving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                submitAsset
              }
              className="space-y-5 p-6"
            >
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Asset Code *
                  </span>

                  <input
                    value={
                      form.assetCode
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        assetCode:
                          event.target.value,
                      })
                    }
                    placeholder="AST-001"
                    required
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Asset Name *
                  </span>

                  <input
                    value={
                      form.name
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        name:
                          event.target.value,
                      })
                    }
                    placeholder="HP EliteBook X"
                    required
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Category *
                  </span>

                  <input
                    value={
                      form.category
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        category:
                          event.target.value,
                      })
                    }
                    placeholder="Laptop"
                    required
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Value *
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.value
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        value:
                          event.target.value,
                      })
                    }
                    placeholder="280000"
                    required
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Status
                  </span>

                  <select
                    value={
                      form.status
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        status:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  >
                    <option value="ACTIVE">
                      Active
                    </option>

                    <option value="ASSIGNED">
                      Assigned
                    </option>

                    <option value="INACTIVE">
                      Inactive
                    </option>

                    <option value="DISPOSED">
                      Disposed
                    </option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={
                    closeAddModal
                  }
                  disabled={saving}
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : "Add Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Asset Details
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Complete asset information.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setViewingAsset(
                    null
                  )
                }
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-xl bg-[#F8F9FC] p-5">
                <p className="text-sm text-[#666B84]">
                  Asset
                </p>

                <h3 className="mt-1 text-2xl font-bold text-[#20243A]">
                  {
                    viewingAsset.name
                  }
                </h3>

                <p className="mt-1 text-sm text-[#666B84]">
                  {
                    viewingAsset.assetCode
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Category
                  </p>

                  <p className="mt-1 font-medium text-[#20243A]">
                    {
                      viewingAsset.category
                    }
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Value
                  </p>

                  <p className="mt-1 font-semibold text-[#20243A]">
                    {formatCurrency(
                      viewingAsset.value
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Status
                  </p>

                  <p className="mt-1 font-medium text-[#20243A]">
                    {statusLabel(
                      viewingAsset.status
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Created
                  </p>

                  <p className="mt-1 font-medium text-[#20243A]">
                    {formatDate(
                      viewingAsset.createdAt
                    )}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={() => {
                    const asset =
                      assets.find(
                        (item) =>
                          item.id ===
                          viewingAsset.id
                      );

                    setViewingAsset(
                      null
                    );

                    if (asset) {
                      openEditModal(
                        asset
                      );
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A]"
                >
                  <Pencil
                    size={17}
                  />
                  Edit
                </button>

                <button
                  type="button"
                  disabled={
                    deletingAssetId ===
                    viewingAsset.id
                  }
                  onClick={() =>
                    void deleteAsset(
                      viewingAsset
                    )
                  }
                  className="flex items-center gap-2 rounded-lg border border-red-200 px-5 py-2.5 font-medium text-red-600"
                >
                  {deletingAssetId ===
                  viewingAsset.id ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Trash2
                      size={17}
                    />
                  )}

                  Delete
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setViewingAsset(
                      null
                    )
                  }
                  className="rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Edit Asset
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Update asset information.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeEditModal
                }
                disabled={
                  editingSaving
                }
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                submitEdit
              }
              className="space-y-5 p-6"
            >
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#20243A]">
                  Asset Code
                </span>

                <input
                  value={
                    editForm.assetCode
                  }
                  readOnly
                  className="w-full cursor-not-allowed rounded-lg border border-[#DCDDEA] bg-[#F8F9FC] px-3 py-2.5 text-[#666B84]"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Asset Name *
                  </span>

                  <input
                    value={
                      editForm.name
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        name:
                          event.target.value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Category *
                  </span>

                  <input
                    value={
                      editForm.category
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        category:
                          event.target.value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Value *
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      editForm.value
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        value:
                          event.target.value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Status
                  </span>

                  <select
                    value={
                      editForm.status
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        status:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 outline-none focus:border-[#0D9488]"
                  >
                    <option value="ACTIVE">
                      Active
                    </option>

                    <option value="ASSIGNED">
                      Assigned
                    </option>

                    <option value="INACTIVE">
                      Inactive
                    </option>

                    <option value="DISPOSED">
                      Disposed
                    </option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={
                    closeEditModal
                  }
                  disabled={
                    editingSaving
                  }
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    editingSaving
                  }
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white disabled:opacity-60"
                >
                  {editingSaving && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {editingSaving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}