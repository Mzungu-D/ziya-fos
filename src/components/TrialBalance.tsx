import React from 'react';

const KES = (value: number) => 
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(value);

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface TrialBalanceProps {
  accounts: Account[];
}

export default function TrialBalance({ accounts }: TrialBalanceProps) {
  // Calculate debits vs credits based on accounting rules
  // Assets and Expenses carry debit balances; Liabilities, Equity, and Revenue carry credit balances.
  const rows = accounts.map(acc => {
    const isDebitType = acc.type === 'Asset' || acc.type === 'Expense';
    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      debit: isDebitType ? acc.balance : 0,
      credit: !isDebitType ? acc.balance : 0,
    };
  });

  const totalDebits = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredits = rows.reduce((sum, row) => sum + row.credit, 0);
  const isBalanced = totalDebits === totalCredits;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Automated Trial Balance Verification</h2>
          <p className="text-xs text-slate-500 mt-1">Mathematical verification proving that system debits equal credits.</p>
        </div>
        
        <div className={`px-4 py-2 rounded-xl border text-xs font-bold tracking-wide shadow-lg ${
          isBalanced 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/5'
        }`}>
          {isBalanced ? '✓ LEDGER BALANCED & VERIFIED' : '⚠ WARNING: LEDGER UNBALANCED'}
        </div>
      </div>

      <div className="bg-[#101622] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-400">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="pb-3 w-24">Account Code</th>
                <th className="pb-3">Account Description</th>
                <th className="pb-3 w-32 text-right">Debit Balance (DR)</th>
                <th className="pb-3 w-32 text-right">Credit Balance (CR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-medium">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="py-3.5 font-mono font-bold text-slate-400">{row.id}</td>
                  <td className="py-3.5 text-white flex items-center gap-2">
                    {row.name}
                    <span className="text-[9px] uppercase font-bold text-slate-600 bg-black/30 border border-slate-800/80 px-1.5 py-0.5 rounded">
                      {row.type}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-right text-slate-300">
                    {row.debit > 0 ? KES(row.debit) : '—'}
                  </td>
                  <td className="py-3.5 font-mono text-right text-slate-300">
                    {row.credit > 0 ? KES(row.credit) : '—'}
                  </td>
                </tr>
              ))}
              
              {/* Grand Totals Verification Row */}
              <tr className="bg-black/30 border-t-2 border-slate-800 font-bold text-white">
                <td className="py-4 uppercase tracking-wider text-[10px] text-slate-400" colSpan={2}>
                  System Aggregate Totals
                </td>
                <td className="py-4 font-mono text-right text-blue-400 text-sm border-b-4 border-double border-slate-700">
                  {KES(totalDebits)}
                </td>
                <td className="py-4 font-mono text-right text-blue-400 text-sm border-b-4 border-double border-slate-700">
                  {KES(totalCredits)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}