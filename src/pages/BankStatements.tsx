import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import * as XLSX from "xlsx";
import { authenticatedFetch, getAuthToken } from "../lib/auth";
import {
  deriveBalances,
  detectHeaderRow,
  EMPTY_MAPPING,
  guessMapping,
  linesToCsv,
  normalizeRows,
  parseCsv,
  readExcel,
} from "../lib/bankStatementParse";
import type {
  Cell,
  ColumnMapping,
  DateFormat,
  ParsedLine,
} from "../lib/bankStatementParse";

// ─── Types ────────────────────────────────────────────────

interface BankAccountOption {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

interface StatementRow {
  id: string;
  fileName: string;
  sourceType: string;
  periodStart: string | null;
  periodEnd: string | null;
  lineCount: number;
  openingBalance: number | null;
  closingBalance: number | null;
  createdAt: string;
}

interface StatementLineRow {
  id: string;
  transactionDate: string;
  description: string;
  reference: string | null;
  amount: number;
  balance: number | null;
  matchStatus: string;
}

type SourceKind = "CSV" | "EXCEL" | "PDF";

// ─── Helpers ──────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en-KE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatMoney = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : fmt.format(v);

const formatDate = (v: string | null) => {
  if (!v) return "—";

  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(d);
};

const apiErr = (e: unknown, fallback: string) =>
  e instanceof Error && e.message.trim() ? e.message : fallback;

async function apiFetch(path: string, init?: RequestInit) {
  const token = getAuthToken();
  const res = await authenticatedFetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);

  return data;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, "");

const selectCls =
  "w-full rounded-xl border border-[#ECECF3] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488]";

