import React, { useState } from 'react';
import { PlusCircle, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const KES = (value: number) => 
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(value);

interface Invoice {
  id: string;
  clientName: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  dueDate: string;
}

interface InvoiceEngineProps {
  onAutoPostRevenue: (clientName: string, amount: number) => void;
}

export default function InvoiceEngine({ onAutoPostRevenue }: InvoiceEngineProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([
    { id: 'INV-001', clientName: 'Safaricom Corporate Suite', amount: 1200000, status: 'Paid', dueDate: '2026-06-15' },
    { id: 'INV-002', clientName: 'Equity Bank International', amount: 4500000, status: 'Pending', dueDate: '2026-07-20' },
  ]);

  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!clientName || isNaN(numAmount) || !dueDate) return;

    const newInvoice: Invoice = {
      id: `INV-00${invoices.length + 1}`,
      clientName,
      amount: numAmount,
      status: 'Pending',
      dueDate,
    };

    setInvoices([newInvoice, ...invoices]);
    setClientName('');
    setAmount('');
    setDueDate('');
  };

  const handleMarkAsPaid = (id: string, clientName: string, amount: number) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'Paid' } : inv));
    // Trigger automated general ledger transaction logging
    onAutoPostRevenue(`Invoice Payment Received - ${clientName}`, amount);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-5 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A] mb-4 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-[#20243A]" /> Generate New B2B Client Invoice
        </h3>
        <form onSubmit={handleCreateInvoice} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#666B84] font-medium">Client Enterprise Name</label>
            <input type="text" required placeholder="e.g., KCB Corporate" value={clientName} onChange={e => setClientName(e.target.value)} className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none focus:border-[#0D9488] transition-all" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[#666B84] font-medium">Invoice Value (KES)</label>
            <input type="number" required placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none focus:border-[#0D9488] transition-all font-mono font-bold" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[#666B84] font-medium">Payment Due Date</label>
            <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none focus:border-[#0D9488] transition-all" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full bg-[#0D9488] text-[#20243A] font-bold py-2.5 rounded-xl hover:bg-[#5a4de0] transition-all shadow-lg shadow-blue-600/10">
              Issue Corporate Invoice
            </button>
          </div>
        </form>
      </div>

      <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-5 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A] border-b border-[#ECECF3] pb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#20243A]" /> Active B2B Invoice Control Center
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-[#666B84]">
            <thead>
              <tr className="border-b border-[#ECECF3] text-[10px] uppercase font-bold text-[#666B84] tracking-wider">
                <th className="pb-3">Invoice Code</th>
                <th className="pb-3">Client Entity</th>
                <th className="pb-3">Due Date</th>
                <th className="pb-3">Billing Amount</th>
                <th className="pb-3">Tracking State</th>
                <th className="pb-3 text-right">Operational Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="py-3.5 font-mono font-bold text-[#666B84]">{inv.id}</td>
                  <td className="py-3.5 font-medium text-[#20243A]">{inv.clientName}</td>
                  <td className="py-3.5 font-mono text-[#666B84]">{inv.dueDate}</td>
                  <td className="py-3.5 font-mono font-bold text-[#20243A]">{KES(inv.amount)}</td>
                  <td className="py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' : inv.status === 'Pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {inv.status === 'Paid' ? <CheckCircle2 className="w-3 h-3" /> : inv.status === 'Pending' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    {inv.status === 'Pending' ? (
                      <button onClick={() => handleMarkAsPaid(inv.id, inv.clientName, inv.amount)} className="text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/20 transition-all">
                        Collect Payment
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-600 italic font-medium">No actions pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

