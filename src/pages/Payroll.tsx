import {
  AlertCircle,
  CalendarDays,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { authenticatedFetch } from "../lib/auth-session";

interface PayrollEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  name: string;
  department?: string | null;
}

interface PayrollRecord {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  employee: PayrollEmployee | null;
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  status: string;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PayrollPeriod {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  payrollRecords?: PayrollRecord[];
}

interface PayrollResponse {
  success: boolean;
  summary?: {
    employees: number;
    grossPayroll: number;
    deductions: number;
    netPayroll: number;
  };
  periods?: PayrollPeriod[];
  message?: string;
}

interface RunPayrollForm {
  name: string;
  periodStart: string;
  periodEnd: string;
}

const emptyForm: RunPayrollForm = {
  name: "",
  periodStart: "",
  periodEnd: "",
};

function formatCurrency(
  value: number | string
): string {
  const amount =
    typeof value === "number"
      ? value
      : Number(
          String(value).replace(/,/g, "")
        );

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(
    Number.isFinite(amount) ? amount : 0
  );
}

function formatDate(value: string): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCurrentMonthDates() {
  const now = new Date();

  const first = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const last = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  );

  const toInputDate = (date: Date) =>
    `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;

  return {
    start: toInputDate(first),
    end: toInputDate(last),
  };
}

export default function Payroll() {
  const [periods, setPeriods] = useState<
    PayrollPeriod[]
  >([]);

  const [summary, setSummary] = useState({
    employees: 0,
    grossPayroll: 0,
    deductions: 0,
    netPayroll: 0,
  });

  const [loading, setLoading] =
    useState(true);

  const [processing, setProcessing] =
    useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [selectedPeriodId, setSelectedPeriodId] =
    useState<string | null>(null);

  const [showRunModal, setShowRunModal] =
    useState(false);

  const [form, setForm] =
    useState<RunPayrollForm>(emptyForm);

  const [formError, setFormError] =
    useState("");

  const loadPayroll = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await authenticatedFetch(
          "/api/payroll",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

      const data =
        (await response
          .json()
          .catch(() => null)) as
          | PayrollResponse
          | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to load payroll (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to load payroll."
        );
      }

      const loadedPeriods =
        data.periods ?? [];

      setPeriods(loadedPeriods);

      setSummary({
        employees:
          data.summary?.employees ?? 0,
        grossPayroll:
          data.summary?.grossPayroll ?? 0,
        deductions:
          data.summary?.deductions ?? 0,
        netPayroll:
          data.summary?.netPayroll ?? 0,
      });

      if (
        selectedPeriodId &&
        loadedPeriods.some(
          (period) =>
            period.id === selectedPeriodId
        )
      ) {
        return;
      }

      setSelectedPeriodId(
        loadedPeriods[0]?.id ?? null
      );
    } catch (err) {
      setPeriods([]);

      setSummary({
        employees: 0,
        grossPayroll: 0,
        deductions: 0,
        netPayroll: 0,
      });

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payroll."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayroll();
  }, []);

  const selectedPeriod = useMemo(
    () =>
      periods.find(
        (period) =>
          period.id === selectedPeriodId
      ) ??
      periods[0] ??
      null,
    [periods, selectedPeriodId]
  );

  const records = useMemo(() => {
    const source =
      selectedPeriod?.payrollRecords ?? [];

    const term = search
      .trim()
      .toLowerCase();

    if (!term) {
      return source;
    }

    return source.filter((record) => {
      const employee =
        record.employee;

      if (!employee) return false;

      return [
        employee.name,
        employee.employeeNumber,
        employee.department ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [selectedPeriod, search]);

  const openRunPayroll = () => {
    const dates =
      getCurrentMonthDates();

    setForm({
      name: "",
      periodStart: dates.start,
      periodEnd: dates.end,
    });

    setFormError("");
    setSuccess("");
    setShowRunModal(true);
  };

  const closeRunPayroll = () => {
    if (processing) return;

    setShowRunModal(false);
    setForm(emptyForm);
    setFormError("");
  };

  const submitPayroll = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setFormError("");
    setSuccess("");

    if (
      !form.name.trim() ||
      !form.periodStart ||
      !form.periodEnd
    ) {
      setFormError(
        "Payroll name, start date and end date are required."
      );
      return;
    }

    const start = new Date(
      `${form.periodStart}T00:00:00`
    );

    const end = new Date(
      `${form.periodEnd}T23:59:59`
    );

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      setFormError(
        "Please provide valid payroll dates."
      );
      return;
    }

    if (end < start) {
      setFormError(
        "Payroll end date cannot be before the start date."
      );
      return;
    }

    try {
      setProcessing(true);

      const response =
        await authenticatedFetch(
          "/api/payroll/run",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              name: form.name.trim(),
              periodStart:
                start.toISOString(),
              periodEnd:
                end.toISOString(),
              allowances: {},
              deductions: {},
            }),
          }
        );

      const data =
        (await response
          .json()
          .catch(() => null)) as
          | {
              success?: boolean;
              message?: string;
              period?: PayrollPeriod;
            }
          | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to process payroll (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to process payroll."
        );
      }

      setSuccess(
        data.message ||
          "Payroll processed successfully."
      );

      setShowRunModal(false);
      setForm(emptyForm);

      await loadPayroll();

      if (data.period?.id) {
        setSelectedPeriodId(
          data.period.id
        );
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to process payroll."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Payroll
          </h1>

          <p className="mt-2 text-[#666B84]">
            Manage salaries, deductions and payroll processing.
          </p>
        </div>

        <button
          type="button"
          onClick={openRunPayroll}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 font-medium text-white transition hover:bg-[#0f766e]"
        >
          <Plus size={18} />
          Run Payroll
        </button>
      </div>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Employees
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : summary.employees}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Gross Payroll
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : formatCurrency(
                  summary.grossPayroll
                )}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Deductions
          </p>

          <h2 className="mt-2 text-3xl font-bold text-yellow-600">
            {loading
              ? "—"
              : formatCurrency(
                  summary.deductions
                )}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Net Payroll
          </p>

          <h2 className="mt-2 text-3xl font-bold text-green-600">
            {loading
              ? "—"
              : formatCurrency(
                  summary.netPayroll
                )}
          </h2>
        </div>
      </div>

      {!loading && periods.length > 0 && (
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays
              size={18}
              className="text-[#666B84]"
            />

            <span className="text-sm font-medium text-[#666B84]">
              Payroll Period
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() =>
                  setSelectedPeriodId(
                    period.id
                  )
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  selectedPeriod?.id ===
                  period.id
                    ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                    : "border-[#ECECF3] text-[#666B84] hover:border-[#0D9488]"
                }`}
              >
                {period.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex items-center rounded-lg px-3">
          <Search
            size={18}
            className="text-[#666B84]"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search employees..."
            className="flex-1 bg-transparent px-3 py-3 text-[#20243A] outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>
              <p className="font-semibold text-red-700">
                Unable to load payroll
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadPayroll()
                }
                className="mt-3 text-sm font-semibold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {!error && (
        <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
          {loading ? (
            <div className="flex min-h-[20rem] items-center justify-center text-[#666B84]">
              <div className="flex items-center gap-3">
                <Loader2
                  size={22}
                  className="animate-spin"
                />
                Loading payroll...
              </div>
            </div>
          ) : !selectedPeriod ? (
            <div className="p-12 text-center">
              <CalendarDays
                size={40}
                className="mx-auto text-[#666B84]"
              />

              <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
                No payroll has been processed
              </h2>

              <p className="mt-2 text-sm text-[#666B84]">
                Run your first payroll to populate this table.
              </p>

              <button
                type="button"
                onClick={openRunPayroll}
                className="mt-5 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e]"
              >
                Run Payroll
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center">
              <Search
                size={40}
                className="mx-auto text-[#666B84]"
              />

              <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
                No payroll records found
              </h2>

              <p className="mt-2 text-sm text-[#666B84]">
                {search.trim()
                  ? "Try a different search."
                  : "This payroll period has no records."}
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-[#ECECF3] px-6 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-semibold text-[#20243A]">
                      {selectedPeriod.name}
                    </h2>

                    <p className="mt-1 text-sm text-[#666B84]">
                      {formatDate(
                        selectedPeriod.periodStart
                      )}{" "}
                      —{" "}
                      {formatDate(
                        selectedPeriod.periodEnd
                      )}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-sm ${
                      selectedPeriod.status ===
                      "PROCESSED"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {statusLabel(
                      selectedPeriod.status
                    )}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-[#F8F9FC] text-[#666B84]">
                    <tr>
                      <th className="p-4 text-left font-medium">
                        Employee
                      </th>

                      <th className="p-4 text-left font-medium">
                        Department
                      </th>

                      <th className="p-4 text-right font-medium">
                        Basic
                      </th>

                      <th className="p-4 text-right font-medium">
                        Allowances
                      </th>

                      <th className="p-4 text-right font-medium">
                        Gross
                      </th>

                      <th className="p-4 text-right font-medium">
                        Deductions
                      </th>

                      <th className="p-4 text-right font-medium">
                        Net
                      </th>

                      <th className="p-4 text-left font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {records.map((record) => (
                      <tr
                        key={record.id}
                        className="border-t border-[#ECECF3] hover:bg-[#FAFBFD]"
                      >
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-[#20243A]">
                              {record.employee
                                ?.name ||
                                "Unknown employee"}
                            </p>

                            <p className="mt-1 text-xs text-[#888DA3]">
                              {record.employee
                                ?.employeeNumber ||
                                "—"}
                            </p>
                          </div>
                        </td>

                        <td className="p-4 text-[#666B84]">
                          {record.employee
                            ?.department ||
                            "—"}
                        </td>

                        <td className="p-4 text-right text-[#20243A]">
                          {formatCurrency(
                            record.basicSalary
                          )}
                        </td>

                        <td className="p-4 text-right text-[#20243A]">
                          {formatCurrency(
                            record.allowances
                          )}
                        </td>

                        <td className="p-4 text-right font-medium text-[#20243A]">
                          {formatCurrency(
                            record.grossSalary
                          )}
                        </td>

                        <td className="p-4 text-right text-red-600">
                          {formatCurrency(
                            record.deductions
                          )}
                        </td>

                        <td className="p-4 text-right font-semibold text-green-600">
                          {formatCurrency(
                            record.netSalary
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`rounded-full px-3 py-1 text-sm ${
                              record.status ===
                              "PROCESSED"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {statusLabel(
                              record.status
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-[#ECECF3] bg-[#F8F9FC] p-6 md:grid-cols-3">
                <div>
                  <p className="text-sm text-[#666B84]">
                    Period Gross
                  </p>

                  <p className="mt-1 text-lg font-semibold text-[#20243A]">
                    {formatCurrency(
                      selectedPeriod.totalGross
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-[#666B84]">
                    Period Deductions
                  </p>

                  <p className="mt-1 text-lg font-semibold text-red-600">
                    {formatCurrency(
                      selectedPeriod.totalDeductions
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-[#666B84]">
                    Period Net
                  </p>

                  <p className="mt-1 text-lg font-semibold text-green-600">
                    {formatCurrency(
                      selectedPeriod.totalNet
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Run Payroll
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Process payroll for all active employees.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRunPayroll}
                disabled={processing}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={submitPayroll}
              className="space-y-5 p-6"
            >
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#20243A]">
                  Payroll Period Name *
                </span>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="e.g. August 2026 Payroll"
                  className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  required
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Start Date *
                  </span>

                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        periodStart:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    End Date *
                  </span>

                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        periodEnd:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>
              </div>

              <div className="rounded-xl bg-[#F8F9FC] p-4 text-sm text-[#666B84]">
                Payroll will be calculated from the current basic salary of
                every active employee. Allowances and deductions are
                currently initialized to zero and can be extended through
                the payroll workflow later.
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={closeRunPayroll}
                  disabled={processing}
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={processing}
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processing && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {processing
                    ? "Processing..."
                    : "Process Payroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}