function ColumnSelect({
  label,
  value,
  headers,
  onChange,
  required,
}: {
  label: string;
  value: number;
  headers: string[];
  onChange: (v: number) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#666B84]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={selectCls}
      >
        <option value={-1}>— none —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function BankStatements() {
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fileName, setFileName] = useState("");
  const [kind, setKind] = useState<SourceKind | null>(null);
  const [rows, setRows] = useState<Cell[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [dateFormat, setDateFormat] = useState<DateFormat>("AUTO");
  const [pdfLines, setPdfLines] = useState<ParsedLine[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [viewing, setViewing] = useState<StatementRow | null>(null);
  const [viewLines, setViewLines] = useState<StatementLineRow[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const headers = useMemo(
    () => (rows[headerRow] ?? []).map((c) => String(c)),
    [rows, headerRow]
  );

  const parsed = useMemo(() => {
    if (kind === "PDF") return { lines: pdfLines, skipped: 0 };
    if (rows.length === 0) return { lines: [] as ParsedLine[], skipped: 0 };

    return normalizeRows(rows, headerRow, mapping, dateFormat);
  }, [kind, pdfLines, rows, headerRow, mapping, dateFormat]);

  const totals = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;

    for (const l of parsed.lines) {
      if (l.amount > 0) moneyIn += l.amount;
      else moneyOut += Math.abs(l.amount);
    }

    return { moneyIn, moneyOut };
  }, [parsed.lines]);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiFetch("/api/bank-accounts");
      const list: BankAccountOption[] = Array.isArray(data?.bankAccounts)
        ? data.bankAccounts
        : [];

      setAccounts(list);
      setAccountId((current) => current || list[0]?.id || "");
    } catch (e) {
      setError(apiErr(e, "Failed to load bank accounts."));
    }
  }, []);

  const loadStatements = useCallback(async () => {
    if (!accountId) {
      setStatements([]);
      setLoading(false);

      return;
    }

    try {
      setLoading(true);

      const data = await apiFetch(
        `/api/bank-statements?bankAccountId=${encodeURIComponent(accountId)}`
      );

      setStatements(Array.isArray(data?.statements) ? data.statements : []);
    } catch (e) {
      setError(apiErr(e, "Failed to load statements."));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadStatements();
  }, [loadStatements]);

  const resetImport = () => {
    setFileName("");
    setKind(null);
    setRows([]);
    setHeaderRow(0);
    setMapping(EMPTY_MAPPING);
    setPdfLines([]);
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file) return;

    resetImport();
    setError("");
    setSuccess("");

    const lower = file.name.toLowerCase();

    try {
      if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
        const parsedRows = parseCsv(await file.text());
        const hr = detectHeaderRow(parsedRows);

        setKind("CSV");
        setFileName(file.name);
        setRows(parsedRows);
        setHeaderRow(hr);
        setMapping(guessMapping((parsedRows[hr] ?? []).map(String)));
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const parsedRows = readExcel(await file.arrayBuffer());
        const hr = detectHeaderRow(parsedRows);

        setKind("EXCEL");
        setFileName(file.name);
        setRows(parsedRows);
        setHeaderRow(hr);
        setMapping(guessMapping((parsedRows[hr] ?? []).map(String)));
      } else if (lower.endsWith(".pdf")) {
        if (file.size > 6.5 * 1024 * 1024) {
          setError("This PDF is too large (max 6.5 MB). Use a smaller file or CSV/Excel.");

          return;
        }

        setReading(true);
        setKind("PDF");
        setFileName(file.name);

        const data = await apiFetch("/api/bank-statements/parse-pdf", {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            contentBase64: await readAsBase64(file),
          }),
        });

        setPdfLines(Array.isArray(data?.lines) ? data.lines : []);
      } else {
        setError("Unsupported file. Upload a CSV, Excel (.xlsx/.xls) or PDF statement.");
      }
    } catch (err) {
      resetImport();
      setError(apiErr(err, "Could not read this file."));
    } finally {
      setReading(false);
    }
  };

  const handleImport = async () => {
    if (!accountId || !kind || parsed.lines.length === 0 || importing) return;

    try {
      setImporting(true);
      setError("");

      const { openingBalance, closingBalance } = deriveBalances(parsed.lines);

      const data = await apiFetch("/api/bank-statements/import", {
        method: "POST",
        body: JSON.stringify({
          bankAccountId: accountId,
          fileName,
          sourceType: kind,
          lines: parsed.lines,
          openingBalance,
          closingBalance,
        }),
      });

      setSuccess(
        `Imported ${data?.imported ?? parsed.lines.length} transactions` +
          (data?.skipped ? ` (${data.skipped} duplicates skipped).` : ".")
      );
      resetImport();
      await loadStatements();
    } catch (err) {
      setError(apiErr(err, "Failed to import the statement."));
    } finally {
      setImporting(false);
    }
  };

  const fetchLines = async (statement: StatementRow) => {
    const data = await apiFetch(`/api/bank-statements/${statement.id}/lines`);

    return (Array.isArray(data?.lines) ? data.lines : []) as StatementLineRow[];
  };

  const openView = async (statement: StatementRow) => {
    try {
      setViewing(statement);
      setViewLoading(true);
      setViewLines(await fetchLines(statement));
    } catch (err) {
      setViewing(null);
      setError(apiErr(err, "Failed to load statement lines."));
    } finally {
      setViewLoading(false);
    }
  };

  const exportStatement = async (
    statement: StatementRow,
    format: "csv" | "xlsx"
  ) => {
    try {
      const lines = await fetchLines(statement);
      const name = baseName(statement.fileName) || "statement";

      if (format === "csv") {
        download(
          new Blob(["\uFEFF" + linesToCsv(lines)], {
            type: "text/csv;charset=utf-8",
          }),
          `${name}-export.csv`
        );

        return;
      }

      const sheet = XLSX.utils.aoa_to_sheet([
        ["Date", "Description", "Reference", "Money In", "Money Out", "Balance"],
        ...lines.map((l) => [
          l.transactionDate.slice(0, 10),
          l.description,
          l.reference ?? "",
          l.amount > 0 ? l.amount : "",
          l.amount < 0 ? Math.abs(l.amount) : "",
          l.balance ?? "",
        ]),
      ]);
      const book = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(book, sheet, "Statement");
      XLSX.writeFile(book, `${name}-export.xlsx`);
    } catch (err) {
      setError(apiErr(err, "Export failed."));
    }
  };

  const removeStatement = async (statement: StatementRow) => {
    if (!window.confirm(`Delete "${statement.fileName}" and its ${statement.lineCount} transactions?`)) {
      return;
    }

    try {
      await apiFetch(`/api/bank-statements/${statement.id}`, { method: "DELETE" });
      setSuccess("Statement deleted.");
      await loadStatements();
    } catch (err) {
      setError(apiErr(err, "Failed to delete the statement."));
    }
  };

  const mappingReady =
    mapping.date >= 0 &&
    (mapping.amount >= 0 || mapping.debit >= 0 || mapping.credit >= 0);

  const setMap = (key: keyof ColumnMapping) => (v: number) =>
    setMapping((m) => ({ ...m, [key]: v }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#666B84]">Cash & Banking</p>
        <h1 className="mt-1 text-2xl font-bold text-[#20243A] xl:text-3xl">
          Bank Statements
        </h1>
        <p className="mt-1 text-sm text-[#666B84]">
          Import statements from your bank as CSV, Excel or PDF, and export them
          again at any time.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span className="flex-1">{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
              Bank account
            </label>
            <select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                resetImport();
              }}
              className={selectCls}
            >
              {accounts.length === 0 && <option value="">No bank accounts yet</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} · {a.accountName} · {a.accountNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
              Statement file
            </label>
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#0D9488]/50 px-4 py-2.5 text-sm font-medium text-[#0D9488] hover:bg-[#0D9488]/5 ${
                !accountId || reading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {reading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
              {reading ? "Reading PDF with Claude…" : "Choose CSV, Excel or PDF"}
              <input
                type="file"
                accept=".csv,.txt,.xlsx,.xls,.pdf"
                className="hidden"
                onChange={(e) => void handleFile(e)}
              />
            </label>
          </div>
        </div>

        {kind === "PDF" && (
          <p className="mt-3 text-xs text-[#666B84]">
            PDF statements are read by Claude (Anthropic). Check the preview
            carefully before importing.
          </p>
        )}

        {(kind === "CSV" || kind === "EXCEL") && rows.length > 0 && (
          <div className="mt-5 border-t border-[#ECECF3] pt-5">
            <p className="mb-3 text-sm font-semibold text-[#20243A]">
              Match the columns in {fileName}
            </p>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ColumnSelect label="Date" required value={mapping.date} headers={headers} onChange={setMap("date")} />
              <ColumnSelect label="Description" value={mapping.description} headers={headers} onChange={setMap("description")} />
              <ColumnSelect label="Reference" value={mapping.reference} headers={headers} onChange={setMap("reference")} />
              <ColumnSelect label="Balance" value={mapping.balance} headers={headers} onChange={setMap("balance")} />
              <ColumnSelect label="Money Out (Debit)" value={mapping.debit} headers={headers} onChange={setMap("debit")} />
              <ColumnSelect label="Money In (Credit)" value={mapping.credit} headers={headers} onChange={setMap("credit")} />
              <ColumnSelect label="Single Amount column" value={mapping.amount} headers={headers} onChange={setMap("amount")} />
              <div>
                <label className="mb-1 block text-xs font-medium text-[#666B84]">Date format</label>
                <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)} className={selectCls}>
                  <option value="AUTO">Automatic (day first)</option>
                  <option value="DMY">Day / Month / Year</option>
                  <option value="MDY">Month / Day / Year</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-[#666B84]">
              <span>Header row number</span>
              <input
                type="number"
                min={1}
                max={Math.max(rows.length, 1)}
                value={headerRow + 1}
                onChange={(e) => {
                  const hr = Math.max(0, Math.min(rows.length - 1, Number(e.target.value) - 1 || 0));

                  setHeaderRow(hr);
                  setMapping(guessMapping((rows[hr] ?? []).map(String)));
                }}
                className="w-20 rounded-lg border border-[#ECECF3] px-2 py-1 text-sm text-[#20243A]"
              />
              <span>Use either Money Out / Money In or a single Amount column.</span>
            </div>
          </div>
        )}

        {kind && !reading && (
          <div className="mt-5 border-t border-[#ECECF3] pt-5">
            {!mappingReady && kind !== "PDF" ? (
              <p className="text-sm text-[#666B84]">
                Choose the Date column and either an Amount column or Money Out / Money In columns to see a preview.
              </p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span className="font-semibold text-[#20243A]">
                    {parsed.lines.length} transactions found
                  </span>
                  <span className="text-emerald-700">In: {formatMoney(totals.moneyIn)}</span>
                  <span className="text-red-600">Out: {formatMoney(totals.moneyOut)}</span>
                  {parsed.skipped > 0 && (
                    <span className="text-[#666B84]">{parsed.skipped} rows skipped (not transactions)</span>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#ECECF3]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8F9FC] text-left text-xs uppercase tracking-wide text-[#666B84]">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.lines.slice(0, 8).map((l, i) => (
                        <tr key={i} className="border-t border-[#ECECF3]">
                          <td className="whitespace-nowrap px-3 py-2">{l.date}</td>
                          <td className="px-3 py-2">{l.description}</td>
                          <td className="px-3 py-2">{l.reference}</td>
                          <td className={`px-3 py-2 text-right ${l.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>
                            {formatMoney(l.amount)}
                          </td>
                          <td className="px-3 py-2 text-right">{formatMoney(l.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsed.lines.length > 8 && (
                  <p className="mt-2 text-xs text-[#666B84]">Showing the first 8 of {parsed.lines.length} transactions.</p>
                )}

                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={resetImport}
                    disabled={importing}
                    className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleImport()}
                    disabled={importing || parsed.lines.length === 0}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B7A70] disabled:opacity-60"
                  >
                    {importing ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                    {importing ? "Importing…" : `Import ${parsed.lines.length} transactions`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[#20243A]">Imported statements</h2>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[#666B84]">
            <Loader2 size={17} className="animate-spin" /> Loading…
          </div>
        ) : statements.length === 0 ? (
          <p className="py-6 text-sm text-[#666B84]">
            No statements imported for this bank account yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#ECECF3]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8F9FC] text-left text-xs uppercase tracking-wide text-[#666B84]">
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Transactions</th>
                  <th className="px-4 py-3 text-right">Closing balance</th>
                  <th className="px-4 py-3">Imported</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id} className="border-t border-[#ECECF3]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-[#20243A]">
                        {s.sourceType === "PDF" ? <FileText size={16} /> : <FileSpreadsheet size={16} />}
                        <span className="max-w-[260px] truncate">{s.fileName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right">{s.lineCount}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(s.closingBalance)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" title="View" onClick={() => void openView(s)} className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]">
                          <Eye size={16} />
                        </button>
                        <button type="button" title="Export CSV" onClick={() => void exportStatement(s, "csv")} className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]">
                          <Download size={16} />
                        </button>
                        <button type="button" title="Export Excel" onClick={() => void exportStatement(s, "xlsx")} className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]">
                          <FileSpreadsheet size={16} />
                        </button>
                        <button type="button" title="Delete" onClick={() => void removeStatement(s)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-[#20243A]">{viewing.fileName}</h3>
                <p className="text-xs text-[#666B84]">
                  {formatDate(viewing.periodStart)} – {formatDate(viewing.periodEnd)} · {viewing.lineCount} transactions
                </p>
              </div>
              <button type="button" onClick={() => setViewing(null)} className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-auto p-5">
              {viewLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#666B84]">
                  <Loader2 size={17} className="animate-spin" /> Loading…
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F8F9FC] text-left text-xs uppercase tracking-wide text-[#666B84]">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewLines.map((l) => (
                      <tr key={l.id} className="border-t border-[#ECECF3]">
                        <td className="whitespace-nowrap px-3 py-2">{formatDate(l.transactionDate)}</td>
                        <td className="px-3 py-2">{l.description}</td>
                        <td className="px-3 py-2">{l.reference}</td>
                        <td className={`px-3 py-2 text-right ${l.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>
                          {formatMoney(l.amount)}
                        </td>
                        <td className="px-3 py-2 text-right">{formatMoney(l.balance)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-[#666B84]">
                          {l.matchStatus.charAt(0) + l.matchStatus.slice(1).toLowerCase()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
