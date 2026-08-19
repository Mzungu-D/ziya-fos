import {
  Plus,
  Target,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { authenticatedFetch } from "../lib/auth-session";

type Budget = {
  id: string;
  department: string;
  amount: number;
  year: number;
  createdAt: string;
  organizationId: string;
};

type BudgetApiResponse = {
  success: boolean;
  data?: Budget[];
  totals?: {
    budget: number;
    count: number;
  };
  message?: string;
};

type BudgetReportResponse = {
  success: boolean;
  data?: Array<{
    department: string;
    year: number;
    budget: number;
  }>;
  totals?: {
    budget: number;
    actual: number;
    variance: number;
    utilizationPercentage?: number;
  };
  message?: string;
};

type BudgetForm = {
  department: string;
  amount: string;
  year: string;
};

function formatCurrency(value: number) {
  return `KES ${value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatShortCurrency(value: number) {
  return `KES ${value.toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

const initialForm: BudgetForm = {
  department: "",
  amount: "",
  year: String(getCurrentYear()),
};

export default function BudgetForecasting() {
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const [totalBudget, setTotalBudget] =
    useState(0);

  const [actualSpend, setActualSpend] =
    useState(0);

  const [variance, setVariance] =
    useState(0);

  const [utilization, setUtilization] =
    useState(0);

  const [year, setYear] = useState(
    getCurrentYear()
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showBudgetForm, setShowBudgetForm] =
    useState(false);

  const [editingBudget, setEditingBudget] =
    useState<Budget | null>(null);

  const [form, setForm] =
    useState<BudgetForm>(initialForm);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const loadBudgetData = useCallback(
    async (showRefreshState = false) => {
      try {
        if (showRefreshState) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const [
          budgetsResponse,
          reportResponse,
        ] = await Promise.all([
          authenticatedFetch(
            `/api/budgets?year=${year}`,
            {
              credentials: "include",
            }
          ),

          authenticatedFetch(
            `/api/financial-reports/budget-vs-actual?year=${year}`,
            {
              credentials: "include",
            }
          ),
        ]);

        const budgetsData =
          (await budgetsResponse.json()) as BudgetApiResponse;

        const reportData =
          (await reportResponse.json()) as BudgetReportResponse;

        if (!budgetsResponse.ok || !budgetsData.success) {
          throw new Error(
            budgetsData.message ||
              "Unable to load budgets."
          );
        }

        if (!reportResponse.ok || !reportData.success) {
          throw new Error(
            reportData.message ||
              "Unable to load budget performance."
          );
        }

        setBudgets(
          budgetsData.data || []
        );

        setTotalBudget(
          Number(
            reportData.totals?.budget ??
              budgetsData.totals?.budget ??
              0
          )
        );

        setActualSpend(
          Number(
            reportData.totals?.actual ?? 0
          )
        );

        setVariance(
          Number(
            reportData.totals?.variance ?? 0
          )
        );

        setUtilization(
          Number(
            reportData.totals
              ?.utilizationPercentage ?? 0
          )
        );
      } catch (err) {
        console.error(
          "[BUDGET UI] Failed to load budget data:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load budget information."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [year]
  );

  useEffect(() => {
    void loadBudgetData();
  }, [loadBudgetData]);

  const yearOptions = useMemo(() => {
    const currentYear = getCurrentYear();

    return Array.from(
      { length: 6 },
      (_, index) =>
        currentYear - 2 + index
    );
  }, []);

  const openCreateForm = () => {
    setEditingBudget(null);

    setForm({
      department: "",
      amount: "",
      year: String(year),
    });

    setShowBudgetForm(true);
  };

  const openEditForm = (budget: Budget) => {
    setEditingBudget(budget);

    setForm({
      department: budget.department,
      amount: String(budget.amount),
      year: String(budget.year),
    });

    setShowBudgetForm(true);
  };

  const closeBudgetForm = () => {
    if (saving) {
      return;
    }

    setShowBudgetForm(false);
    setEditingBudget(null);
    setForm({
      department: "",
      amount: "",
      year: String(year),
    });
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const department =
      form.department.trim();

    const amount = Number(form.amount);

    const budgetYear = Number(form.year);

    if (!department) {
      setError("Department is required.");
      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setError(
        "Enter a valid budget amount."
      );
      return;
    }

    if (
      !Number.isInteger(budgetYear) ||
      budgetYear < 2000 ||
      budgetYear > 2100
    ) {
      setError(
        "Enter a valid budget year."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const isEditing =
        editingBudget !== null;

      const endpoint = isEditing
        ? `/api/budgets/${editingBudget.id}`
        : "/api/budgets";

      const response =
        await authenticatedFetch(
          endpoint,
          {
            method: isEditing
              ? "PUT"
              : "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              department,
              amount,
              year: budgetYear,
            }),
          }
        );

      const data =
        (await response.json()) as {
          success: boolean;
          data?: Budget;
          message?: string;
        };

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            (isEditing
              ? "Failed to update budget."
              : "Failed to create budget.")
        );
      }

      setShowBudgetForm(false);
      setEditingBudget(null);

      setForm({
        department: "",
        amount: "",
        year: String(year),
      });

      await loadBudgetData(true);
    } catch (err) {
      console.error(
        "[BUDGET UI] Failed to save budget:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save budget."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (
    budget: Budget
  ) => {
    const confirmed =
      window.confirm(
        `Delete the ${budget.department} budget for ${budget.year}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(budget.id);
      setError("");

      const response =
        await authenticatedFetch(
          `/api/budgets/${budget.id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

      const data =
        (await response.json()) as {
          success: boolean;
          message?: string;
        };

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to delete budget."
        );
      }

      await loadBudgetData(true);
    } catch (err) {
      console.error(
        "[BUDGET UI] Failed to delete budget:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete budget."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const hasBudgets =
    budgets.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Budgeting & Forecasting
          </h1>

          <p className="text-[#666B84] mt-2">
            Manage budgets, forecasts and
            financial planning.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(event) =>
              setYear(
                Number(event.target.value)
              )
            }
            className="rounded-lg border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] outline-none focus:border-[#0D9488]"
            aria-label="Budget year"
          >
            {yearOptions.map(
              (optionYear) => (
                <option
                  key={optionYear}
                  value={optionYear}
                >
                  {optionYear}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            onClick={() =>
              void loadBudgetData(true)
            }
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-[#ECECF3] bg-white px-4 py-3 text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-60"
          >
            <RefreshCw
              size={18}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-3 text-white hover:bg-[#0B7F74]"
          >
            <Plus size={18} />
            New Budget
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle
            size={22}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-semibold">
              Budgeting Error
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Total Budget
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "Loading..."
              : formatShortCurrency(
                  totalBudget
                )}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Actual Spend
          </p>

          <h2 className="mt-2 text-3xl font-bold text-yellow-500">
            {loading
              ? "Loading..."
              : formatShortCurrency(
                  actualSpend
                )}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Budget Utilization
          </p>

          <h2 className="mt-2 text-3xl font-bold text-green-500">
            {loading
              ? "Loading..."
              : `${utilization.toFixed(1)}%`}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Variance
          </p>

          <h2
            className={`mt-2 text-3xl font-bold ${
              variance >= 0
                ? "text-[#20243A]"
                : "text-red-600"
            }`}
          >
            {loading
              ? "Loading..."
              : formatShortCurrency(
                  variance
                )}
          </h2>

          {!loading && (
            <p
              className={`mt-2 text-sm ${
                variance >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {variance >= 0
                ? "Favorable"
                : "Unfavorable"}
            </p>
          )}
        </div>
      </div>

      {/* Budget Table */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#20243A]">
              Budgets
            </h2>

            <p className="mt-1 text-sm text-[#666B84]">
              {year} budget allocations for
              your organization.
            </p>
          </div>

          <span className="rounded-full bg-[#F3F4F8] px-3 py-1 text-sm text-[#666B84]">
            {budgets.length}{" "}
            {budgets.length === 1
              ? "budget"
              : "budgets"}
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-[#666B84]">
            Loading budgets...
          </div>
        ) : !hasBudgets ? (
          <div className="p-10 text-center">
            <p className="font-medium text-[#20243A]">
              No budgets configured
            </p>

            <p className="mt-2 text-sm text-[#666B84]">
              Create your first budget for{" "}
              {year}.
            </p>

            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B7F74]"
            >
              Create Budget
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#FAFAFC] text-[#666B84]">
                <tr>
                  <th className="p-4 text-left font-semibold">
                    Department
                  </th>

                  <th className="p-4 text-right font-semibold">
                    Budget
                  </th>

                  <th className="p-4 text-right font-semibold">
                    Year
                  </th>

                  <th className="p-4 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {budgets.map(
                  (budget) => (
                    <tr
                      key={budget.id}
                      className="border-t border-[#ECECF3]"
                    >
                      <td className="p-4 font-medium text-[#20243A]">
                        {budget.department}
                      </td>

                      <td className="p-4 text-right text-[#20243A]">
                        {formatCurrency(
                          Number(
                            budget.amount
                          )
                        )}
                      </td>

                      <td className="p-4 text-right text-[#666B84]">
                        {budget.year}
                      </td>

                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(
                                budget
                              )
                            }
                            className="rounded-lg p-2 text-[#666B84] hover:bg-[#F3F4F8] hover:text-[#20243A]"
                            aria-label={`Edit ${budget.department} budget`}
                          >
                            <Pencil
                              size={17}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(
                                budget
                              )
                            }
                            disabled={
                              deletingId ===
                              budget.id
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                            aria-label={`Delete ${budget.department} budget`}
                          >
                            <Trash2
                              size={17}
                            />
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

      {/* Forecast */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
        <div className="mb-4 flex items-center gap-4">
          <Target
            className="text-[#20243A]"
            size={28}
          />

          <div>
            <h2 className="text-xl font-bold text-[#20243A]">
              AI Forecast
            </h2>

            <p className="text-sm text-[#666B84]">
              Forecasting engine
            </p>
          </div>
        </div>

        <p className="text-[#666B84]">
          AI expenditure forecasting will
          appear here once sufficient
          historical financial data is
          available for model training.
        </p>

        <div className="mt-5 rounded-xl bg-[#F8F9FC] p-5">
          <p className="text-sm font-medium text-[#20243A]">
            Forecast status
          </p>

          <p className="mt-1 text-sm text-[#666B84]">
            No forecast has been generated
            yet. No estimated figure is
            displayed until it is calculated
            from real financial data.
          </p>
        </div>
      </div>

      {/* Budget Modal */}
      {showBudgetForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  {editingBudget
                    ? "Edit Budget"
                    : "New Budget"}
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Configure a budget for
                  your organization.
                </p>
              </div>

              <button
                type="button"
                onClick={closeBudgetForm}
                disabled={saving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F3F4F8]"
                aria-label="Close budget form"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                  Department
                </label>

                <input
                  type="text"
                  value={form.department}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      department:
                        event.target.value,
                    }))
                  }
                  placeholder="e.g. Finance"
                  className="w-full rounded-lg border border-[#D9DBE5] px-4 py-3 text-[#20243A] outline-none focus:border-[#0D9488]"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                  Budget Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount:
                        event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[#D9DBE5] px-4 py-3 text-[#20243A] outline-none focus:border-[#0D9488]"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#20243A]">
                  Year
                </label>

                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={form.year}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      year: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#D9DBE5] px-4 py-3 text-[#20243A] outline-none focus:border-[#0D9488]"
                  disabled={saving}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={closeBudgetForm}
                  disabled={saving}
                  className="rounded-lg border border-[#D9DBE5] px-5 py-3 text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#0D9488] px-5 py-3 font-medium text-white hover:bg-[#0B7F74] disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingBudget
                    ? "Save Changes"
                    : "Create Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}