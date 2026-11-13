import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import { authenticatedFetch, getAuthToken } from "../lib/auth";

/* =========================================================
   BANK RECONCILIATION
   Match bank statement lines to ledger entries, record bank-only
   items (fees, interest), then complete when the difference is 0.
========================================================= */

type BankOption = { id: string; bankName: string; accountName?: string; accountNumber: string; glAccountId?: string | null };
type StmtLine = { id: string; transactionDate: string; description: string; reference: string | null; amount: number };
type LedgerLine = { id: string; date: string; reference: string; description: string; net: number };
type MatchedLine = { id: string; transactionDate: string; description: string; amount: number; ledgerReference: string | null };
type Counter = { id: string; code: string; name: string; type: string };
type Summary = {
  bookBalance: number;
  unmatchedLedgerNet: number;
  unmatchedLedgerCount: number;
  unmatchedStatementNet: number;
  unmatchedStatementCount: number;
  statementBalance: number | null;
  adjustedBank: number | null;
  adjustedBook: number | null;
  difference: number | null;
};
type Workspace = {
  bank: { id: string; bankName: string; accountNumber: string; currency: string };
  ledgerAccount: { code: string; name: string } | null;
  asOf: string;
  suggestedStatementBalance: number | null;
  lastReconciliation: { id: string; statementDate: string } | null;
  summary: Summary;
  statementLines: StmtLine[];
  ledgerLines: LedgerLine[];
  matchedLines: MatchedLine[];
  counterAccounts: Counter[];
  truncated: boolean;
};
type HistoryRow = { id: string; statementDate: string; statementBalance: number; clearedCount: number; outstandingCount: number; completedAt: string };

const nf = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number | null | undefined) => (v === null || v === undefined ? "-" : nf.format(v));
const today = () => new Date().toISOString().slice(0, 10);

async function api(path: string, init?: RequestInit) {
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

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const field =
  "h-10 rounded-xl border border-[#E4E6EE] bg-white px-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10";
const btn =
  "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
      <p className="text-xs font-medium text-[#666B84]">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-[#20243A]"}`}>{value}</p>
    </div>
  );
}

