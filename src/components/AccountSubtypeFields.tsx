import { ChevronDown } from "lucide-react";

export type SubtypeFormValues = {
  type: string;
  subtype: string;
  bankName: string;
  accountNumber: string;
  branchName: string;
  currency: string;
  openingBalance: string;
  openingBalanceDate: string;
};

const SUBTYPES: Record<string, { value: string; label: string }[]> = {
  Asset: [
    { value: "BANK", label: "Bank account" },
    { value: "CASH", label: "Cash (petty cash / till)" },
    { value: "MOBILE_MONEY", label: "Mobile money" },
    { value: "RECEIVABLE_CONTROL", label: "Receivables control" },
  ],
  Liability: [
    { value: "PAYABLE_CONTROL", label: "Payables control" },
    { value: "TAX_PAYABLE", label: "Tax payable" },
  ],
  Income: [{ value: "SALES_REVENUE", label: "Default sales revenue" }],
  Expense: [{ value: "BAD_DEBT", label: "Bad debt expense" }],
  Equity: [{ value: "OPENING_BALANCE", label: "Opening balance equity" }],
};

const input =
  "h-11 w-full rounded-xl border border-[#E4E6EE] bg-white px-3.5 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10 disabled:bg-[#F7F8FB]";
const label = "mb-2 block text-xs font-semibold uppercase tracking-wide text-[#626A7D]";

type Props = {
  values: SubtypeFormValues;
  disabled: boolean;
  bankLinked: boolean;
  onChange: (patch: Partial<SubtypeFormValues>) => void;
};

export default function AccountSubtypeFields({ values, disabled, bankLinked, onChange }: Props) {
  const options = SUBTYPES[values.type];
  if (!options) return null;

  const bankField = (
    key: keyof SubtypeFormValues,
    text: string,
    opts: { required?: boolean; locked?: boolean; type?: string } = {}
  ) => (
    <div key={key}>
      <label className={label}>
        {text}
        {opts.required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      <input
        className={input}
        type={opts.type ?? "text"}
        min={opts.type === "number" ? 0 : undefined}
        value={values[key]}
        disabled={disabled || (opts.locked && bankLinked)}
        onChange={(e) => onChange({ [key]: e.target.value })}
      />
    </div>
  );

  return (
    <>
      <div>
        <label className={label}>What is this account for?</label>
        <div className="relative">
          <select
            className={`${input} appearance-none pr-10`}
            value={values.subtype}
            disabled={disabled}
            onChange={(e) => onChange({ subtype: e.target.value })}
          >
            <option value="">General account</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8E95A6]" />
        </div>
      </div>

      {values.subtype === "BANK" && (
        <div className="space-y-4 rounded-xl border border-[#CFEDE9] bg-[#F3FBFA] p-4">
          <p className="text-xs leading-5 text-[#3F6F69]">
            Saving links this bank to Cash &amp; Banking, Receivables, Payables, Payroll and Reports automatically, and posts the opening
            balance to the ledger.
          </p>
          {bankField("bankName", "Bank name", { required: true })}
          {bankField("accountNumber", "Account number", { required: true, locked: true })}
          {bankField("branchName", "Branch")}
          {bankField("currency", "Currency", { locked: true })}
          {bankField("openingBalance", "Opening balance", { locked: true, type: "number" })}
          {bankField("openingBalanceDate", "Opening balance date", { locked: true, type: "date" })}
        </div>
      )}
    </>
  );
}