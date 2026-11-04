import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileText,
  Layers3,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  FormEvent,
  ReactNode,
} from "react";
import { authenticatedFetch } from "../lib/auth-session";

/* =========================================================
   TYPES
========================================================= */

type Tab =
  | "overview"
  | "regimes"
  | "codes"
  | "rates"
  | "rules"
  | "mappings"
  | "periods"
  | "transactions"
  | "returns"
  | "filings"
  | "payments";

type TaxRegime = {
  id: string;
  code: string;
  name: string;
  taxType: string;
  countryCode: string;
  currency: string;
  registrationNumber?: string | null;
  description?: string | null;
  isActive: boolean;
};

type TaxCode = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  taxRegimeId: string;
  direction: string;
  treatment: string;
  calculationMethod: string;
  defaultRate: string | number;
  isInclusive: boolean;
  isRecoverable: boolean;
  recoverabilityRate: string | number;
  isWithholding: boolean;
  isReverseCharge: boolean;
  isExempt: boolean;
  isZeroRated: boolean;
  isActive: boolean;
  taxRegime?: TaxRegime | null;
};

type TaxRate = {
  id: string;
  name: string;
  taxCodeId: string;
  rate: string | number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  roundingScale: number;
  roundingMode: string;
  isActive: boolean;
  taxCode?: TaxCode | null;
};

type TaxRule = {
  id: string;
  code: string;
  name: string;
  taxRegimeId: string;
  taxCodeId?: string | null;
  priority: number;
  transactionType?: string | null;
  customerType?: string | null;
  vendorType?: string | null;
  supplyType?: string | null;
  jurisdiction?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  conditions?: unknown;
  actions?: unknown;
  isActive: boolean;
  taxRegime?: TaxRegime | null;
  taxCode?: TaxCode | null;
};

type Account = {
  id: string;
  code: string;
  name: string;
  type?: string | null;
};

type TaxMapping = {
  id: string;
  taxCodeId: string;
  accountId: string;
  mappingType: string;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  taxCode?: TaxCode | null;
  account?: Account | null;
};

type TaxPeriod = {
  id: string;
  taxRegimeId: string;
  code: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  filingDueDate?: string | null;
  status: string;
  currency: string;
  closedAt?: string | null;
  taxRegime?: TaxRegime | null;
};

type TaxReturn = {
  id: string;
  taxRegimeId: string;
  taxPeriodId: string;
  returnType: string;
  status: string;
  taxableAmount: string | number;
  outputTax: string | number;
  inputTax: string | number;
  withholdingTax: string | number;
  adjustments: string | number;
  penalties: string | number;
  interest: string | number;
  netTaxPayable: string | number;
  filingReference?: string | null;
  filedAt?: string | null;
  preparedBy?: string | null;
  reviewedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
  taxRegime?: TaxRegime | null;
  taxPeriod?: TaxPeriod | null;
};

type TaxTransaction = {
  id: string;
  taxCodeId: string;
  taxPeriodId?: string | null;
  sourceType: string;
  sourceId: string;
  sourceLineId?: string | null;
  transactionDate: string;
  postingDate?: string | null;
  currency: string;
  taxableAmount: string | number;
  taxAmount: string | number;
  recoverableAmount: string | number;
  nonRecoverableAmount: string | number;
  taxBaseAmount?: string | number;
  direction: string;
  rateApplied: string | number;
  calculationMethod?: string | null;
  isInclusive?: boolean;
  isReverseCharge?: boolean;
  status: string;
  taxCode?: TaxCode | null;
  taxPeriod?: TaxPeriod | null;
};

type TaxPayment = {
  id: string;
  paymentReference?: string | null;
  paymentDate: string;
  amount: string | number;
  paymentMethod: string;
  status: string;
};

type TaxFiling = {
  id: string;
  taxObligationCode: string;
  taxPeriodStart: string;
  taxPeriodEnd: string;
  dueDate: string;
  taxableAmount: string | number;
  taxAmount: string | number;
  adjustments: string | number;
  penalties: string | number;
  interest: string | number;
  totalPayable: string | number;
  filingReference?: string | null;
  filingDate?: string | null;
  filingStatus: string;
  paymentStatus: string;
  notes?: string | null;
  taxPeriodId?: string | null;
  taxReturnId?: string | null;
  obligation?: {
    name: string;
    taxType: string;
    currency: string;
  } | null;
  payments: TaxPayment[];
};

type TaxData = {
  regimes: TaxRegime[];
  codes: TaxCode[];
  rates: TaxRate[];
  rules: TaxRule[];
  mappings: TaxMapping[];
  periods: TaxPeriod[];
  transactions: TaxTransaction[];
  returns: TaxReturn[];
  accounts: Account[];
};

type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  code?: string;
  data?: T;
  filings?: TaxFiling[];
  payments?: TaxPayment[];
  pagination?: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
};

const EMPTY_DATA: TaxData = {
  regimes: [],
  codes: [],
  rates: [],
  rules: [],
  mappings: [],
  periods: [],
  transactions: [],
  returns: [],
  accounts: [],
};

const PAGE_SIZE = 10;