export default function BankReconciliation() {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankId, setBankId] = useState("");
  const [asOf, setAsOf] = useState(today());
  const [balanceInput, setBalanceInput] = useState("");
  const [ws, setWs] = useState<Workspace | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pickStmt, setPickStmt] = useState("");
  const [pickLedger, setPickLedger] = useState("");
  const [recording, setRecording] = useState("");
  const [counterId, setCounterId] = useState("");

  const balance = balanceInput.trim() === "" ? null : Number(balanceInput);
  const balanceValid = balance === null || Number.isFinite(balance);

  useEffect(() => {
    api("/api/bank-accounts")
      .then((d) => {
        const list: BankOption[] = Array.isArray(d?.bankAccounts) ? d.bankAccounts : [];
        setBanks(list);
        setBankId((c) => c || list[0]?.id || "");
      })
      .catch((e) => setError(errText(e, "Failed to load bank accounts.")));
  }, []);

  const load = useCallback(async () => {
    if (!bankId || !balanceValid) return;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ asOf });
      if (balance !== null) q.set("statementBalance", String(balance));
      const [w, h] = await Promise.all([
        api(`/api/bank-reconciliation/${bankId}/workspace?${q}`),
        api(`/api/bank-reconciliation/${bankId}/history`),
      ]);
      setWs(w.workspace);
      setHistory(h.history ?? []);
      if (balance === null && w.workspace.suggestedStatementBalance !== null) {
        setBalanceInput(String(w.workspace.suggestedStatementBalance));
      }
    } catch (e) {
      setWs(null);
      setError(errText(e, "Failed to load reconciliation."));
    } finally {
      setLoading(false);
    }
  }, [bankId, asOf, balance, balanceValid]);

  useEffect(() => {
    setWs(null);
    setPickStmt("");
    setPickLedger("");
    setRecording("");
  }, [bankId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankId, asOf]);

  const act = async (path: string, init: RequestInit, done: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await api(`/api/bank-reconciliation/${bankId}${path}`, init);
      setNotice(typeof done === "string" ? done.replace("{n}", String(r?.matched ?? "")) : "");
      setPickStmt("");
      setPickLedger("");
      setRecording("");
      await load();
    } catch (e) {
      setError(errText(e, "That action failed."));
    } finally {
      setBusy(false);
    }
  };

  const post = (body: object) => ({ method: "POST", body: JSON.stringify(body) });

  const stmt = ws?.statementLines.find((l) => l.id === pickStmt);
  const ledger = ws?.ledgerLines.find((l) => l.id === pickLedger);
  const sameAmount = stmt && ledger ? Math.round(stmt.amount * 100) === Math.round(ledger.net * 100) : false;

  const s = ws?.summary;
  const diffZero = s?.difference !== null && s?.difference !== undefined && Math.round(s.difference * 100) === 0;
  const canComplete = Boolean(ws && s && balance !== null && diffZero && s.unmatchedStatementCount === 0);
  const latestId = history[0]?.id;

  const counters = useMemo(() => ws?.counterAccounts ?? [], [ws]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#666B84]">Cash &amp; Banking</p>
        <h1 className="mt-1 text-2xl font-bold text-[#20243A] xl:text-3xl">Bank Reconciliation</h1>
        <p className="mt-1 text-sm text-[#666B84]">Match your bank statement to the ledger. Complete when the difference is zero.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#ECECF3] bg-white p-5">
        <label className="text-xs font-medium text-[#666B84]">
          Bank account
          <select className={`${field} mt-1 block w-64`} value={bankId} onChange={(e) => setBankId(e.target.value)}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} - {b.accountNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[#666B84]">
          Statement date
          <input type="date" className={`${field} mt-1 block`} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        <label className="text-xs font-medium text-[#666B84]">
          Statement closing balance
          <input
            type="number"
            step="0.01"
            className={`${field} mt-1 block w-48`}
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            onBlur={() => void load()}
          />
        </label>
        <button className={`${btn} border border-[#E4E6EE] text-[#20243A]`} disabled={loading || busy} onClick={() => void load()}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
        </button>
        <button
          className={`${btn} bg-[#0D9488] text-white`}
          disabled={busy || !ws}
          onClick={() => void act("/auto-match", post({ asOf }), "Auto-matched {n} line(s). Review the rest manually.")}
        >
          <Sparkles size={16} /> Auto-match
        </button>
        <button
          className={`${btn} bg-[#20243A] text-white`}
          disabled={busy || !canComplete}
          title={canComplete ? "" : "Match every statement line and bring the difference to 0"}
          onClick={() => void act("/complete", post({ asOf, statementBalance: balance }), "Reconciliation completed.")}
        >
          Complete reconciliation
        </button>
      </div>

      {ws && s && (
        <>
          <p className="text-xs text-[#666B84]">
            Ledger account: {ws.ledgerAccount ? `${ws.ledgerAccount.code} - ${ws.ledgerAccount.name}` : "-"}
            {ws.lastReconciliation ? ` | Last reconciled: ${ws.lastReconciliation.statementDate.slice(0, 10)}` : " | Never reconciled"}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Statement balance" value={money(s.statementBalance)} />
            <Stat label={`Outstanding ledger items (${s.unmatchedLedgerCount})`} value={money(s.unmatchedLedgerNet)} />
            <Stat label="Adjusted bank balance" value={money(s.adjustedBank)} />
            <Stat label="Book balance" value={money(s.bookBalance)} />
            <Stat label={`Not yet in books (${s.unmatchedStatementCount})`} value={money(s.unmatchedStatementNet)} />
            <Stat label="Adjusted book balance" value={money(s.adjustedBook)} />
            <Stat label="Difference" value={money(s.difference)} tone={s.difference === null ? undefined : diffZero ? "good" : "bad"} />
          </div>
          {ws.truncated && <p className="text-xs text-amber-600">Only the first 500 lines of each list are shown. Auto-match or narrow the date.</p>}

          <div className="flex items-center gap-3">
            <button
              className={`${btn} bg-[#0D9488] text-white`}
              disabled={busy || !stmt || !ledger || !sameAmount}
              onClick={() => void act("/match", post({ statementLineId: pickStmt, journalLineId: pickLedger }), "Matched.")}
            >
              Match selected
            </button>
            {stmt && ledger && !sameAmount && <span className="text-xs text-rose-600">The two amounts are different.</span>}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="overflow-x-auto rounded-2xl border border-[#ECECF3] bg-white">
              <p className="border-b border-[#ECECF3] px-5 py-3 text-sm font-semibold text-[#20243A]">Bank statement - not matched ({ws.statementLines.length})</p>
              <table className="w-full text-sm">
                <tbody>
                  {ws.statementLines.length === 0 && (
                    <tr>
                      <td className="px-5 py-6 text-center text-[#666B84]">Everything on the statement is matched.</td>
                    </tr>
                  )}
                  {ws.statementLines.map((l) => (
                    <Fragment key={l.id}>
                      <tr className={`border-b border-[#F3F3F8] ${pickStmt === l.id ? "bg-[#F3FBFA]" : ""}`}>
                        <td className="px-3 py-2">
                          <input type="radio" name="stmt" checked={pickStmt === l.id} onChange={() => setPickStmt(l.id)} />
                        </td>
                        <td className="py-2 pr-2 text-[#666B84]">{l.transactionDate}</td>
                        <td className="py-2 pr-2 text-[#20243A]">{l.description}</td>
                        <td className={`py-2 pr-3 text-right font-medium ${l.amount < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(l.amount)}</td>
                        <td className="py-2 pr-3 text-right">
                          <button className="text-xs font-semibold text-[#0D9488]" onClick={() => { setRecording(recording === l.id ? "" : l.id); setCounterId(""); }}>
                            Record
                          </button>
                        </td>
                      </tr>
                      {recording === l.id && (
                        <tr className="border-b border-[#F3F3F8] bg-[#FAFBFD]">
                          <td colSpan={5}>
                            <div className="flex flex-wrap items-center gap-2 px-3 py-3">
                              <select className={`${field} w-64`} value={counterId} onChange={(e) => setCounterId(e.target.value)}>
                                <option value="">Post against account...</option>
                                {counters.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.code} - {c.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                className={`${btn} bg-[#0D9488] text-white`}
                                disabled={busy || !counterId}
                                onClick={() => void act("/create-entry", post({ statementLineId: l.id, counterAccountId: counterId }), "Entry posted and matched.")}
                              >
                                Post &amp; match
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#ECECF3] bg-white">
              <p className="border-b border-[#ECECF3] px-5 py-3 text-sm font-semibold text-[#20243A]">Ledger - not on statement ({ws.ledgerLines.length})</p>
              <table className="w-full text-sm">
                <tbody>
                  {ws.ledgerLines.length === 0 && (
                    <tr>
                      <td className="px-5 py-6 text-center text-[#666B84]">No outstanding ledger entries.</td>
                    </tr>
                  )}
                  {ws.ledgerLines.map((l) => (
                    <tr key={l.id} className={`border-b border-[#F3F3F8] ${pickLedger === l.id ? "bg-[#F3FBFA]" : ""}`}>
                      <td className="px-3 py-2">
                        <input type="radio" name="ledger" checked={pickLedger === l.id} onChange={() => setPickLedger(l.id)} />
                      </td>
                      <td className="py-2 pr-2 text-[#666B84]">{l.date}</td>
                      <td className="py-2 pr-2 text-[#20243A]">
                        {l.description} <span className="text-xs text-[#9AA0B5]">{l.reference}</span>
                      </td>
                      <td className={`py-2 pr-3 text-right font-medium ${l.net < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(l.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {ws.matchedLines.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-[#ECECF3] bg-white">
              <p className="border-b border-[#ECECF3] px-5 py-3 text-sm font-semibold text-[#20243A]">Matched, not yet reconciled ({ws.matchedLines.length})</p>
              <table className="w-full text-sm">
                <tbody>
                  {ws.matchedLines.map((m) => (
                    <tr key={m.id} className="border-b border-[#F3F3F8]">
                      <td className="px-5 py-2 text-[#666B84]">{m.transactionDate}</td>
                      <td className="py-2 pr-2 text-[#20243A]">{m.description}</td>
                      <td className="py-2 pr-2 text-xs text-[#9AA0B5]">{m.ledgerReference}</td>
                      <td className="py-2 pr-3 text-right font-medium">{money(m.amount)}</td>
                      <td className="py-2 pr-5 text-right">
                        <button className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600" disabled={busy} onClick={() => void act("/unmatch", post({ statementLineId: m.id }), "Unmatched.")}>
                          <Undo2 size={13} /> Unmatch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[#ECECF3] bg-white">
          <p className="border-b border-[#ECECF3] px-5 py-3 text-sm font-semibold text-[#20243A]">Completed reconciliations</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#666B84]">
                <th className="px-5 py-2">Statement date</th>
                <th className="py-2 text-right">Statement balance</th>
                <th className="py-2 text-right">Cleared</th>
                <th className="py-2 text-right">Outstanding</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-[#F3F3F8]">
                  <td className="px-5 py-2">{h.statementDate.slice(0, 10)}</td>
                  <td className="py-2 text-right">{money(h.statementBalance)}</td>
                  <td className="py-2 text-right">{h.clearedCount}</td>
                  <td className="py-2 text-right">{h.outstandingCount}</td>
                  <td className="px-5 py-2 text-right">
                    {h.id === latestId && (
                      <button
                        className="text-xs font-semibold text-rose-600"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm("Reopen the latest reconciliation? Its matches become editable again.")) {
                            void act(`/${h.id}`, { method: "DELETE" }, "Reconciliation reopened.");
                          }
                        }}
                      >
                        Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}