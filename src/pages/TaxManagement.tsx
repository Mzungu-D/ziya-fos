import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
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
import type { FormEvent, ReactNode } from "react";
import { authenticatedFetch } from "../lib/auth-session";

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

type TaxMapping = {
  id: string;
  taxCodeId: string;
  accountId: string;
  mappingType: string;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  taxCode?: TaxCode | null;
  account?: {
    id: string;
    code?: string;
    name?: string;
    type?: string;
  } | null;
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
  taxObligationId?: string | null;
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
  notes?: string | null;
  taxRegime?: TaxRegime | null;
  taxPeriod?: TaxPeriod | null;
};

type TaxTransaction = {
  id: string;
  taxCodeId: string;
  taxRateId?: string | null;
  taxRuleId?: string | null;
  taxPeriodId?: string | null;
  sourceType: string;
  sourceId: string;
  sourceLineId?: string | null;
  transactionDate: string;
  postingDate?: string | null;
  currency: string;
  exchangeRate?: string | number | null;
  taxableAmount: string | number;
  taxBaseAmount?: string | number;
  taxAmount: string | number;
  recoverableAmount: string | number;
  nonRecoverableAmount: string | number;
  direction: string;
  calculationMethod?: string | null;
  rateApplied: string | number;
  inclusive?: boolean;
  reverseCharge?: boolean;
  status: string;
  idempotencyKey?: string | null;
  description?: string | null;
  taxCode?: TaxCode | null;
  taxPeriod?: TaxPeriod | null;
};

type TaxPayment = {
  id: string;
  taxFilingId?: string | null;
  paymentReference?: string | null;
  paymentDate: string;
  amount: string | number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
};

type TaxFiling = {
  id: string;
  taxObligationCode: string;
  taxPeriodId?: string | null;
  taxReturnId?: string | null;
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
  obligation?: {
    name: string;
    taxType: string;
    currency: string;
  } | null;
  payments: TaxPayment[];
};

type TaxObligation = {
  id: string;
  code: string;
  taxType: string;
  name: string;
  registrationNumber?: string | null;
  filingFrequency: string;
  currency: string;
  isActive: boolean;
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
  accounts?: Array<{
    id: string;
    code: string;
    name: string;
    type?: string;
  }>;
};