/* =========================================================
   HELPERS
========================================================= */

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(
  value: unknown,
  code = "KES",
): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: code || "KES",
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function dateText(
  value?: string | null,
): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(
  value: string,
): string {
  const status = value
    .toUpperCase()
    .replaceAll(" ", "_");

  if (
    [
      "ACTIVE",
      "OPEN",
      "PAID",
      "COMPLETED",
      "SUBMITTED",
      "APPROVED",
      "READY_TO_FILE",
    ].includes(status)
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    [
      "OVERDUE",
      "FAILED",
      "REJECTED",
      "CANCELLED",
    ].includes(status)
  ) {
    return "bg-red-50 text-red-700";
  }

  if (
    [
      "CLOSED",
      "PARTIALLY_PAID",
      "UNDER_REVIEW",
    ].includes(status)
  ) {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-amber-50 text-amber-700";
}

function prettyStatus(
  value: string,
): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function isValidNumber(
  value: string,
): boolean {
  const number = Number(value);
  return Number.isFinite(number);
}

/* =========================================================
   UI COMPONENTS
========================================================= */

function Badge({
  value,
}: {
  value: string;
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
        value,
      )}`}
    >
      {prettyStatus(value)}
    </span>
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E7E9F0] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#ECECF3] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-[#20243A]">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-[#666B84]">
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function EmptyState({
  label,
}: {
  label: string;
}) {
  return (
    <div className="p-10 text-center">
      <FileText
        size={34}
        className="mx-auto text-[#A2A6B7]"
      />

      <p className="mt-3 font-medium text-[#20243A]">
        {label}
      </p>

      <p className="mt-1 text-sm text-[#666B84]">
        No records are currently available.
      </p>
    </div>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE),
  );

  if (total <= PAGE_SIZE) {
    return null;
  }

  const pages = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  );

  const visible =
    totalPages <= 7
      ? pages
      : Array.from(
          new Set([
            1,
            Math.max(1, page - 1),
            page,
            Math.min(
              totalPages,
              page + 1,
            ),
            totalPages,
          ]),
        );

  return (
    <div className="flex flex-col gap-3 border-t border-[#ECECF3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[#666B84]">
        Page{" "}
        <span className="font-semibold text-[#20243A]">
          {page}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-[#20243A]">
          {totalPages}
        </span>
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() =>
            onChange(
              Math.max(1, page - 1),
            )
          }
          className="rounded-lg border border-[#DCDCE5] px-3 py-1.5 text-xs font-semibold text-[#4F556B] disabled:opacity-40"
        >
          Previous
        </button>

        {visible.map(
          (pageNumber, index) => {
            const previous =
              visible[index - 1];

            const gap =
              previous !== undefined &&
              pageNumber - previous > 1;

            return (
              <span
                key={pageNumber}
                className="flex items-center"
              >
                {gap && (
                  <span className="px-1 text-xs text-[#9CA1B2]">
                    …
                  </span>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onChange(pageNumber)
                  }
                  className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    page === pageNumber
                      ? "bg-[#0D9488] text-white"
                      : "text-[#4F556B] hover:bg-[#F4F6F8]"
                  }`}
                >
                  {pageNumber}
                </button>
              </span>
            );
          },
        )}

        <button
          type="button"
          disabled={
            page >= totalPages
          }
          onClick={() =>
            onChange(
              Math.min(
                totalPages,
                page + 1,
              ),
            )
          }
          className="rounded-lg border border-[#DCDCE5] px-3 py-1.5 text-xs font-semibold text-[#4F556B] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#111827]/65 p-3 sm:p-5">
      <div
        className={`my-auto flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
          wide
            ? "max-w-5xl"
            : "max-w-2xl"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[#ECECF3] px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold text-[#20243A]">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-sm text-[#666B84]">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#666B84] hover:bg-[#F4F6F8]"
          >
            <X size={21} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   NAVIGATION
========================================================= */

const tabs: Array<{
  id: Tab;
  label: string;
  icon: typeof FileText;
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: Layers3,
  },
  {
    id: "regimes",
    label: "Tax Regimes",
    icon: Settings2,
  },
  {
    id: "codes",
    label: "Tax Codes",
    icon: SlidersHorizontal,
  },
  {
    id: "rates",
    label: "Tax Rates",
    icon: ChevronRight,
  },
  {
    id: "rules",
    label: "Tax Rules",
    icon: ShieldCheck,
  },
  {
    id: "mappings",
    label: "Account Mapping",
    icon: BookOpen,
  },
  {
    id: "periods",
    label: "Tax Periods",
    icon: CalendarDays,
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: FileCheck2,
  },
  {
    id: "returns",
    label: "Returns",
    icon: FileText,
  },
  {
    id: "filings",
    label: "Filings",
    icon: FileCheck2,
  },
  {
    id: "payments",
    label: "Payments",
    icon: WalletCards,
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function TaxManagement() {
  const [
    activeTab,
    setActiveTab,
  ] = useState<Tab>("overview");

  const [
    data,
    setData,
  ] = useState<TaxData>(EMPTY_DATA);

  const [
    filings,
    setFilings,
  ] = useState<TaxFiling[]>([]);

  const [
    payments,
    setPayments,
  ] = useState<TaxPayment[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    selectedFiling,
    setSelectedFiling,
  ] = useState<TaxFiling | null>(null);

  const [
  ] = useState<TaxReturn | null>(null);

  const [
    showRegimeForm,
    setShowRegimeForm,
  ] = useState(false);

  const [
    showCodeForm,
    setShowCodeForm,
  ] = useState(false);

  const [
    showRateForm,
    setShowRateForm,
  ] = useState(false);

  const [
    showRuleForm,
    setShowRuleForm,
  ] = useState(false);

  const [
    showMappingForm,
    setShowMappingForm,
  ] = useState(false);

  const [
    showPeriodForm,
    setShowPeriodForm,
  ] = useState(false);

  const [
    showReturnForm,
    setShowReturnForm,
  ] = useState(false);

  const [
    showPaymentForm,
    setShowPaymentForm,
  ] = useState(false);

  const [
    page,
    setPage,
  ] = useState<
    Record<Tab, number>
  >({
    overview: 1,
    regimes: 1,
    codes: 1,
    rates: 1,
    rules: 1,
    mappings: 1,
    periods: 1,
    transactions: 1,
    returns: 1,
    filings: 1,
    payments: 1,
  });

  /* =======================================================
     FORMS
  ======================================================= */

  const [
    regimeForm,
    setRegimeForm,
  ] = useState({
    code: "",
    name: "",
    taxType: "VAT",
    countryCode: "KE",
    currency: "KES",
    registrationNumber: "",
    description: "",
  });

  const [
    codeForm,
    setCodeForm,
  ] = useState({
    taxRegimeId: "",
    code: "",
    name: "",
    direction: "OUTPUT",
    treatment: "STANDARD",
    calculationMethod: "PERCENTAGE",
    defaultRate: "",
    isInclusive: false,
    isRecoverable: false,
    recoverabilityRate: "100",
    isWithholding: false,
    isReverseCharge: false,
    isExempt: false,
    isZeroRated: false,
  });

  const [
    rateForm,
    setRateForm,
  ] = useState({
    taxCodeId: "",
    name: "",
    rate: "",
    effectiveFrom: "",
    effectiveTo: "",
    roundingScale: "2",
    roundingMode: "HALF_UP",
  });

  const [
    ruleForm,
    setRuleForm,
  ] = useState({
    taxRegimeId: "",
    taxCodeId: "",
    code: "",
    name: "",
    priority: "100",
    transactionType: "",
    customerType: "",
    vendorType: "",
    supplyType: "",
    jurisdiction: "",
    effectiveFrom: "",
    effectiveTo: "",
    conditions: "{}",
    actions: "{}",
  });

  const [
    mappingForm,
    setMappingForm,
  ] = useState({
    taxCodeId: "",
    accountId: "",
    mappingType: "OUTPUT_TAX",
    isDefault: true,
    effectiveFrom: "",
    effectiveTo: "",
  });

  const [
    periodForm,
    setPeriodForm,
  ] = useState({
    taxRegimeId: "",
    code: "",
    name: "",
    periodStart: "",
    periodEnd: "",
    filingDueDate: "",
  });

  const [
    returnForm,
    setReturnForm,
  ] = useState({
    taxRegimeId: "",
    taxPeriodId: "",
    returnType: "VAT",
  });

  const [
    paymentForm,
    setPaymentForm,
  ] = useState({
    amount: "",
    paymentDate: "",
    paymentMethod: "BANK",
    paymentReference: "",
    notes: "",
  });

  /* =======================================================
     API
  ======================================================= */

  const request = async <T,>(
    url: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> => {
    const response =
      await authenticatedFetch(url, {
        credentials: "include",
        ...options,
        headers: {
          "Content-Type":
            "application/json",
          ...(options?.headers || {}),
        },
      });

    let result:
      | ApiResponse<T>
      | null = null;

    try {
      result =
        (await response.json()) as ApiResponse<T>;
    } catch {
      result = null;
    }

    if (
      !response.ok ||
      !result?.success
    ) {
      throw new Error(
        result?.message ||
          `Tax request failed (${response.status}).`,
      );
    }

    return result;
  };

  const load = async (
    refresh = false,
  ) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setSuccess("");

      const [
        configuration,
        filingsResponse,
        paymentsResponse,
      ] = await Promise.all([
        request<TaxData>(
          "/api/tax/configuration",
        ),
        request<unknown>(
          "/api/tax/filings?page=1&limit=100",
        ),
        request<unknown>(
          "/api/tax/payments?page=1&limit=100",
        ),
      ]);

      setData(
        configuration.data ||
          EMPTY_DATA,
      );

      setFilings(
        filingsResponse.filings ||
          [],
      );

      setPayments(
        paymentsResponse.payments ||
          [],
      );

      const regimes =
        configuration.data
          ?.regimes || [];

      const codes =
        configuration.data
          ?.codes || [];

      if (
        !codeForm.taxRegimeId &&
        regimes.length
      ) {
        setCodeForm(
          (current) => ({
            ...current,
            taxRegimeId:
              regimes[0].id,
          }),
        );
      }

      if (
        !periodForm.taxRegimeId &&
        regimes.length
      ) {
        setPeriodForm(
          (current) => ({
            ...current,
            taxRegimeId:
              regimes[0].id,
          }),
        );
      }

      if (
        !ruleForm.taxRegimeId &&
        regimes.length
      ) {
        setRuleForm(
          (current) => ({
            ...current,
            taxRegimeId:
              regimes[0].id,
          }),
        );
      }

      if (
        !returnForm.taxRegimeId &&
        regimes.length
      ) {
        setReturnForm(
          (current) => ({
            ...current,
            taxRegimeId:
              regimes[0].id,
          }),
        );
      }

      if (
        !rateForm.taxCodeId &&
        codes.length
      ) {
        setRateForm(
          (current) => ({
            ...current,
            taxCodeId:
              codes[0].id,
          }),
        );
      }

      if (
        !mappingForm.taxCodeId &&
        codes.length
      ) {
        setMappingForm(
          (current) => ({
            ...current,
            taxCodeId:
              codes[0].id,
          }),
        );
      }

      if (
        !returnForm.taxPeriodId &&
        configuration.data
          ?.periods.length
      ) {
        setReturnForm(
          (current) => ({
            ...current,
            taxPeriodId:
              configuration.data!
                .periods[0].id,
          }),
        );
      }
    } catch (err) {
      console.error(
        "[TAX UI] Load failed:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tax management data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /* =======================================================
     CALCULATED DATA
  ======================================================= */

  const overdueFilings =
    useMemo(() => {
      const now = Date.now();

      return filings.filter(
        (filing) => {
          const due = new Date(
            filing.dueDate,
          ).getTime();

          return (
            Number.isFinite(due) &&
            due < now &&
            filing.paymentStatus.toUpperCase() !==
              "PAID" &&
            filing.filingStatus.toUpperCase() !==
              "SUBMITTED"
          );
        },
      );
    }, [filings]);

  const outstandingLiability =
    useMemo(
      () =>
        filings
          .filter(
            (filing) =>
              filing.paymentStatus.toUpperCase() !==
              "PAID",
          )
          .reduce(
            (total, filing) =>
              total +
              numberValue(
                filing.totalPayable,
              ),
            0,
          ),
      [filings],
    );

  const outputTax =
    useMemo(
      () =>
        data.transactions
          .filter(
            (transaction) =>
              transaction.direction.toUpperCase() ===
              "OUTPUT",
          )
          .reduce(
            (total, transaction) =>
              total +
              numberValue(
                transaction.taxAmount,
              ),
            0,
          ),
      [data.transactions],
    );

  const recoverableInputTax =
    useMemo(
      () =>
        data.transactions
          .filter(
            (transaction) =>
              transaction.direction.toUpperCase() ===
              "INPUT",
          )
          .reduce(
            (total, transaction) =>
              total +
              numberValue(
                transaction.recoverableAmount,
              ),
            0,
          ),
      [data.transactions],
    );

  const netTaxPosition =
    outputTax -
    recoverableInputTax;

  const paginated = <T,>(
    items: T[],
    tab: Tab,
  ) => {
    const currentPage =
      page[tab] || 1;

    const start =
      (currentPage - 1) *
      PAGE_SIZE;

    return items.slice(
      start,
      start + PAGE_SIZE,
    );
  };

  const changePage = (
    tab: Tab,
    nextPage: number,
  ) => {
    setPage(
      (current) => ({
        ...current,
        [tab]: nextPage,
      }),
    );
  };

  /* =======================================================
     SAVE HELPERS
  ======================================================= */

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleCreateRegime =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      try {
        setSaving(true);
        resetMessages();

        await request(
          "/api/tax/regimes",
          {
            method: "POST",
            body: JSON.stringify({
              ...regimeForm,
              code:
                regimeForm.code
                  .trim()
                  .toUpperCase(),
              taxType:
                regimeForm.taxType
                  .trim()
                  .toUpperCase(),
              countryCode:
                regimeForm.countryCode
                  .trim()
                  .toUpperCase(),
              currency:
                regimeForm.currency
                  .trim()
                  .toUpperCase(),
            }),
          },
        );

        setShowRegimeForm(false);

        setRegimeForm({
          code: "",
          name: "",
          taxType: "VAT",
          countryCode: "KE",
          currency: "KES",
          registrationNumber:
            "",
          description: "",
        });

        setSuccess(
          "Tax regime created successfully.",
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create tax regime.",
        );
      } finally {
        setSaving(false);
      }
    };

  const handleCreateCode =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !codeForm.taxRegimeId ||
        !codeForm.code.trim() ||
        !codeForm.name.trim()
      ) {
        setError(
          "Tax regime, tax code and tax code name are required.",
        );
        return;
      }

      if (
        !isValidNumber(
          codeForm.defaultRate,
        )
      ) {
        setError(
          "Enter a valid default tax rate.",
        );
        return;
      }

      try {
        setSaving(true);
        resetMessages();

        await request(
          "/api/tax/codes",
          {
            method: "POST",
            body: JSON.stringify({
              ...codeForm,
              code:
                codeForm.code
                  .trim()
                  .toUpperCase(),
              defaultRate:
                Number(
                  codeForm.defaultRate ||
                    0,
                ),
              recoverabilityRate:
                Number(
                  codeForm.recoverabilityRate ||
                    0,
                ),
            }),
          },
        );

        setShowCodeForm(false);

        setCodeForm(
          (current) => ({
            ...current,
            code: "",
            name: "",
            defaultRate: "",
          }),
        );

        setSuccess(
          "Tax code created successfully.",
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create tax code.",
        );
      } finally {
        setSaving(false);
      }
    };

  const handleCreateRate =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !rateForm.taxCodeId ||
        !rateForm.effectiveFrom
      ) {
        setError(
          "Tax code and effective-from date are required.",
        );
        return;
      }

      if (
        !isValidNumber(
          rateForm.rate,
        )
      ) {
        setError(
          "Enter a valid tax rate.",
        );
        return;
      }

      try {
        setSaving(true);
        resetMessages();

        await request(
          "/api/tax/rates",
          {
            method: "POST",
            body: JSON.stringify({
              ...rateForm,
              rate: Number(
                rateForm.rate,
              ),
              roundingScale:
                Number(
                  rateForm.roundingScale ||
                    2,
                ),
              effectiveTo:
                rateForm.effectiveTo ||
                null,
            }),
          },
        );

        setShowRateForm(false);

        setRateForm(
          (current) => ({
            ...current,
            name: "",
            rate: "",
            effectiveFrom: "",
            effectiveTo: "",
          }),
        );

        setSuccess(
          "Tax rate created successfully.",
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create tax rate.",
        );
      } finally {
        setSaving(false);
      }
    };

  const handleCreateRule =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !ruleForm.taxRegimeId ||
        !ruleForm.code.trim() ||
        !ruleForm.name.trim() ||
        !ruleForm.effectiveFrom
      ) {
        setError(
          "Tax regime, rule code, name and effective-from date are required.",
        );
        return;
      }

      let conditions:
        | Record<string, unknown>
        | undefined;

      let actions:
        | Record<string, unknown>
        | undefined;

      try {
        conditions =
          JSON.parse(
            ruleForm.conditions,
          );

        actions =
          JSON.parse(
            ruleForm.actions,
          );
      } catch {
        setError(
          "Conditions and actions must contain valid JSON.",
        );
        return;
      }

      try {
        setSaving(true);
        resetMessages();

        await request(
          "/api/tax/rules",
          {
            method: "POST",
            body: JSON.stringify({
              taxRegimeId:
                ruleForm.taxRegimeId,
              taxCodeId:
                ruleForm.taxCodeId ||
                null,
              code:
                ruleForm.code
                  .trim()
                  .toUpperCase(),
              name:
                ruleForm.name.trim(),
              priority:
                Number(
                  ruleForm.priority ||
                    100,
                ),
              transactionType:
                ruleForm.transactionType ||
                null,
              customerType:
                ruleForm.customerType ||
                null,
              vendorType:
                ruleForm.vendorType ||
                null,
              supplyType:
                ruleForm.supplyType ||
                null,
              jurisdiction:
                ruleForm.jurisdiction ||
                null,
              effectiveFrom:
                ruleForm.effectiveFrom,
              effectiveTo:
                ruleForm.effectiveTo ||
                null,
              conditions,
              actions,
            }),
          },
        );

        setShowRuleForm(false);

        setRuleForm(
          (current) => ({
            ...current,
            code: "",
            name: "",
            priority: "100",
            transactionType: "",
            customerType: "",
            vendorType: "",
            supplyType: "",
            jurisdiction: "",
            effectiveFrom: "",
            effectiveTo: "",
            conditions: "{}",
            actions: "{}",
          }),
        );

        setSuccess(
          "Tax determination rule created successfully.",
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create tax rule.",
        );
      } finally {
        setSaving(false);
      }
    };

  const handleCreateMapping =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !mappingForm.taxCodeId ||
        !mappingForm.accountId ||
        !mappingForm.effectiveFrom
      ) {
        setError(
          "Tax code, account and effective-from date are required.",
        );
        return;
      }

      try {
        setSaving(true);
        resetMessages();

        await request(
          "/api/tax/mappings",
          {
            method: "POST",
            body: JSON.stringify({
              ...mappingForm,
              effectiveTo:
                mappingForm.effectiveTo ||
                null,
            }),
          },
        );

        setShowMappingForm(false);

        setMappingForm(
          (current) => ({
            ...current,
            accountId: "",
            effectiveFrom: "",
            effectiveTo: "",
          }),
        );

        setSuccess(
          "Tax account mapping created successfully.",
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create tax mapping.",
        );
      } finally {
        setSaving(false);
      }
    };

  const handleCreatePeriod =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !periodForm.taxRegimeId ||
        !periodForm.code.trim() ||
        !periodForm.name.trim() ||
        !periodForm.periodStart ||
        !periodForm.periodEnd
      ) {
        setError(
          "Regime, period code, name, start date and end date are required.",
        );
        return;
      }

      if (
        periodForm.periodEnd <
        periodForm.periodStart
      ) {
        setError(
          "Period end date cannot be before the period start date.",
        );
        return;
      }

      try {
        setSaving(true);
        resetMessages();

        await request(
          "/api/tax/periods",
          {
            method: "POST",
            body: JSON.stringify({
              ...periodForm,
              filingDueDate:
                periodForm.filingDueDate ||
                null,
            }),
          },
        );

        setShowPeriodForm(false);

        setPeriodForm(
          (current) => ({
            ...current,
            code: "",
            name: "",
            periodStart: "",
            periodEnd: "",
            filingDueDate: "",
          }),
        );

        setSuccess(
          "Tax period created successfully.",
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create tax period.",
        );
      } finally {
        setSaving(false);
      }
    };

  const updatePeriodStatus =
    async (
      period: TaxPeriod,
      status: string,
    ) => {
      try {
        setSaving(true);
        resetMessages();

        await request(
          `/api/tax/periods/${period.id}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status,
            }),
          },
        );

        setSuccess(
          `Tax period moved to ${prettyStatus(
            status,
          )}.`,
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update tax period status.",
        );
      } finally {
        setSaving(false);
      }
    };

  const calculateReturn =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !returnForm.taxRegimeId ||
        !returnForm.taxPeriodId
      ) {
        setError(
          "Tax regime and tax period are required.",
        );
        return;
      }

      try {
        setSaving(true);
        resetMessages();

        await request(
          "/api/tax/returns/calculate",
          {
            method: "POST",
            body: JSON.stringify({
              taxRegimeId:
                returnForm.taxRegimeId,
              taxPeriodId:
                returnForm.taxPeriodId,
              returnType:
                returnForm.returnType,
            }),
          },
        );

        setShowReturnForm(false);

        setSuccess(
          "Tax return calculated successfully from the tax ledger.",
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to calculate tax return.",
        );
      } finally {
        setSaving(false);
      }
    };

  const updateReturnStatus =
    async (
      taxReturn: TaxReturn,
      status: string,
    ) => {
      try {
        setSaving(true);
        resetMessages();

        await request(
          `/api/tax/returns/${taxReturn.id}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status,
            }),
          },
        );

        setSuccess(
          `Tax return moved to ${prettyStatus(
            status,
          )}.`,
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update tax return.",
        );
      } finally {
        setSaving(false);
      }
    };

  const createFilingFromReturn =
    async (
      taxReturn: TaxReturn,
    ) => {
      try {
        setSaving(true);
        resetMessages();

        await request(
          `/api/tax/returns/${taxReturn.id}/create-filing`,
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

        setSuccess(
          "Tax filing created from the approved tax return.",
        );

        await load(true);

        setActiveTab("filings");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create filing from tax return.",
        );
      } finally {
        setSaving(false);
      }
    };

  const recordPayment =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (!selectedFiling) {
        return;
      }

      const amount =
        Number(paymentForm.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        setError(
          "Enter a valid payment amount greater than zero.",
        );
        return;
      }

      if (
        !paymentForm.paymentDate ||
        !paymentForm.paymentMethod
      ) {
        setError(
          "Payment date and payment method are required.",
        );
        return;
      }

      try {
        setSaving(true);
        resetMessages();

        await request(
          "/api/tax/payments",
          {
            method: "POST",
            body: JSON.stringify({
              taxFilingId:
                selectedFiling.id,
              amount,
              paymentDate:
                paymentForm.paymentDate,
              paymentMethod:
                paymentForm.paymentMethod,
              paymentReference:
                paymentForm.paymentReference.trim() ||
                null,
              notes:
                paymentForm.notes.trim() ||
                null,
            }),
          },
        );

        setShowPaymentForm(false);
        setSelectedFiling(null);

        setSuccess(
          "Tax payment recorded successfully.",
        );

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to record tax payment.",
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     OVERVIEW
  ======================================================= */

  const renderOverview =
    () => (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label:
                "Active Tax Codes",
              value:
                data.codes.filter(
                  (item) =>
                    item.isActive,
                ).length,
              icon:
                SlidersHorizontal,
            },
            {
              label:
                "Open Tax Periods",
              value:
                data.periods.filter(
                  (item) =>
                    item.status ===
                    "OPEN",
                ).length,
              icon: CalendarDays,
            },
            {
              label:
                "Outstanding Liability",
              value:
                currency(
                  outstandingLiability,
                ),
              icon: WalletCards,
            },
            {
              label:
                "Overdue Filings",
              value:
                overdueFilings.length,
              icon:
                overdueFilings.length
                  ? AlertTriangle
                  : CheckCircle2,
            },
          ].map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <div
                  key={
                    item.label
                  }
                  className="rounded-2xl border border-[#E7E9F0] bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#666B84]">
                      {item.label}
                    </p>

                    <Icon
                      size={19}
                      className={
                        item.label ===
                          "Overdue Filings" &&
                        overdueFilings.length
                          ? "text-red-600"
                          : "text-[#0D9488]"
                      }
                    />
                  </div>

                  <p className="mt-3 text-3xl font-bold tracking-tight text-[#20243A]">
                    {item.value}
                  </p>
                </div>
              );
            },
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel
            title="Tax Position"
            description="Current output and recoverable input tax."
          >
            <div className="space-y-4 p-5">
              <div className="flex justify-between text-sm">
                <span className="text-[#666B84]">
                  Output tax
                </span>

                <strong>
                  {currency(
                    outputTax,
                  )}
                </strong>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-[#666B84]">
                  Recoverable input tax
                </span>

                <strong>
                  {currency(
                    recoverableInputTax,
                  )}
                </strong>
              </div>

              <div className="flex justify-between border-t border-[#ECECF3] pt-4">
                <span className="font-semibold">
                  Net tax position
                </span>

                <strong className="text-[#0D9488]">
                  {currency(
                    netTaxPosition,
                  )}
                </strong>
              </div>
            </div>
          </Panel>

          <Panel
            title="Tax Control Framework"
            description="Configuration coverage."
          >
            <div className="space-y-3 p-5 text-sm">
              {[
                [
                  "Tax regimes",
                  data.regimes.length,
                ],
                [
                  "Tax codes",
                  data.codes.length,
                ],
                [
                  "Effective rates",
                  data.rates.length,
                ],
                [
                  "Tax rules",
                  data.rules.length,
                ],
                [
                  "GL mappings",
                  data.mappings.length,
                ],
                [
                  "Tax periods",
                  data.periods.length,
                ],
                [
                  "Tax transactions",
                  data.transactions.length,
                ],
                [
                  "Tax returns",
                  data.returns.length,
                ],
              ].map(
                ([label, value]) => (
                  <div
                    key={String(
                      label,
                    )}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[#666B84]">
                      {label}
                    </span>

                    <span className="font-semibold text-[#20243A]">
                      {value}
                    </span>
                  </div>
                ),
              )}
            </div>
          </Panel>

          <Panel
            title="Compliance Attention"
            description="Filings requiring action."
          >
            {overdueFilings.length ? (
              <div className="space-y-3 p-5">
                {overdueFilings
                  .slice(0, 5)
                  .map(
                    (
                      filing,
                    ) => (
                      <button
                        key={
                          filing.id
                        }
                        type="button"
                        onClick={() => {
                          setActiveTab(
                            "filings",
                          );
                          setPage(
                            (
                              current,
                            ) => ({
                              ...current,
                              filings: 1,
                            }),
                          );
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-red-100 bg-red-50 p-3 text-left"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-[#20243A]">
                            {filing
                              .obligation
                              ?.name ||
                              filing.taxObligationCode}
                          </span>

                          <span className="mt-1 block text-xs text-red-700">
                            Due{" "}
                            {dateText(
                              filing.dueDate,
                            )}
                          </span>
                        </span>

                        <ChevronRight
                          size={
                            17
                          }
                          className="text-red-700"
                        />
                      </button>
                    ),
                  )}
              </div>
            ) : (
              <div className="p-8 text-center">
                <CheckCircle2
                  size={30}
                  className="mx-auto text-emerald-600"
                />

                <p className="mt-3 text-sm font-semibold text-[#20243A]">
                  No overdue filings
                </p>

                <p className="mt-1 text-xs text-[#666B84]">
                  Current filing records do not show overdue unpaid obligations.
                </p>
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="Recent Tax Activity"
          description="Latest tax transactions recorded for this tenant."
        >
          {data.transactions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Date
                    </th>
                    <th className="p-4">
                      Source
                    </th>
                    <th className="p-4">
                      Tax Code
                    </th>
                    <th className="p-4">
                      Direction
                    </th>
                    <th className="p-4 text-right">
                      Taxable
                    </th>
                    <th className="p-4 text-right">
                      Tax
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.transactions
                    .slice(0, 8)
                    .map(
                      (
                        transaction,
                      ) => (
                        <tr
                          key={
                            transaction.id
                          }
                          className="border-t border-[#ECECF3]"
                        >
                          <td className="p-4">
                            {dateText(
                              transaction.transactionDate,
                            )}
                          </td>

                          <td className="p-4">
                            {
                              transaction.sourceType
                            }
                          </td>

                          <td className="p-4 font-semibold">
                            {transaction
                              .taxCode
                              ?.code ||
                              transaction.taxCodeId}
                          </td>

                          <td className="p-4">
                            {
                              transaction.direction
                            }
                          </td>

                          <td className="p-4 text-right">
                            {currency(
                              transaction.taxableAmount,
                              transaction.currency,
                            )}
                          </td>

                          <td className="p-4 text-right font-semibold">
                            {currency(
                              transaction.taxAmount,
                              transaction.currency,
                            )}
                          </td>

                          <td className="p-4">
                            <Badge
                              value={
                                transaction.status
                              }
                            />
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No tax transactions recorded" />
          )}
        </Panel>
      </div>
    );

  /* =======================================================
     REGIMES
  ======================================================= */

  const renderRegimes =
    () => {
      const items =
        paginated(
          data.regimes,
          "regimes",
        );

      return (
        <Panel
          title="Tax Regimes"
          description="Statutory tax frameworks configured for this tenant."
          action={
            <button
              type="button"
              onClick={() =>
                setShowRegimeForm(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus
                size={16}
              />
              Add regime
            </button>
          }
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Code
                    </th>
                    <th className="p-4">
                      Regime
                    </th>
                    <th className="p-4">
                      Type
                    </th>
                    <th className="p-4">
                      Country
                    </th>
                    <th className="p-4">
                      Registration
                    </th>
                    <th className="p-4">
                      Currency
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-t border-[#ECECF3] hover:bg-[#FAFBFC]"
                      >
                        <td className="p-4 font-semibold text-[#20243A]">
                          {
                            item.code
                          }
                        </td>

                        <td className="p-4">
                          {
                            item.name
                          }
                        </td>

                        <td className="p-4">
                          {
                            item.taxType
                          }
                        </td>

                        <td className="p-4">
                          {
                            item.countryCode
                          }
                        </td>

                        <td className="p-4 text-sm text-[#666B84]">
                          {item.registrationNumber ||
                            "-"}
                        </td>

                        <td className="p-4">
                          {
                            item.currency
                          }
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              item.isActive
                                ? "ACTIVE"
                                : "INACTIVE"
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          7
                        }
                      >
                        <EmptyState label="No tax regimes configured" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.regimes
              }
              total={
                data.regimes
                  .length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "regimes",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     TAX CODES
  ======================================================= */

  const renderCodes =
    () => {
      const items =
        paginated(
          data.codes,
          "codes",
        );

      return (
        <Panel
          title="Tax Codes"
          description="Tax treatments used by the tax determination and calculation engine."
          action={
            <button
              type="button"
              onClick={() =>
                setShowCodeForm(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus
                size={16}
              />
              Add tax code
            </button>
          }
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Code
                    </th>
                    <th className="p-4">
                      Name
                    </th>
                    <th className="p-4">
                      Regime
                    </th>
                    <th className="p-4">
                      Direction
                    </th>
                    <th className="p-4">
                      Rate
                    </th>
                    <th className="p-4">
                      Treatment
                    </th>
                    <th className="p-4">
                      Features
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-t border-[#ECECF3] hover:bg-[#FAFBFC]"
                      >
                        <td className="p-4 font-semibold">
                          {
                            item.code
                          }
                        </td>

                        <td className="p-4">
                          {
                            item.name
                          }
                        </td>

                        <td className="p-4">
                          {item
                            .taxRegime
                            ?.code ||
                            item.taxRegimeId}
                        </td>

                        <td className="p-4">
                          {
                            item.direction
                          }
                        </td>

                        <td className="p-4">
                          {numberValue(
                            item.defaultRate,
                          ).toFixed(
                            2,
                          )}
                          %
                        </td>

                        <td className="p-4">
                          {
                            item.treatment
                          }
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {item.isInclusive && (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px]">
                                Inclusive
                              </span>
                            )}

                            {item.isRecoverable && (
                              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                                Recoverable
                              </span>
                            )}

                            {item.isWithholding && (
                              <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                                Withholding
                              </span>
                            )}

                            {item.isReverseCharge && (
                              <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                                Reverse charge
                              </span>
                            )}

                            {item.isExempt && (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px]">
                                Exempt
                              </span>
                            )}

                            {item.isZeroRated && (
                              <span className="rounded-md bg-sky-50 px-2 py-1 text-[11px] text-sky-700">
                                Zero-rated
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              item.isActive
                                ? "ACTIVE"
                                : "INACTIVE"
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          8
                        }
                      >
                        <EmptyState label="No tax codes configured" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.codes
              }
              total={
                data.codes.length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "codes",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     TAX RATES
  ======================================================= */

  const renderRates =
    () => {
      const items =
        paginated(
          data.rates,
          "rates",
        );

      return (
        <Panel
          title="Tax Rates"
          description="Effective-dated rates preserve historical tax accuracy."
          action={
            <button
              type="button"
              onClick={() =>
                setShowRateForm(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus
                size={16}
              />
              Add rate
            </button>
          }
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Tax Code
                    </th>
                    <th className="p-4">
                      Rate
                    </th>
                    <th className="p-4">
                      Effective From
                    </th>
                    <th className="p-4">
                      Effective To
                    </th>
                    <th className="p-4">
                      Rounding
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-t border-[#ECECF3]"
                      >
                        <td className="p-4 font-semibold">
                          {item
                            .taxCode
                            ?.code ||
                            item.taxCodeId}
                        </td>

                        <td className="p-4 font-semibold">
                          {numberValue(
                            item.rate,
                          ).toFixed(
                            4,
                          )}
                          %
                        </td>

                        <td className="p-4">
                          {dateText(
                            item.effectiveFrom,
                          )}
                        </td>

                        <td className="p-4">
                          {dateText(
                            item.effectiveTo,
                          )}
                        </td>

                        <td className="p-4 text-sm text-[#666B84]">
                          {
                            item.roundingScale
                          }{" "}
                          dp /{" "}
                          {
                            item.roundingMode
                          }
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              item.isActive
                                ? "ACTIVE"
                                : "INACTIVE"
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          6
                        }
                      >
                        <EmptyState label="No tax rates configured" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.rates
              }
              total={
                data.rates.length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "rates",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     TAX RULES
  ======================================================= */

  const renderRules =
    () => {
      const items =
        paginated(
          data.rules,
          "rules",
        );

      return (
        <Panel
          title="Tax Rules"
          description="Priority-based tax determination rules."
          action={
            <button
              type="button"
              onClick={() =>
                setShowRuleForm(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus
                size={16}
              />
              Add rule
            </button>
          }
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Priority
                    </th>
                    <th className="p-4">
                      Code
                    </th>
                    <th className="p-4">
                      Rule
                    </th>
                    <th className="p-4">
                      Tax Code
                    </th>
                    <th className="p-4">
                      Scope
                    </th>
                    <th className="p-4">
                      Effective
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-t border-[#ECECF3]"
                      >
                        <td className="p-4 font-semibold">
                          {
                            item.priority
                          }
                        </td>

                        <td className="p-4 font-semibold">
                          {
                            item.code
                          }
                        </td>

                        <td className="p-4">
                          {
                            item.name
                          }
                        </td>

                        <td className="p-4">
                          {item
                            .taxCode
                            ?.code ||
                            "Default"}
                        </td>

                        <td className="max-w-[280px] p-4 text-xs text-[#666B84]">
                          {[
                            item.transactionType,
                            item.customerType,
                            item.vendorType,
                            item.supplyType,
                            item.jurisdiction,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              " • ",
                            ) ||
                            "General"}
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          {dateText(
                            item.effectiveFrom,
                          )}{" "}
                          —{" "}
                          {dateText(
                            item.effectiveTo,
                          )}
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              item.isActive
                                ? "ACTIVE"
                                : "INACTIVE"
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          7
                        }
                      >
                        <EmptyState label="No tax rules configured" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.rules
              }
              total={
                data.rules.length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "rules",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     ACCOUNT MAPPING
  ======================================================= */

  const renderMappings =
    () => {
      const items =
        paginated(
          data.mappings,
          "mappings",
        );

      return (
        <Panel
          title="Tax Account Mapping"
          description="Maps tax codes to tenant ledger accounts."
          action={
            <button
              type="button"
              onClick={() =>
                setShowMappingForm(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus
                size={16}
              />
              Add mapping
            </button>
          }
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Tax Code
                    </th>
                    <th className="p-4">
                      Mapping
                    </th>
                    <th className="p-4">
                      Account
                    </th>
                    <th className="p-4">
                      Effective
                    </th>
                    <th className="p-4">
                      Default
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-t border-[#ECECF3]"
                      >
                        <td className="p-4 font-semibold">
                          {item
                            .taxCode
                            ?.code ||
                            item.taxCodeId}
                        </td>

                        <td className="p-4">
                          {
                            item.mappingType
                          }
                        </td>

                        <td className="p-4">
                          {item
                            .account
                            ?.code
                            ? `${item.account.code} — ${
                                item.account.name
                              }`
                            : item.accountId}
                        </td>

                        <td className="p-4">
                          {dateText(
                            item.effectiveFrom,
                          )}
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              item.isDefault
                                ? "ACTIVE"
                                : "OPTIONAL"
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          5
                        }
                      >
                        <EmptyState label="No tax account mappings configured" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.mappings
              }
              total={
                data.mappings
                  .length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "mappings",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     TAX PERIODS
  ======================================================= */

  const renderPeriods =
    () => {
      const items =
        paginated(
          data.periods,
          "periods",
        );

      return (
        <Panel
          title="Tax Periods"
          description="Controlled tax reporting periods and lifecycle."
          action={
            <button
              type="button"
              onClick={() =>
                setShowPeriodForm(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus
                size={16}
              />
              Add period
            </button>
          }
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Period
                    </th>
                    <th className="p-4">
                      Regime
                    </th>
                    <th className="p-4">
                      Start
                    </th>
                    <th className="p-4">
                      End
                    </th>
                    <th className="p-4">
                      Due
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                    <th className="p-4">
                      Lifecycle
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-t border-[#ECECF3]"
                      >
                        <td className="p-4">
                          <div className="font-semibold">
                            {
                              item.code
                            }
                          </div>

                          <div className="text-xs text-[#666B84]">
                            {
                              item.name
                            }
                          </div>
                        </td>

                        <td className="p-4">
                          {item
                            .taxRegime
                            ?.code ||
                            item.taxRegimeId}
                        </td>

                        <td className="p-4">
                          {dateText(
                            item.periodStart,
                          )}
                        </td>

                        <td className="p-4">
                          {dateText(
                            item.periodEnd,
                          )}
                        </td>

                        <td className="p-4">
                          {dateText(
                            item.filingDueDate,
                          )}
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              item.status
                            }
                          />
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {item.status ===
                              "OPEN" && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  void updatePeriodStatus(
                                    item,
                                    "UNDER_REVIEW",
                                  )
                                }
                                className="rounded-lg border border-[#DCDCE5] px-2.5 py-1.5 text-xs font-semibold"
                              >
                                Review
                              </button>
                            )}

                            {item.status ===
                              "UNDER_REVIEW" && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  void updatePeriodStatus(
                                    item,
                                    "READY_TO_FILE",
                                  )
                                }
                                className="rounded-lg bg-[#0D9488] px-2.5 py-1.5 text-xs font-semibold text-white"
                              >
                                Ready to file
                              </button>
                            )}

                            {item.status ===
                              "READY_TO_FILE" && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  void updatePeriodStatus(
                                    item,
                                    "CLOSED",
                                  )
                                }
                                className="rounded-lg bg-[#20243A] px-2.5 py-1.5 text-xs font-semibold text-white"
                              >
                                Close
                              </button>
                            )}

                            {item.status ===
                              "CLOSED" && (
                              <span className="text-xs text-[#666B84]">
                                Closed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          7
                        }
                      >
                        <EmptyState label="No tax periods configured" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.periods
              }
              total={
                data.periods.length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "periods",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     TRANSACTIONS
  ======================================================= */

  const renderTransactions =
    () => {
      const items =
        paginated(
          data.transactions,
          "transactions",
        );

      return (
        <Panel
          title="Tax Transactions"
          description="Tax events generated from source transactions."
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Date
                    </th>
                    <th className="p-4">
                      Source
                    </th>
                    <th className="p-4">
                      Tax Code
                    </th>
                    <th className="p-4">
                      Direction
                    </th>
                    <th className="p-4 text-right">
                      Taxable
                    </th>
                    <th className="p-4 text-right">
                      Tax
                    </th>
                    <th className="p-4 text-right">
                      Recoverable
                    </th>
                    <th className="p-4">
                      Rate
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-t border-[#ECECF3]"
                      >
                        <td className="p-4">
                          {dateText(
                            item.transactionDate,
                          )}
                        </td>

                        <td className="p-4">
                          <div className="font-medium">
                            {
                              item.sourceType
                            }
                          </div>

                          <div className="text-xs text-[#666B84]">
                            {
                              item.sourceId
                            }
                          </div>
                        </td>

                        <td className="p-4 font-semibold">
                          {item
                            .taxCode
                            ?.code ||
                            item.taxCodeId}
                        </td>

                        <td className="p-4">
                          {
                            item.direction
                          }
                        </td>

                        <td className="p-4 text-right">
                          {currency(
                            item.taxableAmount,
                            item.currency,
                          )}
                        </td>

                        <td className="p-4 text-right font-semibold">
                          {currency(
                            item.taxAmount,
                            item.currency,
                          )}
                        </td>

                        <td className="p-4 text-right">
                          {currency(
                            item.recoverableAmount,
                            item.currency,
                          )}
                        </td>

                        <td className="p-4">
                          {numberValue(
                            item.rateApplied,
                          ).toFixed(
                            4,
                          )}
                          %
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              item.status
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          9
                        }
                      >
                        <EmptyState label="No tax transactions recorded" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.transactions
              }
              total={
                data.transactions
                  .length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "transactions",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     RETURNS
  ======================================================= */

  const renderReturns =
    () => {
      const items =
        paginated(
          data.returns,
          "returns",
        );

      return (
        <Panel
          title="Tax Returns"
          description="Returns calculated from the tenant tax ledger."
          action={
            <button
              type="button"
              onClick={() =>
                setShowReturnForm(
                  true,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus
                size={16}
              />
              Calculate return
            </button>
          }
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Regime
                    </th>
                    <th className="p-4">
                      Period
                    </th>
                    <th className="p-4">
                      Type
                    </th>
                    <th className="p-4 text-right">
                      Taxable
                    </th>
                    <th className="p-4 text-right">
                      Output
                    </th>
                    <th className="p-4 text-right">
                      Input
                    </th>
                    <th className="p-4 text-right">
                      Withholding
                    </th>
                    <th className="p-4 text-right">
                      Net Payable
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                    <th className="p-4">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-t border-[#ECECF3]"
                      >
                        <td className="p-4 font-semibold">
                          {item
                            .taxRegime
                            ?.code ||
                            item.taxRegimeId}
                        </td>

                        <td className="p-4">
                          {item
                            .taxPeriod
                            ?.code ||
                            item.taxPeriodId}
                        </td>

                        <td className="p-4">
                          {
                            item.returnType
                          }
                        </td>

                        <td className="p-4 text-right">
                          {currency(
                            item.taxableAmount,
                          )}
                        </td>

                        <td className="p-4 text-right">
                          {currency(
                            item.outputTax,
                          )}
                        </td>

                        <td className="p-4 text-right">
                          {currency(
                            item.inputTax,
                          )}
                        </td>

                        <td className="p-4 text-right">
                          {currency(
                            item.withholdingTax,
                          )}
                        </td>

                        <td className="p-4 text-right font-semibold">
                          {currency(
                            item.netTaxPayable,
                          )}
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              item.status
                            }
                          />
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {item.status ===
                              "DRAFT" && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  void updateReturnStatus(
                                    item,
                                    "UNDER_REVIEW",
                                  )
                                }
                                className="rounded-lg border border-[#DCDCE5] px-2.5 py-1.5 text-xs font-semibold"
                              >
                                Submit review
                              </button>
                            )}

                            {item.status ===
                              "UNDER_REVIEW" && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  void updateReturnStatus(
                                    item,
                                    "APPROVED",
                                  )
                                }
                                className="rounded-lg bg-[#0D9488] px-2.5 py-1.5 text-xs font-semibold text-white"
                              >
                                Approve
                              </button>
                            )}

                            {item.status ===
                              "APPROVED" && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  void createFilingFromReturn(
                                    item,
                                  )
                                }
                                className="rounded-lg bg-[#20243A] px-2.5 py-1.5 text-xs font-semibold text-white"
                              >
                                Create filing
                              </button>
                            )}

                            {item.status ===
                              "FILED" && (
                              <span className="text-xs text-[#666B84]">
                                Filed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          10
                        }
                      >
                        <EmptyState label="No tax returns prepared" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.returns
              }
              total={
                data.returns.length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "returns",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     FILINGS
  ======================================================= */

  const renderFilings =
    () => {
      const items =
        paginated(
          filings,
          "filings",
        );

      return (
        <Panel
          title="Tax Filings"
          description="Statutory filings generated from approved tax returns."
        >
          {filings.length ? (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1250px]">
                  <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                    <tr>
                      <th className="p-4">
                        Obligation
                      </th>
                      <th className="p-4">
                        Period
                      </th>
                      <th className="p-4 text-right">
                        Tax
                      </th>
                      <th className="p-4 text-right">
                        Total Payable
                      </th>
                      <th className="p-4">
                        Due
                      </th>
                      <th className="p-4">
                        Filing
                      </th>
                      <th className="p-4">
                        Payment
                      </th>
                      <th className="p-4">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map(
                      (filing) => (
                        <tr
                          key={
                            filing.id
                          }
                          className="border-t border-[#ECECF3]"
                        >
                          <td className="p-4">
                            <div className="font-semibold">
                              {filing
                                .obligation
                                ?.name ||
                                filing.taxObligationCode}
                            </div>

                            <div className="text-xs text-[#666B84]">
                              {
                                filing.taxObligationCode
                              }
                            </div>
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {dateText(
                              filing.taxPeriodStart,
                            )}{" "}
                            —{" "}
                            {dateText(
                              filing.taxPeriodEnd,
                            )}
                          </td>

                          <td className="p-4 text-right">
                            {currency(
                              filing.taxAmount,
                            )}
                          </td>

                          <td className="p-4 text-right font-semibold">
                            {currency(
                              filing.totalPayable,
                            )}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {dateText(
                              filing.dueDate,
                            )}
                          </td>

                          <td className="p-4">
                            <Badge
                              value={
                                filing.filingStatus
                              }
                            />
                          </td>

                          <td className="p-4">
                            <Badge
                              value={
                                filing.paymentStatus
                              }
                            />
                          </td>

                          <td className="p-4">
                            {filing.paymentStatus.toUpperCase() !==
                            "PAID" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFiling(
                                    filing,
                                  );

                                  setPaymentForm(
                                    {
                                      amount:
                                        "",
                                      paymentDate:
                                        new Date()
                                          .toISOString()
                                          .slice(
                                            0,
                                            10,
                                          ),
                                      paymentMethod:
                                        "BANK",
                                      paymentReference:
                                        "",
                                      notes:
                                        "",
                                    },
                                  );

                                  setShowPaymentForm(
                                    true,
                                  );
                                }}
                                className="rounded-lg bg-[#0D9488] px-3 py-2 text-xs font-semibold text-white"
                              >
                                Record payment
                              </button>
                            ) : (
                              <span className="text-xs text-[#666B84]">
                                Settled
                              </span>
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {items.map(
                  (filing) => (
                    <div
                      key={
                        filing.id
                      }
                      className="rounded-xl border border-[#E7E9F0] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#20243A]">
                            {filing
                              .obligation
                              ?.name ||
                              filing.taxObligationCode}
                          </p>

                          <p className="mt-1 text-xs text-[#666B84]">
                            {dateText(
                              filing.taxPeriodStart,
                            )}{" "}
                            —{" "}
                            {dateText(
                              filing.taxPeriodEnd,
                            )}
                          </p>
                        </div>

                        <Badge
                          value={
                            filing.paymentStatus
                          }
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-[#666B84]">
                            Tax
                          </p>

                          <p className="mt-1 font-semibold">
                            {currency(
                              filing.taxAmount,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#666B84]">
                            Payable
                          </p>

                          <p className="mt-1 font-semibold">
                            {currency(
                              filing.totalPayable,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#666B84]">
                            Due
                          </p>

                          <p className="mt-1">
                            {dateText(
                              filing.dueDate,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#666B84]">
                            Filing
                          </p>

                          <Badge
                            value={
                              filing.filingStatus
                            }
                          />
                        </div>
                      </div>

                      {filing.paymentStatus.toUpperCase() !==
                        "PAID" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFiling(
                              filing,
                            );

                            setPaymentForm(
                              {
                                amount:
                                  "",
                                paymentDate:
                                  new Date()
                                    .toISOString()
                                    .slice(
                                      0,
                                      10,
                                    ),
                                paymentMethod:
                                  "BANK",
                                paymentReference:
                                  "",
                                notes:
                                  "",
                              },
                            );

                            setShowPaymentForm(
                              true,
                            );
                          }}
                          className="mt-4 w-full rounded-lg bg-[#0D9488] px-3 py-2.5 text-xs font-semibold text-white"
                        >
                          Record payment
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>

              <Pagination
                page={
                  page.filings
                }
                total={
                  filings.length
                }
                onChange={(
                  next,
                ) =>
                  changePage(
                    "filings",
                    next,
                  )
                }
              />
            </>
          ) : (
            <EmptyState label="No tax filings recorded" />
          )}
        </Panel>
      );
    };

  /* =======================================================
     PAYMENTS
  ======================================================= */

  const renderPayments =
    () => {
      const items =
        paginated(
          payments,
          "payments",
        );

      return (
        <Panel
          title="Tax Payments"
          description="Settlement records linked to statutory tax filings."
        >
          <div className="m-5 overflow-hidden rounded-xl border border-[#ECECF3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  <tr>
                    <th className="p-4">
                      Date
                    </th>
                    <th className="p-4">
                      Reference
                    </th>
                    <th className="p-4">
                      Method
                    </th>
                    <th className="p-4 text-right">
                      Amount
                    </th>
                    <th className="p-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (payment) => (
                      <tr
                        key={
                          payment.id
                        }
                        className="border-t border-[#ECECF3]"
                      >
                        <td className="p-4">
                          {dateText(
                            payment.paymentDate,
                          )}
                        </td>

                        <td className="p-4 font-medium">
                          {payment.paymentReference ||
                            "-"}
                        </td>

                        <td className="p-4">
                          {
                            payment.paymentMethod
                          }
                        </td>

                        <td className="p-4 text-right font-semibold">
                          {currency(
                            payment.amount,
                          )}
                        </td>

                        <td className="p-4">
                          <Badge
                            value={
                              payment.status
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}

                  {!items.length && (
                    <tr>
                      <td
                        colSpan={
                          5
                        }
                      >
                        <EmptyState label="No tax payments recorded" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page.payments
              }
              total={
                payments.length
              }
              onChange={(
                next,
              ) =>
                changePage(
                  "payments",
                  next,
                )
              }
            />
          </div>
        </Panel>
      );
    };

  /* =======================================================
     ACTIVE BODY
  ======================================================= */

  const renderBody =
    () => {
      switch (
        activeTab
      ) {
        case "overview":
          return renderOverview();

        case "regimes":
          return renderRegimes();

        case "codes":
          return renderCodes();

        case "rates":
          return renderRates();

        case "rules":
          return renderRules();

        case "mappings":
          return renderMappings();

        case "periods":
          return renderPeriods();

        case "transactions":
          return renderTransactions();

        case "returns":
          return renderReturns();

        case "filings":
          return renderFilings();

        case "payments":
          return renderPayments();

        default:
          return renderOverview();
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0D9488]">
            Tax & Compliance
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#20243A] sm:text-4xl">
            Tax Management
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-[#666B84]">
            Tenant-scoped tax configuration,
            determination, effective rates,
            accounting mappings, tax periods,
            transactions, returns, statutory
            filings and payments.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() =>
            void load(true)
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E2E5EC] bg-white px-4 text-sm font-semibold text-[#4F556B] shadow-sm disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* MESSAGES */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-semibold">
              Tax Management Error
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="ml-auto"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-semibold">
              Completed
            </p>

            <p className="mt-1 text-sm">
              {success}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
            className="ml-auto"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* TABS */}

      <div className="sticky top-0 z-20 overflow-x-auto rounded-2xl border border-[#E7E9F0] bg-white/95 p-1.5 shadow-sm backdrop-blur">
        <div className="flex min-w-max gap-1">
          {tabs.map(
            (tab) => {
              const Icon =
                tab.icon;

              const active =
                activeTab ===
                tab.id;

              return (
                <button
                  key={
                    tab.id
                  }
                  type="button"
                  onClick={() => {
                    setActiveTab(
                      tab.id,
                    );

                    setPage(
                      (
                        current,
                      ) => ({
                        ...current,
                        [tab.id]: 1,
                      }),
                    );
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-[#0D9488] text-white shadow-sm"
                      : "text-[#666B84] hover:bg-[#F6F7F9] hover:text-[#20243A]"
                  }`}
                >
                  <Icon
                    size={16}
                  />

                  {
                    tab.label
                  }
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* BODY */}

      {loading ? (
        <div className="rounded-2xl border border-[#E7E9F0] bg-white p-12 text-center">
          <RefreshCw
            size={28}
            className="mx-auto animate-spin text-[#0D9488]"
          />

          <p className="mt-4 text-sm font-medium text-[#20243A]">
            Loading tax workspace...
          </p>

          <p className="mt-1 text-xs text-[#666B84]">
            Loading tenant-scoped tax configuration and compliance records.
          </p>
        </div>
      ) : (
        renderBody()
      )}

      {/* =====================================================
          REGIME MODAL
      ===================================================== */}

      {showRegimeForm && (
        <Modal
          title="Create Tax Regime"
          description="Create the statutory tax framework that will contain tax codes, rates and periods."
          onClose={() =>
            setShowRegimeForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              handleCreateRegime
            }
            className="space-y-4 p-6"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                value={
                  regimeForm.code
                }
                onChange={(event) =>
                  setRegimeForm(
                    (current) => ({
                      ...current,
                      code: event
                        .target
                        .value,
                    }),
                  )
                }
                placeholder="Regime code e.g. VAT"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  regimeForm.name
                }
                onChange={(event) =>
                  setRegimeForm(
                    (current) => ({
                      ...current,
                      name: event
                        .target
                        .value,
                    }),
                  )
                }
                placeholder="Regime name"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <select
                value={
                  regimeForm.taxType
                }
                onChange={(event) =>
                  setRegimeForm(
                    (current) => ({
                      ...current,
                      taxType:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
              >
                <option value="VAT">
                  VAT
                </option>
                <option value="WITHHOLDING">
                  Withholding
                </option>
                <option value="PAYE">
                  PAYE
                </option>
                <option value="TURNOVER">
                  Turnover Tax
                </option>
                <option value="OTHER">
                  Other
                </option>
              </select>

              <input
                value={
                  regimeForm.registrationNumber
                }
                onChange={(event) =>
                  setRegimeForm(
                    (current) => ({
                      ...current,
                      registrationNumber:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Tax registration number"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  regimeForm.countryCode
                }
                onChange={(event) =>
                  setRegimeForm(
                    (current) => ({
                      ...current,
                      countryCode:
                        event.target.value.toUpperCase(),
                    }),
                  )
                }
                placeholder="Country code"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  regimeForm.currency
                }
                onChange={(event) =>
                  setRegimeForm(
                    (current) => ({
                      ...current,
                      currency:
                        event.target.value.toUpperCase(),
                    }),
                  )
                }
                placeholder="Currency"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <textarea
              value={
                regimeForm.description
              }
              onChange={(event) =>
                setRegimeForm(
                  (current) => ({
                    ...current,
                    description:
                      event.target
                        .value,
                  }),
                )
              }
              rows={4}
              placeholder="Description"
              className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
            />

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
              <button
                type="button"
                onClick={() =>
                  setShowRegimeForm(
                    false,
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create regime"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          TAX CODE MODAL
      ===================================================== */}

      {showCodeForm && (
        <Modal
          title="Create Tax Code"
          description="Define the tax treatment used by the tax engine."
          onClose={() =>
            setShowCodeForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              handleCreateCode
            }
            className="space-y-4 p-6"
          >
            <select
              value={
                codeForm.taxRegimeId
              }
              onChange={(event) =>
                setCodeForm(
                  (current) => ({
                    ...current,
                    taxRegimeId:
                      event.target
                        .value,
                  }),
                )
              }
              required
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                Select tax regime
              </option>

              {data.regimes.map(
                (regime) => (
                  <option
                    key={
                      regime.id
                    }
                    value={
                      regime.id
                    }
                  >
                    {
                      regime.code
                    }{" "}
                    —{" "}
                    {
                      regime.name
                    }
                  </option>
                ),
              )}
            </select>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                value={
                  codeForm.code
                }
                onChange={(event) =>
                  setCodeForm(
                    (current) => ({
                      ...current,
                      code: event
                        .target
                        .value
                        .toUpperCase(),
                    }),
                  )
                }
                placeholder="Tax code"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  codeForm.name
                }
                onChange={(event) =>
                  setCodeForm(
                    (current) => ({
                      ...current,
                      name: event
                        .target
                        .value,
                    }),
                  )
                }
                placeholder="Tax code name"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <select
                value={
                  codeForm.direction
                }
                onChange={(event) =>
                  setCodeForm(
                    (current) => ({
                      ...current,
                      direction:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
              >
                <option value="OUTPUT">
                  Output
                </option>
                <option value="INPUT">
                  Input
                </option>
                <option value="WITHHOLDING">
                  Withholding
                </option>
              </select>

              <select
                value={
                  codeForm.treatment
                }
                onChange={(event) =>
                  setCodeForm(
                    (current) => ({
                      ...current,
                      treatment:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
              >
                <option value="STANDARD">
                  Standard
                </option>
                <option value="ZERO_RATED">
                  Zero-rated
                </option>
                <option value="EXEMPT">
                  Exempt
                </option>
                <option value="OUT_OF_SCOPE">
                  Out of scope
                </option>
                <option value="REVERSE_CHARGE">
                  Reverse charge
                </option>
              </select>

              <select
                value={
                  codeForm.calculationMethod
                }
                onChange={(event) =>
                  setCodeForm(
                    (current) => ({
                      ...current,
                      calculationMethod:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
              >
                <option value="PERCENTAGE">
                  Percentage
                </option>
                <option value="FIXED">
                  Fixed
                </option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.000001"
                value={
                  codeForm.defaultRate
                }
                onChange={(event) =>
                  setCodeForm(
                    (current) => ({
                      ...current,
                      defaultRate:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Default rate %"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  codeForm.recoverabilityRate
                }
                onChange={(event) =>
                  setCodeForm(
                    (current) => ({
                      ...current,
                      recoverabilityRate:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Recoverability %"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                [
                  "isInclusive",
                  "Tax inclusive",
                ],
                [
                  "isRecoverable",
                  "Recoverable",
                ],
                [
                  "isWithholding",
                  "Withholding",
                ],
                [
                  "isReverseCharge",
                  "Reverse charge",
                ],
                [
                  "isExempt",
                  "Exempt",
                ],
                [
                  "isZeroRated",
                  "Zero-rated",
                ],
              ].map(
                ([key, label]) => (
                  <label
                    key={
                      key
                    }
                    className="flex items-center gap-2 rounded-lg border border-[#ECECF3] p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={
                        Boolean(
                          codeForm[
                            key as keyof typeof codeForm
                          ],
                        )
                      }
                      onChange={(
                        event,
                      ) =>
                        setCodeForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            [key]:
                              event
                                .target
                                .checked,
                          }),
                        )
                      }
                    />

                    {
                      label
                    }
                  </label>
                ),
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
              <button
                type="button"
                onClick={() =>
                  setShowCodeForm(
                    false,
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create tax code"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          RATE MODAL
      ===================================================== */}

      {showRateForm && (
        <Modal
          title="Create Tax Rate"
          description="Create an effective-dated rate. Historical rates remain preserved."
          onClose={() =>
            setShowRateForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              handleCreateRate
            }
            className="space-y-4 p-6"
          >
            <select
              value={
                rateForm.taxCodeId
              }
              onChange={(event) =>
                setRateForm(
                  (current) => ({
                    ...current,
                    taxCodeId:
                      event.target
                        .value,
                  }),
                )
              }
              required
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                Select tax code
              </option>

              {data.codes.map(
                (code) => (
                  <option
                    key={
                      code.id
                    }
                    value={
                      code.id
                    }
                  >
                    {
                      code.code
                    }{" "}
                    —{" "}
                    {
                      code.name
                    }
                  </option>
                ),
              )}
            </select>

            <input
              value={
                rateForm.name
              }
              onChange={(event) =>
                setRateForm(
                  (current) => ({
                    ...current,
                    name: event
                      .target
                      .value,
                  }),
                )
              }
              placeholder="Rate name"
              required
              className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
            />

            <input
              type="number"
              min="0"
              max="100"
              step="0.000001"
              value={
                rateForm.rate
              }
              onChange={(event) =>
                setRateForm(
                  (current) => ({
                    ...current,
                    rate: event
                      .target
                      .value,
                  }),
                )
              }
              placeholder="Rate percentage"
              required
              className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                type="date"
                value={
                  rateForm.effectiveFrom
                }
                onChange={(event) =>
                  setRateForm(
                    (current) => ({
                      ...current,
                      effectiveFrom:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                type="date"
                value={
                  rateForm.effectiveTo
                }
                onChange={(event) =>
                  setRateForm(
                    (current) => ({
                      ...current,
                      effectiveTo:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                type="number"
                min="0"
                max="6"
                value={
                  rateForm.roundingScale
                }
                onChange={(event) =>
                  setRateForm(
                    (current) => ({
                      ...current,
                      roundingScale:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Rounding scale"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <select
                value={
                  rateForm.roundingMode
                }
                onChange={(event) =>
                  setRateForm(
                    (current) => ({
                      ...current,
                      roundingMode:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
              >
                <option value="HALF_UP">
                  HALF_UP
                </option>
                <option value="HALF_EVEN">
                  HALF_EVEN
                </option>
                <option value="DOWN">
                  DOWN
                </option>
                <option value="UP">
                  UP
                </option>
              </select>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
              <button
                type="button"
                onClick={() =>
                  setShowRateForm(
                    false,
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create rate"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          RULE MODAL
      ===================================================== */}

      {showRuleForm && (
        <Modal
          title="Create Tax Rule"
          description="Define priority-based tax determination conditions and actions."
          wide
          onClose={() =>
            setShowRuleForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              handleCreateRule
            }
            className="space-y-5 p-6"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <select
                value={
                  ruleForm.taxRegimeId
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      taxRegimeId:
                        event.target
                          .value,
                    }),
                  )
                }
                required
                className="rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
              >
                <option value="">
                  Select regime
                </option>

                {data.regimes.map(
                  (regime) => (
                    <option
                      key={
                        regime.id
                      }
                      value={
                        regime.id
                      }
                    >
                      {
                        regime.code
                      }
                    </option>
                  ),
                )}
              </select>

              <select
                value={
                  ruleForm.taxCodeId
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      taxCodeId:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
              >
                <option value="">
                  Default tax code
                </option>

                {data.codes.map(
                  (code) => (
                    <option
                      key={
                        code.id
                      }
                      value={
                        code.id
                      }
                    >
                      {
                        code.code
                      }{" "}
                      —{" "}
                      {
                        code.name
                      }
                    </option>
                  ),
                )}
              </select>

              <input
                type="number"
                min="1"
                value={
                  ruleForm.priority
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      priority:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Priority"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={
                  ruleForm.code
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      code: event
                        .target
                        .value
                        .toUpperCase(),
                    }),
                  )
                }
                placeholder="Rule code"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  ruleForm.name
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      name: event
                        .target
                        .value,
                    }),
                  )
                }
                placeholder="Rule name"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <input
                value={
                  ruleForm.transactionType
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      transactionType:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Transaction type"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  ruleForm.customerType
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      customerType:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Customer type"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  ruleForm.vendorType
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      vendorType:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Vendor type"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  ruleForm.supplyType
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      supplyType:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Supply type"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  ruleForm.jurisdiction
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      jurisdiction:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Jurisdiction"
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                type="date"
                value={
                  ruleForm.effectiveFrom
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      effectiveFrom:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                type="date"
                value={
                  ruleForm.effectiveTo
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      effectiveTo:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <textarea
                value={
                  ruleForm.conditions
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      conditions:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                rows={7}
                placeholder='Conditions JSON e.g. {"customerType":"BUSINESS"}'
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 font-mono text-xs"
              />

              <textarea
                value={
                  ruleForm.actions
                }
                onChange={(event) =>
                  setRuleForm(
                    (current) => ({
                      ...current,
                      actions:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                rows={7}
                placeholder='Actions JSON e.g. {"taxCode":"VAT16"}'
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
              <button
                type="button"
                onClick={() =>
                  setShowRuleForm(
                    false,
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create tax rule"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          MAPPING MODAL
      ===================================================== */}

      {showMappingForm && (
        <Modal
          title="Create Tax Account Mapping"
          description="Connect a tax code to the correct tenant GL account."
          onClose={() =>
            setShowMappingForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              handleCreateMapping
            }
            className="space-y-4 p-6"
          >
            <select
              value={
                mappingForm.taxCodeId
              }
              onChange={(event) =>
                setMappingForm(
                  (current) => ({
                    ...current,
                    taxCodeId:
                      event.target
                        .value,
                  }),
                )
              }
              required
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                Select tax code
              </option>

              {data.codes.map(
                (code) => (
                  <option
                    key={
                      code.id
                    }
                    value={
                      code.id
                    }
                  >
                    {
                      code.code
                    }{" "}
                    —{" "}
                    {
                      code.name
                    }
                  </option>
                ),
              )}
            </select>

            <select
              value={
                mappingForm.accountId
              }
              onChange={(event) =>
                setMappingForm(
                  (current) => ({
                    ...current,
                    accountId:
                      event.target
                        .value,
                  }),
                )
              }
              required
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                Select GL account
              </option>

              {data.accounts.map(
                (account) => (
                  <option
                    key={
                      account.id
                    }
                    value={
                      account.id
                    }
                  >
                    {
                      account.code
                    }{" "}
                    —{" "}
                    {
                      account.name
                    }
                  </option>
                ),
              )}
            </select>

            <select
              value={
                mappingForm.mappingType
              }
              onChange={(event) =>
                setMappingForm(
                  (current) => ({
                    ...current,
                    mappingType:
                      event.target
                        .value,
                  }),
                )
              }
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="OUTPUT_TAX">
                Output tax
              </option>
              <option value="INPUT_TAX">
                Input tax
              </option>
              <option value="RECOVERABLE_INPUT_TAX">
                Recoverable input tax
              </option>
              <option value="NON_RECOVERABLE_INPUT_TAX">
                Non-recoverable input tax
              </option>
              <option value="WITHHOLDING_TAX">
                Withholding tax
              </option>
              <option value="TAX_RECEIVABLE">
                Tax receivable
              </option>
              <option value="TAX_PAYABLE">
                Tax payable
              </option>
            </select>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                type="date"
                value={
                  mappingForm.effectiveFrom
                }
                onChange={(event) =>
                  setMappingForm(
                    (current) => ({
                      ...current,
                      effectiveFrom:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                type="date"
                value={
                  mappingForm.effectiveTo
                }
                onChange={(event) =>
                  setMappingForm(
                    (current) => ({
                      ...current,
                      effectiveTo:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  mappingForm.isDefault
                }
                onChange={(event) =>
                  setMappingForm(
                    (current) => ({
                      ...current,
                      isDefault:
                        event
                          .target
                          .checked,
                    }),
                  )
                }
              />

              Make this the default mapping
            </label>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
              <button
                type="button"
                onClick={() =>
                  setShowMappingForm(
                    false,
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create mapping"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          PERIOD MODAL
      ===================================================== */}

      {showPeriodForm && (
        <Modal
          title="Create Tax Period"
          description="Create a controlled reporting period for the selected tax regime."
          onClose={() =>
            setShowPeriodForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              handleCreatePeriod
            }
            className="space-y-4 p-6"
          >
            <select
              value={
                periodForm.taxRegimeId
              }
              onChange={(event) =>
                setPeriodForm(
                  (current) => ({
                    ...current,
                    taxRegimeId:
                      event.target
                        .value,
                  }),
                )
              }
              required
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                Select regime
              </option>

              {data.regimes.map(
                (regime) => (
                  <option
                    key={
                      regime.id
                    }
                    value={
                      regime.id
                    }
                  >
                    {
                      regime.code
                    }{" "}
                    —{" "}
                    {
                      regime.name
                    }
                  </option>
                ),
              )}
            </select>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                value={
                  periodForm.code
                }
                onChange={(event) =>
                  setPeriodForm(
                    (current) => ({
                      ...current,
                      code: event
                        .target
                        .value,
                    }),
                  )
                }
                placeholder="Period code e.g. 2026-10"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                value={
                  periodForm.name
                }
                onChange={(event) =>
                  setPeriodForm(
                    (current) => ({
                      ...current,
                      name: event
                        .target
                        .value,
                    }),
                  )
                }
                placeholder="Period name"
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                type="date"
                value={
                  periodForm.periodStart
                }
                onChange={(event) =>
                  setPeriodForm(
                    (current) => ({
                      ...current,
                      periodStart:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                type="date"
                value={
                  periodForm.periodEnd
                }
                onChange={(event) =>
                  setPeriodForm(
                    (current) => ({
                      ...current,
                      periodEnd:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                required
                className="rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />
            </div>

            <input
              type="date"
              value={
                periodForm.filingDueDate
              }
              onChange={(event) =>
                setPeriodForm(
                  (current) => ({
                    ...current,
                    filingDueDate:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
            />

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
              <button
                type="button"
                onClick={() =>
                  setShowPeriodForm(
                    false,
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create period"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          RETURN MODAL
      ===================================================== */}

      {showReturnForm && (
        <Modal
          title="Calculate Tax Return"
          description="The return is calculated from the tax transactions recorded against the selected period."
          onClose={() =>
            setShowReturnForm(
              false,
            )
          }
        >
          <form
            onSubmit={
              calculateReturn
            }
            className="space-y-4 p-6"
          >
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex gap-3">
                <ShieldCheck
                  size={20}
                  className="mt-0.5 text-blue-700"
                />

                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Return-first filing workflow
                  </p>

                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    Calculate the statutory return from the tax ledger, review it, approve it and only then create the filing.
                  </p>
                </div>
              </div>
            </div>

            <select
              value={
                returnForm.taxRegimeId
              }
              onChange={(event) => {
                const value =
                  event.target
                    .value;

                setReturnForm(
                  (current) => ({
                    ...current,
                    taxRegimeId:
                      value,
                    taxPeriodId:
                      "",
                  }),
                );
              }}
              required
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                Select tax regime
              </option>

              {data.regimes.map(
                (regime) => (
                  <option
                    key={
                      regime.id
                    }
                    value={
                      regime.id
                    }
                  >
                    {
                      regime.code
                    }{" "}
                    —{" "}
                    {
                      regime.name
                    }
                  </option>
                ),
              )}
            </select>

            <select
              value={
                returnForm.taxPeriodId
              }
              onChange={(event) =>
                setReturnForm(
                  (current) => ({
                    ...current,
                    taxPeriodId:
                      event.target
                        .value,
                  }),
                )
              }
              required
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                Select tax period
              </option>

              {data.periods
                .filter(
                  (period) =>
                    !returnForm.taxRegimeId ||
                    period.taxRegimeId ===
                      returnForm.taxRegimeId,
                )
                .map(
                  (period) => (
                    <option
                      key={
                        period.id
                      }
                      value={
                        period.id
                      }
                    >
                      {
                        period.code
                      }{" "}
                      —{" "}
                      {
                        period.name
                      }
                    </option>
                  ),
                )}
            </select>

            <select
              value={
                returnForm.returnType
              }
              onChange={(event) =>
                setReturnForm(
                  (current) => ({
                    ...current,
                    returnType:
                      event.target
                        .value,
                  }),
                )
              }
              className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
            >
              <option value="VAT">
                VAT
              </option>
              <option value="WITHHOLDING">
                Withholding
              </option>
              <option value="PAYE">
                PAYE
              </option>
              <option value="TURNOVER">
                Turnover Tax
              </option>
              <option value="OTHER">
                Other
              </option>
            </select>

            <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
              <button
                type="button"
                onClick={() =>
                  setShowReturnForm(
                    false,
                  )
                }
                className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving
                  ? "Calculating..."
                  : "Calculate return"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          PAYMENT MODAL
      ===================================================== */}

      {showPaymentForm &&
        selectedFiling && (
          <Modal
            title="Record Tax Payment"
            description={
              selectedFiling
                .obligation
                ?.name ||
              selectedFiling.taxObligationCode
            }
            onClose={() => {
              if (!saving) {
                setShowPaymentForm(
                  false,
                );
                setSelectedFiling(
                  null,
                );
              }
            }}
          >
            <form
              onSubmit={
                recordPayment
              }
              className="space-y-4 p-6"
            >
              <div className="rounded-xl bg-[#F7F8FA] p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#666B84]">
                    Total payable
                  </span>

                  <strong className="text-[#20243A]">
                    {currency(
                      selectedFiling.totalPayable,
                    )}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-[#666B84]">
                    Filing status
                  </span>

                  <Badge
                    value={
                      selectedFiling.filingStatus
                    }
                  />
                </div>
              </div>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={
                  paymentForm.amount
                }
                onChange={(event) =>
                  setPaymentForm(
                    (current) => ({
                      ...current,
                      amount:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Payment amount"
                required
                className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <input
                type="date"
                value={
                  paymentForm.paymentDate
                }
                onChange={(event) =>
                  setPaymentForm(
                    (current) => ({
                      ...current,
                      paymentDate:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                required
                className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <select
                value={
                  paymentForm.paymentMethod
                }
                onChange={(event) =>
                  setPaymentForm(
                    (current) => ({
                      ...current,
                      paymentMethod:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm"
              >
                <option value="BANK">
                  Bank
                </option>
                <option value="MPESA">
                  M-Pesa
                </option>
                <option value="CASH">
                  Cash
                </option>
                <option value="OTHER">
                  Other
                </option>
              </select>

              <input
                value={
                  paymentForm.paymentReference
                }
                onChange={(event) =>
                  setPaymentForm(
                    (current) => ({
                      ...current,
                      paymentReference:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                placeholder="Payment reference"
                className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <textarea
                value={
                  paymentForm.notes
                }
                onChange={(event) =>
                  setPaymentForm(
                    (current) => ({
                      ...current,
                      notes:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                rows={4}
                placeholder="Payment notes"
                className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm"
              />

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setShowPaymentForm(
                      false,
                    );
                    setSelectedFiling(
                      null,
                    );
                  }}
                  className="rounded-lg border border-[#DCDCE5] px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  disabled={saving}
                  className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Recording..."
                    : "Record payment"}
                </button>
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
}
