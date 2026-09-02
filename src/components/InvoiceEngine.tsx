import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  PlusCircle,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';

import {
  createInvoice,
  fetchInvoices,
  type Invoice,
} from '../services/invoice';

/* =========================================================
   CURRENCY
========================================================= */

const KES = (value: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(value);

/* =========================================================
   TYPES
========================================================= */

interface InvoiceEngineProps {
  onAutoPostRevenue?: (
    clientName: string,
    amount: number
  ) => void;
}

/* =========================================================
   INVOICE STATUS
========================================================= */

const getInvoiceStatus = (
  invoice: Invoice
):
  | 'Paid'
  | 'Partially Paid'
  | 'Pending'
  | 'Overdue' => {
  const totalAmount =
    Number(invoice.totalAmount);

  const outstanding =
    Number(
      invoice.outstandingBalance ??
        totalAmount
    );

  /* ---------------------------------------------
     FULLY PAID
  --------------------------------------------- */

  if (
    outstanding <= 0 ||
    invoice.paymentStatus === 'PAID'
  ) {
    return 'Paid';
  }

  /* ---------------------------------------------
     PARTIALLY PAID
  --------------------------------------------- */

  if (
    invoice.paymentStatus ===
      'PARTIALLY_PAID' &&
    outstanding < totalAmount
  ) {
    return 'Partially Paid';
  }

  /* ---------------------------------------------
     OVERDUE
  --------------------------------------------- */

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const dueDate = new Date(
    invoice.dueDate
  );

  dueDate.setHours(
    0,
    0,
    0,
    0
  );

  if (dueDate < today) {
    return 'Overdue';
  }

  /* ---------------------------------------------
     NOT YET DUE
  --------------------------------------------- */

  return 'Pending';
};

/* =========================================================
   INVOICE ENGINE
========================================================= */

export default function InvoiceEngine({
  onAutoPostRevenue:
    _onAutoPostRevenue,
}: InvoiceEngineProps) {
  const [
    invoices,
    setInvoices,
  ] = useState<Invoice[]>([]);

  const [
    clientName,
    setClientName,
  ] = useState('');

  const [
    amount,
    setAmount,
  ] = useState('');

  const [
    dueDate,
    setDueDate,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  /* =======================================================
     LOAD INVOICES
  ======================================================= */

  const loadInvoices =
    async () => {
      try {
        setLoading(true);
        setError('');

        const response =
          await fetchInvoices();

        if (
          response.success
        ) {
          setInvoices(
            response.invoices ??
              []
          );
        } else {
          setError(
            response.message ||
              'Unable to load invoices.'
          );
        }
      } catch (err) {
        console.error(
          'Load invoices error:',
          err
        );

        setError(
          'Unable to load invoices. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void loadInvoices();
  }, []);

  /* =======================================================
     FINANCIAL SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      /* ---------------------------------------------
         TOTAL INVOICED
      --------------------------------------------- */

      const total =
        invoices.reduce(
          (
            sum,
            invoice
          ) =>
            sum +
            Number(
              invoice.totalAmount
            ),
          0
        );

      /* ---------------------------------------------
         TOTAL OUTSTANDING

         IMPORTANT:
         This comes from Accounts Receivable.
      --------------------------------------------- */

      const outstanding =
        invoices.reduce(
          (
            sum,
            invoice
          ) => {
            const invoiceTotal =
              Number(
                invoice.totalAmount
              );

            const invoiceOutstanding =
              Number(
                invoice.outstandingBalance ??
                  invoiceTotal
              );

            return (
              sum +
              Math.max(
                0,
                invoiceOutstanding
              )
            );
          },
          0
        );

      /* ---------------------------------------------
         TOTAL COLLECTED

         Collected =
         Invoice Total - AR Outstanding
      --------------------------------------------- */

      const collected =
        invoices.reduce(
          (
            sum,
            invoice
          ) => {
            const invoiceTotal =
              Number(
                invoice.totalAmount
              );

            const invoiceOutstanding =
              Math.max(
                0,
                Number(
                  invoice.outstandingBalance ??
                    invoiceTotal
                )
              );

            const invoiceCollected =
              Math.max(
                0,
                invoiceTotal -
                  invoiceOutstanding
              );

            return (
              sum +
              invoiceCollected
            );
          },
          0
        );

      /* ---------------------------------------------
         TOTAL OVERDUE

         Only the remaining outstanding amount
         is considered overdue.
      --------------------------------------------- */

      const overdue =
        invoices.reduce(
          (
            sum,
            invoice
          ) => {
            if (
              getInvoiceStatus(
                invoice
              ) !== 'Overdue'
            ) {
              return sum;
            }

            const invoiceTotal =
              Number(
                invoice.totalAmount
              );

            const invoiceOutstanding =
              Number(
                invoice.outstandingBalance ??
                  invoiceTotal
              );

            return (
              sum +
              Math.max(
                0,
                invoiceOutstanding
              )
            );
          },
          0
        );

      return {
        total,
        collected,
        outstanding,
        overdue,
      };
    }, [invoices]);

  /* =======================================================
     CREATE INVOICE
  ======================================================= */

  const handleCreateInvoice =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      const numAmount =
        Number(amount);

      if (
        !clientName.trim() ||
        !Number.isFinite(
          numAmount
        ) ||
        numAmount <= 0 ||
        !dueDate
      ) {
        setError(
          'Enter a valid customer, invoice amount, and due date.'
        );

        return;
      }

      try {
        setCreating(true);
        setError('');

        const today =
          new Date()
            .toISOString()
            .split('T')[0];

        const invoiceNumber =
          `INV-${Date.now()}`;

        const response =
          await createInvoice({
            invoiceNumber,

            customerName:
              clientName.trim(),

            description:
              `B2B invoice for ${clientName.trim()}`,

            subtotal:
              numAmount,

            taxAmount:
              0,

            totalAmount:
              numAmount,

            issueDate:
              today,

            dueDate,
          });

        if (
          !response.success
        ) {
          setError(
            response.message ||
              'Unable to create invoice.'
          );

          return;
        }

        setClientName('');
        setAmount('');
        setDueDate('');

        /*
         * Reload from backend so the Invoice Engine
         * receives the newly-created AR balance.
         */
        await loadInvoices();
      } catch (err) {
        console.error(
          'Create invoice error:',
          err
        );

        setError(
          'Unable to create invoice. Please try again.'
        );
      } finally {
        setCreating(false);
      }
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="flex flex-col gap-6">

      {/* =================================================
          FINANCIAL SUMMARY
      ================================================= */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* TOTAL INVOICED */}

        <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#666B84]">
            Total Invoiced
          </div>

          <div className="mt-2 text-xl font-bold text-[#20243A]">
            {KES(
              summary.total
            )}
          </div>
        </div>

        {/* COLLECTED */}

        <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#666B84]">
            Collected
          </div>

          <div className="mt-2 text-xl font-bold text-emerald-500">
            {KES(
              summary.collected
            )}
          </div>
        </div>

        {/* OUTSTANDING */}

        <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#666B84]">
            Outstanding
          </div>

          <div className="mt-2 text-xl font-bold text-amber-500">
            {KES(
              summary.outstanding
            )}
          </div>
        </div>

        {/* OVERDUE */}

        <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#666B84]">
            Overdue
          </div>

          <div className="mt-2 text-xl font-bold text-red-500">
            {KES(
              summary.overdue
            )}
          </div>
        </div>

      </div>

      {/* =================================================
          CREATE INVOICE
      ================================================= */}

      <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-5 shadow-xl">

        <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A] mb-4 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-[#20243A]" />

          Generate New B2B Client Invoice
        </h3>

        <form
          onSubmit={
            handleCreateInvoice
          }
          className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs"
        >

          {/* CLIENT */}

          <div className="flex flex-col gap-1.5">

            <label className="text-[#666B84] font-medium">
              Client Enterprise Name
            </label>

            <input
              type="text"
              required
              placeholder="e.g., KCB Corporate"
              value={
                clientName
              }
              onChange={(e) =>
                setClientName(
                  e.target.value
                )
              }
              className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none focus:border-[#0D9488] transition-all"
            />

          </div>

          {/* AMOUNT */}

          <div className="flex flex-col gap-1.5">

            <label className="text-[#666B84] font-medium">
              Invoice Value (KES)
            </label>

            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              value={
                amount
              }
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
              className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none focus:border-[#0D9488] transition-all font-mono font-bold"
            />

          </div>

          {/* DUE DATE */}

          <div className="flex flex-col gap-1.5">

            <label className="text-[#666B84] font-medium">
              Payment Due Date
            </label>

            <input
              type="date"
              required
              value={
                dueDate
              }
              onChange={(e) =>
                setDueDate(
                  e.target.value
                )
              }
              className="bg-black/40 border border-[#ECECF3] rounded-xl p-2.5 text-[#20243A] focus:outline-none focus:border-[#0D9488] transition-all"
            />

          </div>

          {/* SUBMIT */}

          <div className="flex items-end">

            <button
              type="submit"
              disabled={
                creating
              }
              className="w-full bg-[#0D9488] text-[#20243A] font-bold py-2.5 rounded-xl hover:bg-[#5a4de0] transition-all shadow-lg shadow-blue-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating
                ? 'Creating Invoice...'
                : 'Issue Corporate Invoice'}
            </button>

          </div>

        </form>

        {/* ERROR */}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">

            <AlertCircle className="w-4 h-4 shrink-0" />

            {error}

          </div>
        )}

      </div>

      {/* =================================================
          INVOICE CONTROL CENTER
      ================================================= */}

      <div className="bg-[#101622] border border-[#ECECF3] rounded-2xl p-5 shadow-xl">

        <div className="flex items-center justify-between border-b border-[#ECECF3] pb-3">

          <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A] flex items-center gap-2">

            <FileText className="w-4 h-4 text-[#20243A]" />

            Active B2B Invoice Control Center

          </h3>

          <button
            type="button"
            onClick={() =>
              void loadInvoices()
            }
            disabled={
              loading
            }
            className="p-2 rounded-lg hover:bg-black/10 transition-all disabled:opacity-50"
            title="Refresh invoices"
          >
            <RefreshCw
              className={`w-4 h-4 text-[#666B84] ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
          </button>

        </div>

        <div className="mt-4 overflow-x-auto">

          <table className="w-full text-left text-xs text-[#666B84]">

            <thead>

              <tr className="border-b border-[#ECECF3]">

                <th className="py-3 pr-4 font-bold">
                  Invoice
                </th>

                <th className="py-3 pr-4 font-bold">
                  Client
                </th>

                <th className="py-3 pr-4 font-bold">
                  Amount
                </th>

                <th className="py-3 pr-4 font-bold">
                  Due Date
                </th>

                <th className="py-3 pr-4 font-bold">
                  Status
                </th>

                <th className="py-3 text-right font-bold">
                  Action
                </th>

              </tr>

            </thead>

            <tbody>

              {/* LOADING */}

              {loading ? (

                <tr>

                  <td
                    colSpan={6}
                    className="py-10 text-center"
                  >

                    <div className="flex items-center justify-center gap-2">

                      <RefreshCw className="w-4 h-4 animate-spin" />

                      Loading invoices...

                    </div>

                  </td>

                </tr>

              ) : invoices.length === 0 ? (

                /* EMPTY */

                <tr>

                  <td
                    colSpan={6}
                    className="py-10 text-center"
                  >
                    No invoices found.
                  </td>

                </tr>

              ) : (

                /* INVOICES */

                invoices.map(
                  (invoice) => {
                    const status =
                      getInvoiceStatus(
                        invoice
                      );

                    const outstanding =
                      Number(
                        invoice.outstandingBalance ??
                          invoice.totalAmount
                      );

                    return (

                      <tr
                        key={
                          invoice.id
                        }
                        className="border-b border-[#ECECF3] last:border-0"
                      >

                        {/* INVOICE NUMBER */}

                        <td className="py-3.5 pr-4 font-mono font-bold text-[#20243A]">
                          {
                            invoice.invoiceNumber
                          }
                        </td>

                        {/* CLIENT */}

                        <td className="py-3.5 pr-4 text-[#20243A]">
                          {
                            invoice.customerName
                          }
                        </td>

                        {/* AMOUNT */}

                        <td className="py-3.5 pr-4 font-mono font-bold text-[#20243A]">

                          <div>
                            {KES(
                              Number(
                                invoice.totalAmount
                              )
                            )}
                          </div>

                          {outstanding <
                            Number(
                              invoice.totalAmount
                            ) &&
                            outstanding >
                              0 && (

                            <div className="text-[10px] text-amber-500 font-medium mt-0.5">

                              {KES(
                                outstanding
                              )}{' '}
                              outstanding

                            </div>

                          )}

                        </td>

                        {/* DUE DATE */}

                        <td className="py-3.5 pr-4">

                          {new Date(
                            invoice.dueDate
                          ).toLocaleDateString(
                            'en-KE'
                          )}

                        </td>

                        {/* STATUS */}

                        <td className="py-3.5 pr-4">

                          {status ===
                          'Paid' ? (

                            <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">

                              <CheckCircle2 className="w-3.5 h-3.5" />

                              Paid

                            </span>

                          ) : status ===
                            'Partially Paid' ? (

                            <span className="inline-flex items-center gap-1 text-blue-500 font-bold">

                              <CheckCircle2 className="w-3.5 h-3.5" />

                              Partially Paid

                            </span>

                          ) : status ===
                            'Overdue' ? (

                            <span className="inline-flex items-center gap-1 text-red-500 font-bold">

                              <AlertCircle className="w-3.5 h-3.5" />

                              Overdue

                            </span>

                          ) : (

                            <span className="inline-flex items-center gap-1 text-amber-500 font-bold">

                              <Clock className="w-3.5 h-3.5" />

                              Pending

                            </span>

                          )}

                        </td>

                        {/* ACTION */}

                        <td className="py-3.5 text-right">

                          <span className="text-[10px] text-slate-500 italic font-medium">
                            Manage payment in Accounts Receivable
                          </span>

                        </td>

                      </tr>

                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}