type TaxApi<T> = {
  success: boolean;
  message?: string;
  data?: T;
  obligations?: TaxObligation[];
  filings?: TaxFiling[];
  payments?: TaxPayment[];
  pagination?: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
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

const tabs: Array<{
  id: Tab;
  label: string;
  icon: typeof FileText;
}> = [
  { id: "overview", label: "Overview", icon: Layers3 },
  { id: "regimes", label: "Tax Regimes", icon: Settings2 },
  { id: "codes", label: "Tax Codes", icon: SlidersHorizontal },
  { id: "rates", label: "Tax Rates", icon: ChevronRight },
  { id: "rules", label: "Tax Rules", icon: ShieldCheck },
  { id: "mappings", label: "Account Mapping", icon: BookOpen },
  { id: "periods", label: "Tax Periods", icon: CalendarDays },
  { id: "transactions", label: "Transactions", icon: FileCheck2 },
  { id: "returns", label: "Returns", icon: FileText },
  { id: "filings", label: "Filings", icon: FileText },
  { id: "payments", label: "Payments", icon: WalletCards },
];

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value: unknown, code = "KES"): string {
  const safeCurrency = /^[A-Z]{3}$/.test(code) ? code : "KES";

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function dateText(value?: string | null): string {
  if (!value) return "-";

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


function statusClass(value: string): string {
  const status = String(value || "").toUpperCase();

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
      "ERROR",
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

function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
        value,
      )}`}
    >
      {String(value || "-").replaceAll("_", " ")}
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
    <section className="overflow-hidden rounded-2xl border border-[#E7E9F0] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#ECECF3] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-[#20243A]">{title}</h2>

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
  action,
}: {
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="p-10 text-center">
      <FileText
        size={32}
        className="mx-auto text-[#A2A6B7]"
      />

      <p className="mt-3 font-medium text-[#20243A]">
        {label}
      </p>

      <p className="mt-1 text-sm text-[#666B84]">
        Configure this area to establish the tenant's tax control framework.
      </p>

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function FieldLabel({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#666B84]">
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
  max,
  step,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      step={step}
      className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
    />
  );
}

function Select({
  value,
  onChange,
  children,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="w-full rounded-lg border border-[#DCDCE5] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
    >
      {children}
    </select>
  );
}

function PrimaryButton({
  children,
  disabled = false,
  onClick,
  type = "submit",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B8177] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  disabled = false,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#DCDCE5] bg-white px-4 py-2.5 text-sm font-semibold text-[#4F556B] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export default function TaxManagement() {
  const [activeTab, setActiveTab] =
    useState<Tab>("overview");

  const [data, setData] =
    useState<TaxData>(EMPTY_DATA);

  const [filings, setFilings] =
    useState<TaxFiling[]>([]);

  const [payments, setPayments] =
    useState<TaxPayment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [showFiling, setShowFiling] =
    useState(false);

  const [showPayment, setShowPayment] =
    useState(false);

  const [showRule, setShowRule] =
    useState(false);

  const [showMapping, setShowMapping] =
    useState(false);

  const [selectedFiling, setSelectedFiling] =
    useState<TaxFiling | null>(null);

  const [selectedReturn, setSelectedReturn] =
    useState<TaxReturn | null>(null);

  const [regimeForm, setRegimeForm] =
    useState({
      code: "",
      name: "",
      taxType: "VAT",
      countryCode: "KE",
      currency: "KES",
      registrationNumber: "",
      description: "",
    });

  const [codeForm, setCodeForm] =
    useState({
      taxRegimeId: "",
      code: "",
      name: "",
      description: "",
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

  const [rateForm, setRateForm] =
    useState({
      taxCodeId: "",
      name: "",
      rate: "",
      effectiveFrom: "",
      effectiveTo: "",
      roundingScale: "2",
      roundingMode: "HALF_UP",
    });

  const [periodForm, setPeriodForm] =
    useState({
      taxRegimeId: "",
      code: "",
      name: "",
      periodStart: "",
      periodEnd: "",
      filingDueDate: "",
    });

  const [ruleForm, setRuleForm] =
    useState({
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

  const [mappingForm, setMappingForm] =
    useState({
      taxCodeId: "",
      accountId: "",
      mappingType: "OUTPUT_TAX",
      effectiveFrom: "",
      effectiveTo: "",
      isDefault: true,
    });

  const [paymentForm, setPaymentForm] =
    useState({
      amount: "",
      paymentDate: new Date()
        .toISOString()
        .slice(0, 10),
      paymentMethod: "BANK",
      paymentReference: "",
      notes: "",
    });

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  const request = async <T,>(
    url: string,
    options?: RequestInit,
  ): Promise<TaxApi<T>> => {
    const response = await authenticatedFetch(
      url,
      {
        credentials: "include",
        ...options,
      },
    );

    const result =
      (await response.json()) as TaxApi<T>;

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
          "The tax operation could not be completed.",
      );
    }

    return result;
  };

  const load = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      clearMessages();

      const [
        configResponse,
        filingResponse,
        paymentResponse,] = await Promise.all([
        request<TaxData>(
          "/api/tax/configuration",
        ),
        request<TaxFiling>(
          "/api/tax/filings?limit=100",
        ),
        request<TaxPayment>(
          "/api/tax/payments?limit=100",
        ),
        request<unknown>(
          "/api/tax/obligations",
        ),
      ]);

      setData(
        configResponse.data || EMPTY_DATA,
      );

      setFilings(
        filingResponse.filings || [],
      );

      setPayments(
        paymentResponse.payments || [],
      );

      const regimes =
        configResponse.data?.regimes || [];

      const codes =
        configResponse.data?.codes || [];

      if (
        !codeForm.taxRegimeId &&
        regimes.length
      ) {
        setCodeForm((current) => ({
          ...current,
          taxRegimeId: regimes[0].id,
        }));
      }

      if (
        !periodForm.taxRegimeId &&
        regimes.length
      ) {
        setPeriodForm((current) => ({
          ...current,
          taxRegimeId: regimes[0].id,
        }));
      }

      if (
        !ruleForm.taxRegimeId &&
        regimes.length
      ) {
        setRuleForm((current) => ({
          ...current,
          taxRegimeId: regimes[0].id,
        }));
      }

      if (
        !rateForm.taxCodeId &&
        codes.length
      ) {
        setRateForm((current) => ({
          ...current,
          taxCodeId: codes[0].id,
        }));
      }

      if (
        !mappingForm.taxCodeId &&
        codes.length
      ) {
        setMappingForm((current) => ({
          ...current,
          taxCodeId: codes[0].id,
        }));
      }
    } catch (err) {
      console.error(
        "[TAX UI] Failed to load tax workspace:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tax information.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeCodes = useMemo(
    () =>
      data.codes.filter(
        (item) => item.isActive,
      ),
    [data.codes],
  );

  const openPeriods = useMemo(
    () =>
      data.periods.filter(
        (item) =>
          item.status.toUpperCase() === "OPEN",
      ),
    [data.periods],
  );

  const overdueFilings = useMemo(() => {
    const now = Date.now();

    return filings.filter((item) => {
      const due =
        new Date(item.dueDate).getTime();

      return (
        Number.isFinite(due) &&
        due < now &&
        item.paymentStatus.toUpperCase() !==
          "PAID" &&
        item.filingStatus.toUpperCase() !==
          "SUBMITTED"
      );
    });
  }, [filings]);

  const unpaidFilings = useMemo(
    () =>
      filings.filter(
        (item) =>
          item.paymentStatus.toUpperCase() !==
          "PAID",
      ),
    [filings],
  );

  const unfiledApprovedReturns =
    useMemo(
      () =>
        data.returns.filter((item) =>
          ["APPROVED", "READY_TO_FILE"].includes(
            item.status.toUpperCase(),
          ),
        ),
      [data.returns],
    );

  const transactionsWithoutPeriods =
    useMemo(
      () =>
        data.transactions.filter(
          (item) => !item.taxPeriodId,
        ),
      [data.transactions],
    );

  const missingMappings = useMemo(() => {
    const mappedCodes = new Set(
      data.mappings.map(
        (mapping) => mapping.taxCodeId,
      ),
    );

    return activeCodes.filter(
      (code) =>
        !mappedCodes.has(code.id),
    );
  }, [activeCodes, data.mappings]);

  const outputTax = useMemo(
    () =>
      data.transactions
        .filter(
          (item) =>
            item.direction.toUpperCase() ===
            "OUTPUT",
        )
        .reduce(
          (sum, item) =>
            sum + numberValue(item.taxAmount),
          0,
        ),
    [data.transactions],
  );

  const inputTax = useMemo(
    () =>
      data.transactions
        .filter(
          (item) =>
            item.direction.toUpperCase() ===
            "INPUT",
        )
        .reduce(
          (sum, item) =>
            sum +
            numberValue(
              item.recoverableAmount,
            ),
          0,
        ),
    [data.transactions],
  );

  const withholdingTax = useMemo(
    () =>
      data.transactions
        .filter(
          (item) =>
            item.direction.toUpperCase() ===
            "WITHHOLDING",
        )
        .reduce(
          (sum, item) =>
            sum + numberValue(item.taxAmount),
          0,
        ),
    [data.transactions],
  );

  const outstanding = useMemo(
    () =>
      unpaidFilings.reduce(
        (sum, item) =>
          sum + numberValue(item.totalPayable),
        0,
      ),
    [unpaidFilings],
  );

  const netTaxPosition =
    outputTax -
    inputTax -
    withholdingTax;

  const complianceIssues =
    overdueFilings.length +
    unfiledApprovedReturns.length +
    missingMappings.length +
    transactionsWithoutPeriods.length;

  const complianceStatus =
    complianceIssues === 0
      ? "GOOD"
      : complianceIssues <= 3
        ? "ATTENTION"
        : "ACTION_REQUIRED";

  const post = async (
    url: string,
    body: unknown,
  ) => {
    return request<unknown>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  };

  const patch = async (
    url: string,
    body: unknown,
  ) => {
    return request<unknown>(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  };

  const submitConfiguration = async (
    event: FormEvent<HTMLFormElement>,
    type:
      | "regime"
      | "code"
      | "rate"
      | "period"
      | "rule"
      | "mapping",
  ) => {
    event.preventDefault();

    try {
      setSaving(true);
      clearMessages();

      if (type === "regime") {
        await post(
          "/api/tax/regimes",
          regimeForm,
        );

        setRegimeForm({
          code: "",
          name: "",
          taxType: "VAT",
          countryCode: "KE",
          currency: "KES",
          registrationNumber: "",
          description: "",
        });
      }

      if (type === "code") {
        await post("/api/tax/codes", {
          ...codeForm,
          defaultRate: Number(
            codeForm.defaultRate || 0,
          ),
          recoverabilityRate: Number(
            codeForm.recoverabilityRate || 0,
          ),
        });

        setCodeForm((current) => ({
          ...current,
          code: "",
          name: "",
          description: "",
          defaultRate: "",
        }));
      }

      if (type === "rate") {
        await post("/api/tax/rates", {
          ...rateForm,
          rate: Number(rateForm.rate || 0),
          roundingScale: Number(
            rateForm.roundingScale || 2,
          ),
          effectiveTo:
            rateForm.effectiveTo || null,
        });

        setRateForm((current) => ({
          ...current,
          name: "",
          rate: "",
          effectiveFrom: "",
          effectiveTo: "",
        }));
      }

      if (type === "period") {
        await post("/api/tax/periods", {
          ...periodForm,
          filingDueDate:
            periodForm.filingDueDate || null,
        });

        setPeriodForm((current) => ({
          ...current,
          code: "",
          name: "",
          periodStart: "",
          periodEnd: "",
          filingDueDate: "",
        }));
      }

      if (type === "rule") {
        let conditions: unknown;
        let actions: unknown;

        try {
          conditions = JSON.parse(
            ruleForm.conditions || "{}",
          );
          actions = JSON.parse(
            ruleForm.actions || "{}",
          );
        } catch {
          throw new Error(
            "Conditions and actions must contain valid JSON.",
          );
        }

        await post("/api/tax/rules", {
          ...ruleForm,
          taxCodeId:
            ruleForm.taxCodeId || null,
          priority: Number(
            ruleForm.priority || 100,
          ),
          conditions,
          actions,
          effectiveTo:
            ruleForm.effectiveTo || null,
        });

        setRuleForm((current) => ({
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
        }));

        setShowRule(false);
      }

      if (type === "mapping") {
        await post("/api/tax/mappings", {
          ...mappingForm,
          effectiveTo:
            mappingForm.effectiveTo || null,
        });

        setMappingForm((current) => ({
          ...current,
          accountId: "",
          effectiveFrom: "",
          effectiveTo: "",
          isDefault: true,
        }));

        setShowMapping(false);
      }

      setNotice(
        "Tax configuration saved successfully.",
      );

      await load(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save tax configuration.",
      );
    } finally {
      setSaving(false);
    }
  };

  const calculateReturn = async (
    period: TaxPeriod,
  ) => {
    try {
      setSaving(true);
      clearMessages();

      await post(
        "/api/tax/returns/calculate",
        {
          taxPeriodId: period.id,
        },
      );

      setActiveTab("returns");

      setNotice(
        `Tax return calculation completed for ${period.code}.`,
      );

      await load(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to calculate the tax return.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateReturnStatus = async (
    taxReturn: TaxReturn,
    status: string,
  ) => {
    try {
      setSaving(true);
      clearMessages();

      await patch(
        `/api/tax/returns/${taxReturn.id}/status`,
        {
          status,
        },
      );

      setNotice(
        `Tax return moved to ${status.replaceAll(
          "_",
          " ",
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
    async (taxReturn: TaxReturn) => {
      try {
        setSaving(true);
        clearMessages();

        await post(
          `/api/tax/returns/${taxReturn.id}/create-filing`,
          {},
        );

        setNotice(
          "Statutory filing created from the approved tax return.",
        );

        setActiveTab("filings");

        await load(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create the tax filing.",
        );
      } finally {
        setSaving(false);
      }
    };

  const updatePeriodStatus = async (
    period: TaxPeriod,
    status: string,
  ) => {
    try {
      setSaving(true);
      clearMessages();

      await patch(
        `/api/tax/periods/${period.id}/status`,
        {
          status,
        },
      );

      setNotice(
        `Tax period ${period.code} is now ${status.replaceAll(
          "_",
          " ",
        )}.`,
      );

      await load(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the tax period.",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitFiling = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError(
      "Manual filing creation is restricted. Calculate and approve a tax return, then create the filing from that return.",
    );
  };

  const submitPayment = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedFiling) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const amount = Number(
        paymentForm.amount || 0,
      );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "Enter a valid payment amount.",
        );
      }

      if (
        amount >
        numberValue(
          selectedFiling.totalPayable,
        )
      ) {
        throw new Error(
          "Payment amount cannot exceed the filing's total payable amount.",
        );
      }

      await post("/api/tax/payments", {
        taxFilingId: selectedFiling.id,
        amount,
        paymentDate:
          paymentForm.paymentDate,
        paymentMethod:
          paymentForm.paymentMethod,
        paymentReference:
          paymentForm.paymentReference.trim() ||
          null,
        notes:
          paymentForm.notes.trim() || null,
      });

      setShowPayment(false);
      setSelectedFiling(null);

      setNotice(
        "Tax payment recorded successfully.",
      );

      await load(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to record the payment.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (
    filing: TaxFiling,
  ) => {
    setSelectedFiling(filing);

    setPaymentForm({
      amount: "",
      paymentDate: new Date()
        .toISOString()
        .slice(0, 10),
      paymentMethod: "BANK",
      paymentReference: "",
      notes: "",
    });

    setShowPayment(true);
  };

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Active Tax Codes",
            value: activeCodes.length,
            icon: SlidersHorizontal,
          },
          {
            label: "Open Periods",
            value: openPeriods.length,
            icon: CalendarDays,
          },
          {
            label: "Outstanding Liability",
            value: currency(outstanding),
            icon: WalletCards,
          },
          {
            label: "Compliance",
            value:
              complianceStatus === "GOOD"
                ? "Good"
                : complianceStatus ===
                    "ATTENTION"
                  ? "Attention"
                  : "Action Required",
            icon:
              complianceIssues === 0
                ? CheckCircle2
                : AlertTriangle,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-[#E7E9F0] bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#666B84]">
                  {item.label}
                </p>

                <Icon
                  size={19}
                  className="text-[#0D9488]"
                />
              </div>

              <p className="mt-3 text-3xl font-bold tracking-tight text-[#20243A]">
                {item.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel
          title="Tax Position"
          description="Tax activity recorded in the tenant tax ledger."
        >
          <div className="space-y-4 p-5">
            <div className="flex justify-between text-sm">
              <span className="text-[#666B84]">
                Output tax
              </span>

              <strong className="text-[#20243A]">
                {currency(outputTax)}
              </strong>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-[#666B84]">
                Recoverable input tax
              </span>

              <strong className="text-[#20243A]">
                {currency(inputTax)}
              </strong>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-[#666B84]">
                Withholding tax
              </span>

              <strong className="text-[#20243A]">
                {currency(withholdingTax)}
              </strong>
            </div>

            <div className="flex justify-between border-t border-[#ECECF3] pt-4 text-sm">
              <span className="font-medium text-[#20243A]">
                Net tax position
              </span>

              <strong
                className={
                  netTaxPosition >= 0
                    ? "text-[#0D9488]"
                    : "text-red-600"
                }
              >
                {currency(netTaxPosition)}
              </strong>
            </div>
          </div>
        </Panel>

        <Panel
          title="Compliance Controls"
          description="Controls that require attention before filing."
        >
          <div className="space-y-3 p-5">
            <button
              type="button"
              onClick={() =>
                setActiveTab("filings")
              }
              className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-3 text-left hover:bg-[#FAFAFC]"
            >
              <span>
                <span className="block text-sm font-semibold text-[#20243A]">
                  Overdue filings
                </span>

                <span className="text-xs text-[#666B84]">
                  Statutory submissions past due
                </span>
              </span>

              <strong className="text-red-600">
                {overdueFilings.length}
              </strong>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("returns")
              }
              className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-3 text-left hover:bg-[#FAFAFC]"
            >
              <span>
                <span className="block text-sm font-semibold text-[#20243A]">
                  Returns ready to file
                </span>

                <span className="text-xs text-[#666B84]">
                  Approved returns awaiting filing
                </span>
              </span>

              <strong className="text-[#0D9488]">
                {unfiledApprovedReturns.length}
              </strong>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("mappings")
              }
              className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-3 text-left hover:bg-[#FAFAFC]"
            >
              <span>
                <span className="block text-sm font-semibold text-[#20243A]">
                  Missing mappings
                </span>

                <span className="text-xs text-[#666B84]">
                  Active tax codes without accounts
                </span>
              </span>

              <strong
                className={
                  missingMappings.length
                    ? "text-red-600"
                    : "text-[#0D9488]"
                }
              >
                {missingMappings.length}
              </strong>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("transactions")
              }
              className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-3 text-left hover:bg-[#FAFAFC]"
            >
              <span>
                <span className="block text-sm font-semibold text-[#20243A]">
                  Unassigned tax transactions
                </span>

                <span className="text-xs text-[#666B84]">
                  Transactions without a tax period
                </span>
              </span>

              <strong
                className={
                  transactionsWithoutPeriods.length
                    ? "text-red-600"
                    : "text-[#0D9488]"
                }
              >
                {transactionsWithoutPeriods.length}
              </strong>
            </button>
          </div>
        </Panel>

        <Panel
          title="Upcoming Compliance"
          description="Filing and return activity requiring action."
        >
          {overdueFilings.length ? (
            <div className="space-y-3 p-5">
              {overdueFilings
                .slice(0, 5)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab("filings");
                      openPayment(item);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-red-100 bg-red-50 p-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-[#20243A]">
                        {item.obligation?.name ||
                          item.taxObligationCode}
                      </span>

                      <span className="text-xs text-red-700">
                        Due{" "}
                        {dateText(
                          item.dueDate,
                        )}
                      </span>
                    </span>

                    <ChevronRight
                      size={17}
                      className="text-red-700"
                    />
                  </button>
                ))}
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
                The current filing register has no overdue submissions.
              </p>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Tax Control Framework"
        description="Current configuration coverage."
      >
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Regimes", data.regimes.length],
            ["Tax Codes", data.codes.length],
            ["Rates", data.rates.length],
            ["Rules", data.rules.length],
            ["Mappings", data.mappings.length],
            ["Periods", data.periods.length],
          ].map(([label, value]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => {
                const mapping: Record<
                  string,
                  Tab
                > = {
                  Regimes: "regimes",
                  "Tax Codes": "codes",
                  Rates: "rates",
                  Rules: "rules",
                  Mappings: "mappings",
                  Periods: "periods",
                };

                setActiveTab(
                  mapping[String(label)],
                );
              }}
              className="rounded-xl border border-[#ECECF3] p-4 text-left hover:bg-[#FAFAFC]"
            >
              <p className="text-xs text-[#666B84]">
                {label}
              </p>

              <p className="mt-2 text-2xl font-bold text-[#20243A]">
                {value}
              </p>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );

  const renderRegimes = () => (
    <Panel
      title="Tax Regimes"
      description="Top-level statutory frameworks grouping tax codes, rates, rules, periods and reporting."
      action={
        <span className="rounded-full bg-[#F4F6F8] px-3 py-1 text-xs font-semibold text-[#666B84]">
          {data.regimes.length}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_380px]">
        <div className="overflow-x-auto rounded-xl border border-[#ECECF3]">
          <table className="w-full min-w-[760px]">
            <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
              <tr>
                <th className="p-4">Code</th>
                <th className="p-4">Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Registration</th>
                <th className="p-4">Currency</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {data.regimes.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4 font-semibold text-[#20243A]">
                      {item.code}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {item.name}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {item.taxType}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {item.registrationNumber ||
                        "-"}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {item.currency}
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

              {!data.regimes.length && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState label="No tax regimes configured" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={(event) =>
            void submitConfiguration(
              event,
              "regime",
            )
          }
          className="space-y-4 rounded-xl border border-[#ECECF3] p-4"
        >
          <div>
            <p className="font-semibold text-[#20243A]">
              Add tax regime
            </p>

            <p className="mt-1 text-xs text-[#666B84]">
              Create the statutory framework that will contain tax codes and periods.
            </p>
          </div>

          <div>
            <FieldLabel>Code</FieldLabel>

            <Input
              value={regimeForm.code}
              onChange={(value) =>
                setRegimeForm((current) => ({
                  ...current,
                  code: value.toUpperCase(),
                }))
              }
              placeholder="VAT"
              required
            />
          </div>

          <div>
            <FieldLabel>Name</FieldLabel>

            <Input
              value={regimeForm.name}
              onChange={(value) =>
                setRegimeForm((current) => ({
                  ...current,
                  name: value,
                }))
              }
              placeholder="Value Added Tax"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Tax Type</FieldLabel>

              <Input
                value={regimeForm.taxType}
                onChange={(value) =>
                  setRegimeForm((current) => ({
                    ...current,
                    taxType: value,
                  }))
                }
                placeholder="VAT"
                required
              />
            </div>

            <div>
              <FieldLabel>Country</FieldLabel>

              <Input
                value={regimeForm.countryCode}
                onChange={(value) =>
                  setRegimeForm((current) => ({
                    ...current,
                    countryCode:
                      value.toUpperCase(),
                  }))
                }
                placeholder="KE"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Currency</FieldLabel>

              <Input
                value={regimeForm.currency}
                onChange={(value) =>
                  setRegimeForm((current) => ({
                    ...current,
                    currency:
                      value.toUpperCase(),
                  }))
                }
                placeholder="KES"
                required
              />
            </div>

            <div>
              <FieldLabel>Registration</FieldLabel>

              <Input
                value={
                  regimeForm.registrationNumber
                }
                onChange={(value) =>
                  setRegimeForm((current) => ({
                    ...current,
                    registrationNumber:
                      value,
                  }))
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>

            <textarea
              value={regimeForm.description}
              onChange={(event) =>
                setRegimeForm((current) => ({
                  ...current,
                  description:
                    event.target.value,
                }))
              }
              rows={3}
              placeholder="Statutory tax framework description"
              className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm outline-none focus:border-[#0D9488]"
            />
          </div>

          <PrimaryButton disabled={saving}>
            <Plus size={16} />
            Create regime
          </PrimaryButton>
        </form>
      </div>
    </Panel>
  );

  const renderCodes = () => (
    <Panel
      title="Tax Codes"
      description="Transaction-level tax treatments controlling direction, calculation, recoverability and special treatment."
    >
      <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_440px]">
        <div className="overflow-x-auto rounded-xl border border-[#ECECF3]">
          <table className="w-full min-w-[1050px]">
            <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
              <tr>
                <th className="p-4">Code</th>
                <th className="p-4">Name</th>
                <th className="p-4">Regime</th>
                <th className="p-4">Direction</th>
                <th className="p-4">Rate</th>
                <th className="p-4">Treatment</th>
                <th className="p-4">Recovery</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {data.codes.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4 font-semibold text-[#20243A]">
                      {item.code}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {item.name}
                    </td>

                    <td className="p-4">
                      {item.taxRegime?.code ||
                        item.taxRegimeId}
                    </td>

                    <td className="p-4">
                      {item.direction}
                    </td>

                    <td className="p-4">
                      {numberValue(
                        item.defaultRate,
                      )}
                      %
                    </td>

                    <td className="p-4">
                      {item.isExempt
                        ? "EXEMPT"
                        : item.isZeroRated
                          ? "ZERO-RATED"
                          : item.isReverseCharge
                            ? "REVERSE CHARGE"
                            : item.treatment}
                    </td>

                    <td className="p-4">
                      {item.isRecoverable
                        ? `${numberValue(
                            item.recoverabilityRate,
                          )}%`
                        : "No"}
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

              {!data.codes.length && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState label="No tax codes configured" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={(event) =>
            void submitConfiguration(
              event,
              "code",
            )
          }
          className="space-y-4 rounded-xl border border-[#ECECF3] p-4"
        >
          <p className="font-semibold text-[#20243A]">
            Add tax code
          </p>

          <div>
            <FieldLabel>Tax Regime</FieldLabel>

            <Select
              value={codeForm.taxRegimeId}
              onChange={(value) =>
                setCodeForm((current) => ({
                  ...current,
                  taxRegimeId: value,
                }))
              }
              required
            >
              <option value="">
                Select regime
              </option>

              {data.regimes.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.code} — {item.name}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Code</FieldLabel>

              <Input
                value={codeForm.code}
                onChange={(value) =>
                  setCodeForm((current) => ({
                    ...current,
                    code: value.toUpperCase(),
                  }))
                }
                placeholder="VAT-16"
                required
              />
            </div>

            <div>
              <FieldLabel>Default Rate %</FieldLabel>

              <Input
                type="number"
                min="0"
                max="100"
                step="0.000001"
                value={codeForm.defaultRate}
                onChange={(value) =>
                  setCodeForm((current) => ({
                    ...current,
                    defaultRate: value,
                  }))
                }
                placeholder="16"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Name</FieldLabel>

            <Input
              value={codeForm.name}
              onChange={(value) =>
                setCodeForm((current) => ({
                  ...current,
                  name: value,
                }))
              }
              placeholder="Standard VAT 16%"
              required
            />
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>

            <Input
              value={codeForm.description}
              onChange={(value) =>
                setCodeForm((current) => ({
                  ...current,
                  description: value,
                }))
              }
              placeholder="Tax treatment description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Direction</FieldLabel>

              <Select
                value={codeForm.direction}
                onChange={(value) =>
                  setCodeForm((current) => ({
                    ...current,
                    direction: value,
                  }))
                }
              >
                <option value="OUTPUT">
                  OUTPUT
                </option>
                <option value="INPUT">
                  INPUT
                </option>
                <option value="WITHHOLDING">
                  WITHHOLDING
                </option>
              </Select>
            </div>

            <div>
              <FieldLabel>Calculation</FieldLabel>

              <Select
                value={
                  codeForm.calculationMethod
                }
                onChange={(value) =>
                  setCodeForm((current) => ({
                    ...current,
                    calculationMethod:
                      value,
                  }))
                }
              >
                <option value="PERCENTAGE">
                  PERCENTAGE
                </option>
                <option value="FIXED">
                  FIXED
                </option>
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel>Treatment</FieldLabel>

            <Select
              value={codeForm.treatment}
              onChange={(value) =>
                setCodeForm((current) => ({
                  ...current,
                  treatment: value,
                }))
              }
            >
              <option value="STANDARD">
                STANDARD
              </option>
              <option value="EXEMPT">
                EXEMPT
              </option>
              <option value="ZERO_RATED">
                ZERO RATED
              </option>
              <option value="REVERSE_CHARGE">
                REVERSE CHARGE
              </option>
              <option value="WITHHOLDING">
                WITHHOLDING
              </option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-[#4F556B]">
              <input
                type="checkbox"
                checked={codeForm.isInclusive}
                onChange={(event) =>
                  setCodeForm((current) => ({
                    ...current,
                    isInclusive:
                      event.target.checked,
                  }))
                }
              />
              Tax inclusive
            </label>

            <label className="flex items-center gap-2 text-sm text-[#4F556B]">
              <input
                type="checkbox"
                checked={
                  codeForm.isRecoverable
                }
                onChange={(event) =>
                  setCodeForm((current) => ({
                    ...current,
                    isRecoverable:
                      event.target.checked,
                  }))
                }
              />
              Recoverable
            </label>

            <label className="flex items-center gap-2 text-sm text-[#4F556B]">
              <input
                type="checkbox"
                checked={
                  codeForm.isReverseCharge
                }
                onChange={(event) =>
                  setCodeForm((current) => ({
                    ...current,
                    isReverseCharge:
                      event.target.checked,
                  }))
                }
              />
              Reverse charge
            </label>

            <label className="flex items-center gap-2 text-sm text-[#4F556B]">
              <input
                type="checkbox"
                checked={
                  codeForm.isWithholding
                }
                onChange={(event) =>
                  setCodeForm((current) => ({
                    ...current,
                    isWithholding:
                      event.target.checked,
                  }))
                }
              />
              Withholding
            </label>

            <label className="flex items-center gap-2 text-sm text-[#4F556B]">
              <input
                type="checkbox"
                checked={codeForm.isExempt}
                onChange={(event) =>
                  setCodeForm((current) => ({
                    ...current,
                    isExempt:
                      event.target.checked,
                  }))
                }
              />
              Exempt
            </label>

            <label className="flex items-center gap-2 text-sm text-[#4F556B]">
              <input
                type="checkbox"
                checked={
                  codeForm.isZeroRated
                }
                onChange={(event) =>
                  setCodeForm((current) => ({
                    ...current,
                    isZeroRated:
                      event.target.checked,
                  }))
                }
              />
              Zero rated
            </label>
          </div>

          {codeForm.isRecoverable && (
            <div>
              <FieldLabel>
                Recoverability %
              </FieldLabel>

              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  codeForm.recoverabilityRate
                }
                onChange={(value) =>
                  setCodeForm((current) => ({
                    ...current,
                    recoverabilityRate:
                      value,
                  }))
                }
              />
            </div>
          )}

          <PrimaryButton disabled={saving}>
            <Plus size={16} />
            Create tax code
          </PrimaryButton>
        </form>
      </div>
    </Panel>
  );

  const renderRates = () => (
    <Panel
      title="Tax Rates"
      description="Effective-dated rates preserve historical accuracy and prevent retroactive rate changes."
    >
      <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_400px]">
        <div className="overflow-x-auto rounded-xl border border-[#ECECF3]">
          <table className="w-full min-w-[850px]">
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
              {data.rates.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4 font-semibold text-[#20243A]">
                      {item.taxCode?.code ||
                        item.taxCodeId}
                    </td>

                    <td className="p-4">
                      {numberValue(item.rate)}%
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {dateText(
                        item.effectiveFrom,
                      )}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {dateText(
                        item.effectiveTo,
                      )}
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {item.roundingScale} /{" "}
                      {item.roundingMode}
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

              {!data.rates.length && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState label="No tax rates configured" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={(event) =>
            void submitConfiguration(
              event,
              "rate",
            )
          }
          className="space-y-4 rounded-xl border border-[#ECECF3] p-4"
        >
          <p className="font-semibold text-[#20243A]">
            Add effective-dated rate
          </p>

          <div>
            <FieldLabel>Tax Code</FieldLabel>

            <Select
              value={rateForm.taxCodeId}
              onChange={(value) =>
                setRateForm((current) => ({
                  ...current,
                  taxCodeId: value,
                }))
              }
              required
            >
              <option value="">
                Select tax code
              </option>

              {data.codes.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.code} — {item.name}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div>
            <FieldLabel>
              Rate Name
            </FieldLabel>

            <Input
              value={rateForm.name}
              onChange={(value) =>
                setRateForm((current) => ({
                  ...current,
                  name: value,
                }))
              }
              placeholder="Standard 16%"
              required
            />
          </div>

          <div>
            <FieldLabel>
              Rate %
            </FieldLabel>

            <Input
              type="number"
              min="0"
              max="100"
              step="0.000001"
              value={rateForm.rate}
              onChange={(value) =>
                setRateForm((current) => ({
                  ...current,
                  rate: value,
                }))
              }
              placeholder="16"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>
                Effective From
              </FieldLabel>

              <Input
                type="date"
                value={
                  rateForm.effectiveFrom
                }
                onChange={(value) =>
                  setRateForm((current) => ({
                    ...current,
                    effectiveFrom:
                      value,
                  }))
                }
                required
              />
            </div>

            <div>
              <FieldLabel>
                Effective To
              </FieldLabel>

              <Input
                type="date"
                value={
                  rateForm.effectiveTo
                }
                onChange={(value) =>
                  setRateForm((current) => ({
                    ...current,
                    effectiveTo:
                      value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>
                Decimal Scale
              </FieldLabel>

              <Input
                type="number"
                min="0"
                max="6"
                step="1"
                value={
                  rateForm.roundingScale
                }
                onChange={(value) =>
                  setRateForm((current) => ({
                    ...current,
                    roundingScale:
                      value,
                  }))
                }
              />
            </div>

            <div>
              <FieldLabel>
                Rounding Mode
              </FieldLabel>

              <Select
                value={
                  rateForm.roundingMode
                }
                onChange={(value) =>
                  setRateForm((current) => ({
                    ...current,
                    roundingMode:
                      value,
                  }))
                }
              >
                <option value="HALF_UP">
                  HALF UP
                </option>
                <option value="HALF_EVEN">
                  HALF EVEN
                </option>
                <option value="DOWN">
                  DOWN
                </option>
                <option value="UP">
                  UP
                </option>
              </Select>
            </div>
          </div>

          <PrimaryButton disabled={saving}>
            <Plus size={16} />
            Create rate
          </PrimaryButton>
        </form>
      </div>
    </Panel>
  );

  const renderRules = () => (
    <Panel
      title="Tax Rules"
      description="Priority-based tax determination rules using transaction, party, supply and jurisdiction attributes."
      action={
        <PrimaryButton
          type="button"
          onClick={() => {
            setRuleForm((current) => ({
              ...current,
              taxRegimeId:
                current.taxRegimeId ||
                data.regimes[0]?.id ||
                "",
            }));

            setShowRule(true);
          }}
        >
          <Plus size={16} />
          Add rule
        </PrimaryButton>
      }
    >
      {data.rules.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead className="bg-[#FAFAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
              <tr>
                <th className="p-4">
                  Priority
                </th>
                <th className="p-4">Code</th>
                <th className="p-4">Rule</th>
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
              {data.rules.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4 font-semibold">
                      {item.priority}
                    </td>

                    <td className="p-4 font-semibold text-[#20243A]">
                      {item.code}
                    </td>

                    <td className="p-4">
                      {item.name}
                    </td>

                    <td className="p-4">
                      {item.taxCode?.code ||
                        "Default"}
                    </td>

                    <td className="p-4 text-xs text-[#666B84]">
                      {[
                        item.transactionType,
                        item.customerType,
                        item.vendorType,
                        item.supplyType,
                        item.jurisdiction,
                      ]
                        .filter(Boolean)
                        .join(" • ") ||
                        "General"}
                    </td>

                    <td className="p-4">
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
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          label="No tax determination rules configured"
          action={
            <PrimaryButton
              type="button"
              onClick={() =>
                setShowRule(true)
              }
            >
              <Plus size={16} />
              Create first rule
            </PrimaryButton>
          }
        />
      )}
    </Panel>
  );

  const renderMappings = () => (
    <Panel
      title="Tax Account Mapping"
      description="Maps tax treatments to tenant-specific ledger accounts for controlled accounting and reporting."
      action={
        <PrimaryButton
          type="button"
          onClick={() =>
            setShowMapping(true)
          }
        >
          <Plus size={16} />
          Add mapping
        </PrimaryButton>
      }
    >
      {data.mappings.length ? (
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
                  Effective From
                </th>
                <th className="p-4">
                  Effective To
                </th>
                <th className="p-4">
                  Default
                </th>
              </tr>
            </thead>

            <tbody>
              {data.mappings.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4 font-semibold">
                      {item.taxCode?.code ||
                        item.taxCodeId}
                    </td>

                    <td className="p-4">
                      {item.mappingType}
                    </td>

                    <td className="p-4">
                      {item.account?.code
                        ? `${item.account.code} — ${
                            item.account.name || ""
                          }`
                        : item.accountId}
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
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          label="No tax account mappings configured"
          action={
            <PrimaryButton
              type="button"
              onClick={() =>
                setShowMapping(true)
              }
            >
              <Plus size={16} />
              Create first mapping
            </PrimaryButton>
          }
        />
      )}
    </Panel>
  );

  const renderPeriods = () => (
    <Panel
      title="Tax Periods"
      description="Statutory tax periods with controlled lifecycle from open through review, filing and close."
    >
      <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_400px]">
        <div className="overflow-x-auto rounded-xl border border-[#ECECF3]">
          <table className="w-full min-w-[950px]">
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
                  Filing Due
                </th>
                <th className="p-4">
                  Status
                </th>
                <th className="p-4">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {data.periods.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4 font-semibold">
                      {item.code}
                    </td>

                    <td className="p-4">
                      {item.taxRegime?.code ||
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
                        value={item.status}
                      />
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {item.status ===
                          "OPEN" && (
                          <>
                            <SecondaryButton
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void calculateReturn(
                                  item,
                                )
                              }
                            >
                              Calculate return
                            </SecondaryButton>

                            <SecondaryButton
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void updatePeriodStatus(
                                  item,
                                  "UNDER_REVIEW",
                                )
                              }
                            >
                              Review
                            </SecondaryButton>
                          </>
                        )}

                        {item.status ===
                          "UNDER_REVIEW" && (
                          <SecondaryButton
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void updatePeriodStatus(
                                item,
                                "READY_TO_FILE",
                              )
                            }
                          >
                            Ready to file
                          </SecondaryButton>
                        )}

                        {item.status ===
                          "READY_TO_FILE" && (
                          <SecondaryButton
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void updatePeriodStatus(
                                item,
                                "CLOSED",
                              )
                            }
                          >
                            Close period
                          </SecondaryButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}

              {!data.periods.length && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState label="No tax periods configured" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={(event) =>
            void submitConfiguration(
              event,
              "period",
            )
          }
          className="space-y-4 rounded-xl border border-[#ECECF3] p-4"
        >
          <p className="font-semibold text-[#20243A]">
            Create tax period
          </p>

          <div>
            <FieldLabel>
              Tax Regime
            </FieldLabel>

            <Select
              value={
                periodForm.taxRegimeId
              }
              onChange={(value) =>
                setPeriodForm((current) => ({
                  ...current,
                  taxRegimeId: value,
                }))
              }
              required
            >
              <option value="">
                Select regime
              </option>

              {data.regimes.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.code} — {item.name}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>
                Period Code
              </FieldLabel>

              <Input
                value={periodForm.code}
                onChange={(value) =>
                  setPeriodForm((current) => ({
                    ...current,
                    code: value,
                  }))
                }
                placeholder="2026-10"
                required
              />
            </div>

            <div>
              <FieldLabel>
                Name
              </FieldLabel>

              <Input
                value={periodForm.name}
                onChange={(value) =>
                  setPeriodForm((current) => ({
                    ...current,
                    name: value,
                  }))
                }
                placeholder="October 2026"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>
                Period Start
              </FieldLabel>

              <Input
                type="date"
                value={
                  periodForm.periodStart
                }
                onChange={(value) =>
                  setPeriodForm((current) => ({
                    ...current,
                    periodStart: value,
                  }))
                }
                required
              />
            </div>

            <div>
              <FieldLabel>
                Period End
              </FieldLabel>

              <Input
                type="date"
                value={
                  periodForm.periodEnd
                }
                onChange={(value) =>
                  setPeriodForm((current) => ({
                    ...current,
                    periodEnd: value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div>
            <FieldLabel>
              Filing Due Date
            </FieldLabel>

            <Input
              type="date"
              value={
                periodForm.filingDueDate
              }
              onChange={(value) =>
                setPeriodForm((current) => ({
                  ...current,
                  filingDueDate: value,
                }))
              }
            />
          </div>

          <PrimaryButton disabled={saving}>
            <Plus size={16} />
            Create period
          </PrimaryButton>
        </form>
      </div>
    </Panel>
  );

  const renderTransactions = () => (
    <Panel
      title="Tax Transactions"
      description="Tax events used for determination, accounting, reconciliation and return preparation."
    >
      {data.transactions.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px]">
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
                  Period
                </th>
                <th className="p-4">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {data.transactions.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4">
                      {dateText(
                        item.transactionDate,
                      )}
                    </td>

                    <td className="p-4">
                      <div>
                        <p className="font-medium text-[#20243A]">
                          {item.sourceType}
                        </p>

                        <p className="text-xs text-[#666B84]">
                          {item.sourceId}
                        </p>
                      </div>
                    </td>

                    <td className="p-4 font-semibold">
                      {item.taxCode?.code ||
                        item.taxCodeId}
                    </td>

                    <td className="p-4">
                      {item.direction}
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
                      )}
                      %
                    </td>

                    <td className="p-4">
                      {item.taxPeriod?.code ||
                        "-"}
                    </td>

                    <td className="p-4">
                      <Badge
                        value={item.status}
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
  );

  const renderReturns = () => (
    <Panel
      title="Tax Returns"
      description="Period-level statutory tax positions calculated from tax transactions."
    >
      {data.returns.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px]">
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
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {data.returns.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4 font-semibold">
                      {item.taxRegime?.code ||
                        item.taxRegimeId}
                    </td>

                    <td className="p-4">
                      {item.taxPeriod?.code ||
                        item.taxPeriodId}
                    </td>

                    <td className="p-4">
                      {item.returnType}
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
                        value={item.status}
                      />
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {item.status ===
                          "DRAFT" && (
                          <SecondaryButton
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void updateReturnStatus(
                                item,
                                "UNDER_REVIEW",
                              )
                            }
                          >
                            Submit review
                          </SecondaryButton>
                        )}

                        {item.status ===
                          "UNDER_REVIEW" && (
                          <SecondaryButton
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void updateReturnStatus(
                                item,
                                "APPROVED",
                              )
                            }
                          >
                            Approve
                          </SecondaryButton>
                        )}

                        {[
                          "APPROVED",
                          "READY_TO_FILE",
                        ].includes(
                          item.status,
                        ) && (
                          <PrimaryButton
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void createFilingFromReturn(
                                item,
                              )
                            }
                          >
                            Create filing
                          </PrimaryButton>
                        )}

                        <SecondaryButton
                          type="button"
                          onClick={() =>
                            setSelectedReturn(
                              item,
                            )
                          }
                        >
                          View
                        </SecondaryButton>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          label="No tax returns prepared"
          action={
            openPeriods.length > 0 ? (
              <PrimaryButton
                type="button"
                onClick={() =>
                  void calculateReturn(
                    openPeriods[0],
                  )
                }
              >
                <RefreshCw size={16} />
                Calculate current period
              </PrimaryButton>
            ) : undefined
          }
        />
      )}
    </Panel>
  );

  const renderFilings = () => (
    <Panel
      title="Tax Filings"
      description="Statutory submissions created from approved tax returns."
    >
      <div className="mb-5 flex items-center gap-3 border-b border-[#ECECF3] bg-[#FFFBEB] px-5 py-4 text-sm text-amber-800">
        <ShieldCheck size={18} />

        <span>
          FOS creates production filings from approved tax returns. Manual tax totals are not used as the primary filing workflow.
        </span>
      </div>

      {filings.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px]">
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
                  Payable
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
                  Reference
                </th>
                <th className="p-4">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filings.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4 font-semibold">
                      {item.obligation?.name ||
                        item.taxObligationCode}
                    </td>

                    <td className="p-4">
                      {dateText(
                        item.taxPeriodStart,
                      )}{" "}
                      —{" "}
                      {dateText(
                        item.taxPeriodEnd,
                      )}
                    </td>

                    <td className="p-4 text-right">
                      {currency(
                        item.taxAmount,
                        item.obligation
                          ?.currency || "KES",
                      )}
                    </td>

                    <td className="p-4 text-right font-semibold">
                      {currency(
                        item.totalPayable,
                        item.obligation
                          ?.currency || "KES",
                      )}
                    </td>

                    <td className="p-4">
                      {dateText(
                        item.dueDate,
                      )}
                    </td>

                    <td className="p-4">
                      <Badge
                        value={
                          item.filingStatus
                        }
                      />
                    </td>

                    <td className="p-4">
                      <Badge
                        value={
                          item.paymentStatus
                        }
                      />
                    </td>

                    <td className="p-4">
                      {item.filingReference ||
                        "-"}
                    </td>

                    <td className="p-4">
                      {item.paymentStatus.toUpperCase() !==
                      "PAID" ? (
                        <SecondaryButton
                          type="button"
                          onClick={() =>
                            openPayment(item)
                          }
                        >
                          Record payment
                        </SecondaryButton>
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
      ) : (
        <EmptyState
          label="No tax filings recorded"
          action={
            unfiledApprovedReturns.length ? (
              <PrimaryButton
                type="button"
                onClick={() =>
                  setActiveTab("returns")
                }
              >
                Review approved returns
              </PrimaryButton>
            ) : undefined
          }
        />
      )}
    </Panel>
  );

  const renderPayments = () => (
    <Panel
      title="Tax Payments"
      description="Settlement records linked to statutory tax filings."
    >
      {payments.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
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
                <th className="p-4">
                  Notes
                </th>
              </tr>
            </thead>

            <tbody>
              {payments.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#ECECF3]"
                  >
                    <td className="p-4">
                      {dateText(
                        item.paymentDate,
                      )}
                    </td>

                    <td className="p-4 font-medium">
                      {item.paymentReference ||
                        "-"}
                    </td>

                    <td className="p-4">
                      {item.paymentMethod}
                    </td>

                    <td className="p-4 text-right font-semibold">
                      {currency(
                        item.amount,
                      )}
                    </td>

                    <td className="p-4">
                      <Badge
                        value={item.status}
                      />
                    </td>

                    <td className="p-4 text-[#666B84]">
                      {item.notes || "-"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label="No tax payments recorded" />
      )}
    </Panel>
  );

  const body = {
    overview: renderOverview(),
    regimes: renderRegimes(),
    codes: renderCodes(),
    rates: renderRates(),
    rules: renderRules(),
    mappings: renderMappings(),
    periods: renderPeriods(),
    transactions: renderTransactions(),
    returns: renderReturns(),
    filings: renderFilings(),
    payments: renderPayments(),
  }[activeTab];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0D9488]">
            Tax & Compliance
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#20243A] sm:text-4xl">
            Tax Management
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-[#666B84]">
            Configure tax determination, maintain rates and rules, control tax periods, calculate returns, approve statutory positions, create filings and settle tax liabilities from one tenant-scoped workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load(true)
          }
          disabled={refreshing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E2E5EC] bg-white px-4 text-sm font-semibold text-[#4F556B] disabled:opacity-50"
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
            onClick={() => setError("")}
            className="ml-auto"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
          />

          <p className="text-sm">
            {notice}
          </p>

          <button
            type="button"
            onClick={() => setNotice("")}
            className="ml-auto"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[#E7E9F0] bg-white p-1.5">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active =
              activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(tab.id)
                }
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[#0D9488] text-white shadow-sm"
                    : "text-[#666B84] hover:bg-[#F6F7F9] hover:text-[#20243A]"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E7E9F0] bg-white p-10 text-center">
          <Clock3
            size={28}
            className="mx-auto animate-pulse text-[#0D9488]"
          />

          <p className="mt-3 text-sm text-[#666B84]">
            Loading tax workspace...
          </p>
        </div>
      ) : (
        body
      )}

      {showRule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#111827]/65 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#20243A]">
                  Create Tax Rule
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Define the conditions under which a tax code is selected.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowRule(false)
                }
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={(event) =>
                void submitConfiguration(
                  event,
                  "rule",
                )
              }
              className="space-y-5 p-6"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>
                    Tax Regime
                  </FieldLabel>

                  <Select
                    value={
                      ruleForm.taxRegimeId
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          taxRegimeId:
                            value,
                        }),
                      )
                    }
                    required
                  >
                    <option value="">
                      Select regime
                    </option>

                    {data.regimes.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.code} —{" "}
                          {item.name}
                        </option>
                      ),
                    )}
                  </Select>
                </div>

                <div>
                  <FieldLabel>
                    Tax Code
                  </FieldLabel>

                  <Select
                    value={
                      ruleForm.taxCodeId
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          taxCodeId:
                            value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Default / automatic
                    </option>

                    {data.codes.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.code} —{" "}
                          {item.name}
                        </option>
                      ),
                    )}
                  </Select>
                </div>

                <div>
                  <FieldLabel>
                    Rule Code
                  </FieldLabel>

                  <Input
                    value={ruleForm.code}
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          code: value.toUpperCase(),
                        }),
                      )
                    }
                    placeholder="VAT-DOMESTIC"
                    required
                  />
                </div>

                <div>
                  <FieldLabel>
                    Rule Name
                  </FieldLabel>

                  <Input
                    value={ruleForm.name}
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          name: value,
                        }),
                      )
                    }
                    placeholder="Domestic standard VAT"
                    required
                  />
                </div>

                <div>
                  <FieldLabel>
                    Priority
                  </FieldLabel>

                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      ruleForm.priority
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          priority:
                            value,
                        }),
                      )
                    }
                    required
                  />
                </div>

                <div>
                  <FieldLabel>
                    Transaction Type
                  </FieldLabel>

                  <Input
                    value={
                      ruleForm.transactionType
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          transactionType:
                            value,
                        }),
                      )
                    }
                    placeholder="SALE / PURCHASE"
                  />
                </div>

                <div>
                  <FieldLabel>
                    Customer Type
                  </FieldLabel>

                  <Input
                    value={
                      ruleForm.customerType
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          customerType:
                            value,
                        }),
                      )
                    }
                    placeholder="BUSINESS / INDIVIDUAL"
                  />
                </div>

                <div>
                  <FieldLabel>
                    Vendor Type
                  </FieldLabel>

                  <Input
                    value={
                      ruleForm.vendorType
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          vendorType:
                            value,
                        }),
                      )
                    }
                    placeholder="LOCAL / FOREIGN"
                  />
                </div>

                <div>
                  <FieldLabel>
                    Supply Type
                  </FieldLabel>

                  <Input
                    value={
                      ruleForm.supplyType
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          supplyType:
                            value,
                        }),
                      )
                    }
                    placeholder="GOODS / SERVICES"
                  />
                </div>

                <div>
                  <FieldLabel>
                    Jurisdiction
                  </FieldLabel>

                  <Input
                    value={
                      ruleForm.jurisdiction
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          jurisdiction:
                            value,
                        }),
                      )
                    }
                    placeholder="KE"
                  />
                </div>

                <div>
                  <FieldLabel>
                    Effective From
                  </FieldLabel>

                  <Input
                    type="date"
                    value={
                      ruleForm.effectiveFrom
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          effectiveFrom:
                            value,
                        }),
                      )
                    }
                    required
                  />
                </div>

                <div>
                  <FieldLabel>
                    Effective To
                  </FieldLabel>

                  <Input
                    type="date"
                    value={
                      ruleForm.effectiveTo
                    }
                    onChange={(value) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          effectiveTo:
                            value,
                        }),
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>
                    Conditions JSON
                  </FieldLabel>

                  <textarea
                    value={
                      ruleForm.conditions
                    }
                    onChange={(event) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          conditions:
                            event.target.value,
                        }),
                      )
                    }
                    rows={6}
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 font-mono text-xs outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <FieldLabel>
                    Actions JSON
                  </FieldLabel>

                  <textarea
                    value={
                      ruleForm.actions
                    }
                    onChange={(event) =>
                      setRuleForm(
                        (current) => ({
                          ...current,
                          actions:
                            event.target.value,
                        }),
                      )
                    }
                    rows={6}
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 font-mono text-xs outline-none focus:border-[#0D9488]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
                <SecondaryButton
                  type="button"
                  onClick={() =>
                    setShowRule(false)
                  }
                >
                  Cancel
                </SecondaryButton>

                <PrimaryButton
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Create tax rule"}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMapping && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#111827]/65 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#20243A]">
                  Tax Account Mapping
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Connect a tax code to a tenant ledger account.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowMapping(false)
                }
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={(event) =>
                void submitConfiguration(
                  event,
                  "mapping",
                )
              }
              className="space-y-5 p-6"
            >
              <div>
                <FieldLabel>
                  Tax Code
                </FieldLabel>

                <Select
                  value={
                    mappingForm.taxCodeId
                  }
                  onChange={(value) =>
                    setMappingForm(
                      (current) => ({
                        ...current,
                        taxCodeId:
                          value,
                      }),
                    )
                  }
                  required
                >
                  <option value="">
                    Select tax code
                  </option>

                  {data.codes.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.code} —{" "}
                        {item.name}
                      </option>
                    ),
                  )}
                </Select>
              </div>

              <div>
                <FieldLabel>
                  Ledger Account
                </FieldLabel>

                <Select
                  value={
                    mappingForm.accountId
                  }
                  onChange={(value) =>
                    setMappingForm(
                      (current) => ({
                        ...current,
                        accountId:
                          value,
                      }),
                    )
                  }
                  required
                >
                  <option value="">
                    Select account
                  </option>

                  {(data.accounts || []).map(
                    (account) => (
                      <option
                        key={account.id}
                        value={account.id}
                      >
                        {account.code} —{" "}
                        {account.name}
                      </option>
                    ),
                  )}
                </Select>

                {!data.accounts?.length && (
                  <p className="mt-2 text-xs text-amber-700">
                    No tenant accounts were returned by the tax configuration endpoint. The backend must expose tenant ledger accounts before mappings can be created from this screen.
                  </p>
                )}
              </div>

              <div>
                <FieldLabel>
                  Mapping Type
                </FieldLabel>

                <Select
                  value={
                    mappingForm.mappingType
                  }
                  onChange={(value) =>
                    setMappingForm(
                      (current) => ({
                        ...current,
                        mappingType:
                          value,
                      }),
                    )
                  }
                >
                  <option value="OUTPUT_TAX">
                    OUTPUT TAX
                  </option>
                  <option value="INPUT_TAX">
                    INPUT TAX
                  </option>
                  <option value="RECOVERABLE_INPUT">
                    RECOVERABLE INPUT
                  </option>
                  <option value="NON_RECOVERABLE_INPUT">
                    NON-RECOVERABLE INPUT
                  </option>
                  <option value="WITHHOLDING_TAX">
                    WITHHOLDING TAX
                  </option>
                  <option value="TAX_RECEIVABLE">
                    TAX RECEIVABLE
                  </option>
                  <option value="TAX_PAYABLE">
                    TAX PAYABLE
                  </option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>
                    Effective From
                  </FieldLabel>

                  <Input
                    type="date"
                    value={
                      mappingForm.effectiveFrom
                    }
                    onChange={(value) =>
                      setMappingForm(
                        (current) => ({
                          ...current,
                          effectiveFrom:
                            value,
                        }),
                      )
                    }
                    required
                  />
                </div>

                <div>
                  <FieldLabel>
                    Effective To
                  </FieldLabel>

                  <Input
                    type="date"
                    value={
                      mappingForm.effectiveTo
                    }
                    onChange={(value) =>
                      setMappingForm(
                        (current) => ({
                          ...current,
                          effectiveTo:
                            value,
                        }),
                      )
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#4F556B]">
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
                          event.target.checked,
                      }),
                    )
                  }
                />

                Make this the default mapping
              </label>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
                <SecondaryButton
                  type="button"
                  onClick={() =>
                    setShowMapping(false)
                  }
                >
                  Cancel
                </SecondaryButton>

                <PrimaryButton
                  disabled={
                    saving ||
                    !mappingForm.accountId
                  }
                >
                  {saving
                    ? "Saving..."
                    : "Create mapping"}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFiling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#111827]/65 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#20243A]">
                  Tax Filing
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Tax filings are created from approved returns.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowFiling(false)
                }
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={(event) =>
                void submitFiling(event)
              }
              className="space-y-5 p-6"
            >
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Manual tax-total entry has been disabled in the production workflow. Calculate the tax period, review the return, approve it, and create the filing from the approved return.
              </div>

              <div className="flex justify-end gap-3">
                <SecondaryButton
                  type="button"
                  onClick={() =>
                    setShowFiling(false)
                  }
                >
                  Close
                </SecondaryButton>

                <PrimaryButton type="submit">
                  Go to tax returns
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayment &&
        selectedFiling && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#111827]/65 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-[#20243A]">
                    Record Tax Payment
                  </h2>

                  <p className="mt-1 text-sm text-[#666B84]">
                    {selectedFiling
                      .obligation?.name ||
                      selectedFiling.taxObligationCode}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPayment(false);
                    setSelectedFiling(null);
                  }}
                >
                  <X size={22} />
                </button>
              </div>

              <form
                onSubmit={(event) =>
                  void submitPayment(event)
                }
                className="space-y-4 p-6"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#F7F8FA] p-4">
                    <span className="block text-xs text-[#666B84]">
                      Total payable
                    </span>

                    <strong className="mt-1 block text-lg text-[#20243A]">
                      {currency(
                        selectedFiling.totalPayable,
                        selectedFiling
                          .obligation
                          ?.currency ||
                          "KES",
                      )}
                    </strong>
                  </div>

                  <div className="rounded-xl bg-[#F7F8FA] p-4">
                    <span className="block text-xs text-[#666B84]">
                      Payment status
                    </span>

                    <div className="mt-2">
                      <Badge
                        value={
                          selectedFiling.paymentStatus
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel>
                    Payment Amount
                  </FieldLabel>

                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      paymentForm.amount
                    }
                    onChange={(value) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          amount: value,
                        }),
                      )
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <FieldLabel>
                    Payment Date
                  </FieldLabel>

                  <Input
                    type="date"
                    value={
                      paymentForm.paymentDate
                    }
                    onChange={(value) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          paymentDate:
                            value,
                        }),
                      )
                    }
                    required
                  />
                </div>

                <div>
                  <FieldLabel>
                    Payment Method
                  </FieldLabel>

                  <Select
                    value={
                      paymentForm.paymentMethod
                    }
                    onChange={(value) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          paymentMethod:
                            value,
                        }),
                      )
                    }
                  >
                    <option value="BANK">
                      BANK
                    </option>

                    <option value="MPESA">
                      MPESA
                    </option>

                    <option value="CASH">
                      CASH
                    </option>

                    <option value="OTHER">
                      OTHER
                    </option>
                  </Select>
                </div>

                <div>
                  <FieldLabel>
                    Payment Reference
                  </FieldLabel>

                  <Input
                    value={
                      paymentForm.paymentReference
                    }
                    onChange={(value) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          paymentReference:
                            value,
                        }),
                      )
                    }
                    placeholder="Bank / M-Pesa / statutory reference"
                  />
                </div>

                <div>
                  <FieldLabel>
                    Notes
                  </FieldLabel>

                  <textarea
                    value={paymentForm.notes}
                    onChange={(event) =>
                      setPaymentForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }),
                      )
                    }
                    rows={3}
                    placeholder="Supporting payment information"
                    className="w-full rounded-lg border border-[#DCDCE5] px-3 py-2.5 text-sm outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-4">
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      setShowPayment(false);
                      setSelectedFiling(null);
                    }}
                  >
                    Cancel
                  </SecondaryButton>

                  <PrimaryButton
                    disabled={saving}
                  >
                    {saving
                      ? "Recording..."
                      : "Record payment"}
                  </PrimaryButton>
                </div>
              </form>
            </div>
          </div>
        )}

      {selectedReturn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#111827]/65 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-[#20243A]">
                  Tax Return Details
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  {selectedReturn.taxPeriod
                    ?.name ||
                    selectedReturn.taxPeriodId}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedReturn(null)
                }
              >
                <X size={22} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
              {[
                [
                  "Taxable Amount",
                  currency(
                    selectedReturn.taxableAmount,
                  ),
                ],
                [
                  "Output Tax",
                  currency(
                    selectedReturn.outputTax,
                  ),
                ],
                [
                  "Input Tax",
                  currency(
                    selectedReturn.inputTax,
                  ),
                ],
                [
                  "Withholding",
                  currency(
                    selectedReturn.withholdingTax,
                  ),
                ],
                [
                  "Adjustments",
                  currency(
                    selectedReturn.adjustments,
                  ),
                ],
                [
                  "Penalties",
                  currency(
                    selectedReturn.penalties,
                  ),
                ],
                [
                  "Interest",
                  currency(
                    selectedReturn.interest,
                  ),
                ],
                [
                  "Net Payable",
                  currency(
                    selectedReturn.netTaxPayable,
                  ),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#ECECF3] p-4"
                >
                  <p className="text-xs text-[#666B84]">
                    {label}
                  </p>

                  <p className="mt-2 text-lg font-bold text-[#20243A]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-[#ECECF3] px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#666B84]">
                  Status
                </span>

                <Badge
                  value={
                    selectedReturn.status
                  }
                />
              </div>

              <div className="mt-4 flex justify-end gap-3">
                {selectedReturn.status ===
                  "DRAFT" && (
                  <PrimaryButton
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      void updateReturnStatus(
                        selectedReturn,
                        "UNDER_REVIEW",
                      );

                      setSelectedReturn(
                        null,
                      );
                    }}
                  >
                    Submit for review
                  </PrimaryButton>
                )}

                {selectedReturn.status ===
                  "UNDER_REVIEW" && (
                  <PrimaryButton
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      void updateReturnStatus(
                        selectedReturn,
                        "APPROVED",
                      );

                      setSelectedReturn(
                        null,
                      );
                    }}
                  >
                    Approve return
                  </PrimaryButton>
                )}

                {[
                  "APPROVED",
                  "READY_TO_FILE",
                ].includes(
                  selectedReturn.status,
                ) && (
                  <PrimaryButton
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      void createFilingFromReturn(
                        selectedReturn,
                      );

                      setSelectedReturn(
                        null,
                      );
                    }}
                  >
                    Create filing
                  </PrimaryButton>
                )}

                <SecondaryButton
                  type="button"
                  onClick={() =>
                    setSelectedReturn(null)
                  }
                >
                  Close
                </SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
