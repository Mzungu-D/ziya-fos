import React from 'react';

const KES = (value: number) => 
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(value);

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface LedgerBaseProps {
  accounts: Account[];
  onAddAccount: (id: string, name: string, type: string) => void;
}

export default function LedgerBase({ accounts, onAddAccount }: LedgerBaseProps) {
  const [newId, setNewId] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newType, setNewType] = React.useState('Asset');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newId || !newName) return;
    onAddAccount(newId, newName, newType);
    setNewId('');
    setNewName('');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A] mb-3">Configure New Financial Account</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <input type="text" placeholder="Account Code (e.g., 1020)" value={newId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewId(e.target.value)} className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none focus:border-blue-600" />
          <input type="text" placeholder="Account Name (e.g., M-Pesa Business)" value={newName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none focus:border-blue-600" />
          <select value={newType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewType(e.target.value)} className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none">
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Revenue">Revenue</option>
            <option value="Expense">Expense</option>
          </select>
          <button type="submit" className="bg-blue-600 text-[#20243A] font-bold rounded-xl hover:bg-blue-700 transition-all text-xs">Add to Chart of Accounts</button>
        </form>
      </div>

      <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A] border-b border-[#ECECF3] pb-3">Active Chart of Accounts Base</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-[#666B84]">
            <thead>
              <tr className="border-b border-[#ECECF3] text-[10px] uppercase font-bold text-[#666B84] tracking-wider">
                <th className="pb-3">Code</th>
                <th className="pb-3">Account Name</th>
                <th className="pb-3">Classification</th>
                <th className="pb-3 text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {accounts.map((acc: Account) => (
                <tr key={acc.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 font-mono font-bold text-[#666B84]">{acc.id}</td>
                  <td className="py-3 font-medium text-[#20243A]">{acc.name}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${acc.type === 'Asset' ? 'bg-blue-500/10 text-blue-400' : acc.type === 'Liability' ? 'bg-amber-500/10 text-amber-400' : acc.type === 'Revenue' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{acc.type}</span>
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-[#20243A]">{KES(acc.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}