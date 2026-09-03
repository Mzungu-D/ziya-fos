import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PlusCircle,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

import {
  createInvoice,
  fetchInvoices,
  type Invoice,
} from "../services/invoice";

/* =========================================================
   CURRENCY
========================================================= */

const KES = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
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
  | "Paid"
  | "Partially Paid"
  | "Pending"
  | "Overdue" => {
  const totalAmount =
    Number(invoice.totalAmount);

  const outstanding =
    Number(
      invoice.outstandingBalance ??
        totalAmount
    );

  if (
    outstanding <= 0 ||
    invoice.paymentStatus === "PAID"
  ) {
    return "Paid";
  }

  if (
    invoice.paymentStatus ===
      "PARTIALLY_PAID" &&
    outstanding < totalAmount
  ) {
    return "Partially Paid";
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const dueDate =
    new Date(
      invoice.dueDate
    );

  dueDate.setHours(
    0,
    0,
    0,
    0
  );

  if (
    dueDate < today
  ) {
    return "Overdue";
  }

  return "Pending";
};

/* =========================================================
   INPUT STYLES
========================================================= */

const inputClass =
  "w-full bg-white border border-[#ECECF3] rounded-xl px-3 py-2.5 text-sm text-[#20243A] placeholder:text-[#999DB0] focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 transition-all";

const labelClass =
  "text-xs font-semibold text-[#666B84]";

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

  /* ---------------------------------------------------------
     FORM
  --------------------------------------------------------- */

  const [
    customerName,
    setCustomerName,
  ] = useState("");

  const [
    customerEmail,
    setCustomerEmail,
  ] = useState("");

  const [
    customerPhone,
    setCustomerPhone,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    subtotal,
    setSubtotal,
  ] = useState("");

  const [
    taxRate,
    setTaxRate,
  ] = useState("16");

  const [
    issueDate,
    setIssueDate,
  ] = useState(
    new Date()
      .toISOString()
      .split("T")[0]
  );

  const [
    dueDate,
    setDueDate,
  ] = useState("");

  /* ---------------------------------------------------------
     UI STATE
  --------------------------------------------------------- */

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
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  /* =========================================================
     LOAD INVOICES
  ========================================================= */

  const loadInvoices =
    async () => {
      try {
        setLoading(true);
        setError("");

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
              "Unable to load invoices."
          );
        }
      } catch (err) {
        console.error(
          "Load invoices error:",
          err
        );

        setError(
          "Unable to load invoices. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    void loadInvoices();
  }, []);

  /* =========================================================
     CALCULATED TAX + TOTAL
  ========================================================= */

  const calculatedValues =
    useMemo(() => {
      const subtotalValue =
        Number(subtotal);

      const rate =
        Number(taxRate);

      const safeSubtotal =
        Number.isFinite(
          subtotalValue
        ) &&
        subtotalValue > 0
          ? subtotalValue
          : 0;

      const safeRate =
        Number.isFinite(rate) &&
        rate >= 0
          ? rate
          : 0;

      const taxAmount =
        safeSubtotal *
        (safeRate / 100);

      const totalAmount =
        safeSubtotal +
        taxAmount;

      return {
        subtotal:
          safeSubtotal,
        taxRate:
          safeRate,
        taxAmount,
        totalAmount,
      };
    }, [
      subtotal,
      taxRate,
    ]);

  /* =========================================================
     FINANCIAL SUMMARY
  ========================================================= */

  const summary =
    useMemo(() => {
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

            return (
              sum +
              Math.max(
                0,
                invoiceTotal -
                  invoiceOutstanding
              )
            );
          },
          0
        );

      const overdue =
        invoices.reduce(
          (
            sum,
            invoice
          ) => {
            if (
              getInvoiceStatus(
                invoice
              ) !== "Overdue"
            ) {
              return sum;
            }

            const outstanding =
              Number(
                invoice.outstandingBalance ??
                  invoice.totalAmount
              );

            return (
              sum +
              Math.max(
                0,
                outstanding
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

  /* =========================================================
     RESET FORM
  ========================================================= */

  const resetForm =
    () => {
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setDescription("");
      setSubtotal("");
      setTaxRate("16");

      setIssueDate(
        new Date()
          .toISOString()
          .split("T")[0]
      );

      setDueDate("");
    };

  /* =========================================================
     CREATE INVOICE
  ========================================================= */

  const handleCreateInvoice =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      setError("");
      setSuccessMessage("");

      const normalizedCustomerName =
        customerName.trim();

      const normalizedEmail =
        customerEmail.trim();

      const normalizedPhone =
        customerPhone.trim();

      const normalizedDescription =
        description.trim();

      const subtotalValue =
        Number(subtotal);

      const rate =
        Number(taxRate);

      if (
        !normalizedCustomerName
      ) {
        setError(
          "Customer name is required."
        );
        return;
      }

      if (
        !Number.isFinite(
          subtotalValue
        ) ||
        subtotalValue <= 0
      ) {
        setError(
          "Enter a valid subtotal greater than zero."
        );
        return;
      }

      if (
        !Number.isFinite(rate) ||
        rate < 0 ||
        rate > 100
      ) {
        setError(
          "Tax rate must be between 0% and 100%."
        );
        return;
      }

      if (!issueDate) {
        setError(
          "Issue date is required."
        );
        return;
      }

      if (!dueDate) {
        setError(
          "Due date is required."
        );
        return;
      }

      const parsedIssueDate =
        new Date(issueDate);

      const parsedDueDate =
        new Date(dueDate);

      if (
        parsedDueDate <
        parsedIssueDate
      ) {
        setError(
          "Due date cannot be before issue date."
        );
        return;
      }

      const taxAmount =
        Number(
          (
            subtotalValue *
            (rate / 100)
          ).toFixed(2)
        );

      const totalAmount =
        Number(
          (
            subtotalValue +
            taxAmount
          ).toFixed(2)
        );

      try {
        setCreating(true);

        /*
         * IMPORTANT:
         *
         * No invoice number is generated here.
         *
         * The backend generates the official
         * tenant-scoped invoice number.
         */
        const response =
          await createInvoice({
            customerName:
              normalizedCustomerName,

            customerEmail:
              normalizedEmail ||
              null,

            customerPhone:
              normalizedPhone ||
              null,

            description:
              normalizedDescription,

            subtotal:
              subtotalValue,

            taxAmount,

            totalAmount,

            issueDate,

            dueDate,
          });

        if (
          !response.success
        ) {
          setError(
            response.message ||
              "Unable to create invoice."
          );

          return;
        }

        const generatedNumber =
          response.invoice
            ?.invoiceNumber;

        resetForm();

        /*
         * Reload from backend so the
         * Invoice Engine receives the
         * newly-created AR balance.
         */
        await loadInvoices();

        setSuccessMessage(
          generatedNumber
            ? `Invoice ${generatedNumber} created successfully.`
            : "Invoice created successfully."
        );
      } catch (err) {
        console.error(
          "Create invoice error:",
          err
        );

        setError(
          "Unable to create invoice. Please try again."
        );
      } finally {
        setCreating(false);
      }
    };

  /* =========================================================
     RENDER
  ========================================================= */

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

      <div className="bg-white border border-[#ECECF3] rounded-2xl p-6 shadow-sm">

        <div className="flex items-start justify-between gap-4 mb-6">

          <div>
            <h3 className="text-sm font-bold text-[#20243A] flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#0D9488]" />

              Create Customer Invoice
            </h3>

            <p className="mt-1 text-xs text-[#666B84]">
              Create a customer invoice. The official invoice number is generated automatically.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-[#F5F5F8] px-3 py-2 text-[10px] font-semibold text-[#666B84]">
            <FileText className="w-3.5 h-3.5" />

            Invoice number: Auto-generated
          </div>

        </div>

        <form
          onSubmit={
            handleCreateInvoice
          }
          className="space-y-6"
        >

          {/* =================================================
              INVOICE INFORMATION
          ================================================= */}

          <div>

            <div className="mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
                Invoice Information
              </h4>

              <p className="mt-1 text-xs text-[#666B84]">
                The invoice number will be generated by the system after creation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* INVOICE NUMBER */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Invoice Number
                </label>

                <div className="flex items-center min-h-[42px] rounded-xl border border-dashed border-[#D9D9E3] bg-[#F8F8FA] px-3">

                  <span className="font-mono text-sm font-semibold text-[#666B84]">
                    Generated automatically
                  </span>

                </div>

              </div>

              {/* ISSUE DATE */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Issue Date *
                </label>

                <input
                  type="date"
                  required
                  value={
                    issueDate
                  }
                  onChange={(e) =>
                    setIssueDate(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />

              </div>

            </div>

          </div>

          {/* =================================================
              CUSTOMER DETAILS
          ================================================= */}

          <div>

            <div className="mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
                Customer Details
              </h4>

              <p className="mt-1 text-xs text-[#666B84]">
                Enter the customer information that will appear on the invoice.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* CUSTOMER */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Customer Name *
                </label>

                <input
                  type="text"
                  required
                  placeholder="e.g. KCB Corporate"
                  value={
                    customerName
                  }
                  onChange={(e) =>
                    setCustomerName(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />

              </div>

              {/* EMAIL */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Customer Email
                </label>

                <input
                  type="email"
                  placeholder="customer@company.com"
                  value={
                    customerEmail
                  }
                  onChange={(e) =>
                    setCustomerEmail(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />

              </div>

              {/* PHONE */}

              <div className="flex flex-col gap-1.5 md:col-span-2">

                <label
                  className={
                    labelClass
                  }
                >
                  Customer Phone
                </label>

                <input
                  type="tel"
                  placeholder="+254 7XX XXX XXX"
                  value={
                    customerPhone
                  }
                  onChange={(e) =>
                    setCustomerPhone(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />

              </div>

              {/* DESCRIPTION */}

              <div className="flex flex-col gap-1.5 md:col-span-2">

                <label
                  className={
                    labelClass
                  }
                >
                  Description
                </label>

                <textarea
                  rows={3}
                  placeholder="Describe the goods or services covered by this invoice."
                  value={
                    description
                  }
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />

              </div>

            </div>

          </div>

          {/* =================================================
              AMOUNTS
          ================================================= */}

          <div>

            <div className="mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
                Invoice Amount
              </h4>

              <p className="mt-1 text-xs text-[#666B84]">
                Enter the subtotal and tax rate. Tax and total are calculated automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* SUBTOTAL */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Subtotal (KES) *
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={
                    subtotal
                  }
                  onChange={(e) =>
                    setSubtotal(
                      e.target.value
                    )
                  }
                  className={`${inputClass} font-mono font-semibold`}
                />

              </div>

              {/* TAX RATE */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Tax Rate (%)
                </label>

                <div className="relative">

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      taxRate
                    }
                    onChange={(e) =>
                      setTaxRate(
                        e.target.value
                      )
                    }
                    className={`${inputClass} pr-9 font-mono`}
                  />

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#666B84]">
                    %
                  </span>

                </div>

              </div>

              {/* TAX AMOUNT */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Tax Amount (KES)
                </label>

                <div className="flex items-center min-h-[42px] rounded-xl border border-[#ECECF3] bg-[#F8F8FA] px-3">

                  <span className="font-mono text-sm font-semibold text-[#20243A]">
                    {KES(
                      calculatedValues.taxAmount
                    )}
                  </span>

                </div>

              </div>

            </div>

            {/* TOTAL */}

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#DDEAE8] bg-[#F3FAF9] px-4 py-4">

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#666B84]">
                  Invoice Total
                </div>

                <div className="mt-1 text-xs text-[#666B84]">
                  Subtotal + tax
                </div>
              </div>

              <div className="font-mono text-xl font-bold text-[#0D9488]">
                {KES(
                  calculatedValues.totalAmount
                )}
              </div>

            </div>

          </div>

          {/* =================================================
              PAYMENT TERMS
          ================================================= */}

          <div>

            <div className="mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#20243A]">
                Payment Terms
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* ISSUE DATE */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Issue Date *
                </label>

                <input
                  type="date"
                  required
                  value={
                    issueDate
                  }
                  onChange={(e) =>
                    setIssueDate(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />

              </div>

              {/* DUE DATE */}

              <div className="flex flex-col gap-1.5">

                <label
                  className={
                    labelClass
                  }
                >
                  Due Date *
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
                  className={
                    inputClass
                  }
                />

              </div>

            </div>

          </div>

          {/* =================================================
              MESSAGES
          ================================================= */}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-600">

              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

              <span>
                {error}
              </span>

            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">

              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />

              <span>
                {successMessage}
              </span>

            </div>
          )}

          {/* =================================================
              SUBMIT
          ================================================= */}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[#ECECF3] pt-5">

            <div className="text-xs text-[#666B84]">
              The invoice will automatically create a corresponding Accounts Receivable entry.
            </div>

            <button
              type="submit"
              disabled={
                creating
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-3 text-sm font-bold text-white hover:bg-[#0B7F75] transition-all shadow-lg shadow-teal-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Creating Invoice...
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  Issue Corporate Invoice
                </>
              )}
            </button>

          </div>

        </form>

      </div>

      {/* =================================================
          INVOICE CONTROL CENTER
      ================================================= */}

      <div className="bg-white border border-[#ECECF3] rounded-2xl p-5 shadow-sm">

        <div className="flex items-center justify-between border-b border-[#ECECF3] pb-3">

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A] flex items-center gap-2">

              <FileText className="w-4 h-4 text-[#0D9488]" />

              Active B2B Invoice Control Center

            </h3>

            <p className="mt-1 text-xs text-[#666B84]">
              Created invoices and their current receivable position.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadInvoices()
            }
            disabled={
              loading
            }
            className="p-2 rounded-lg hover:bg-[#F5F5F8] transition-all disabled:opacity-50"
            title="Refresh invoices"
          >
            <RefreshCw
              className={`w-4 h-4 text-[#666B84] ${
                loading
                  ? "animate-spin"
                  : ""
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
                <tr>

                  <td
                    colSpan={6}
                    className="py-10 text-center"
                  >
                    No invoices found.
                  </td>

                </tr>
              ) : (
                invoices.map(
                  (invoice) => {
                    const status =
                      getInvoiceStatus(
                        invoice
                      );

                    const totalAmount =
                      Number(
                        invoice.totalAmount
                      );

                    const outstanding =
                      Number(
                        invoice.outstandingBalance ??
                          totalAmount
                      );

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                        className="border-b border-[#ECECF3] last:border-0"
                      >

                        {/* INVOICE NUMBER */}

                        <td className="py-3.5 pr-4">

                          <div className="font-mono font-bold text-[#20243A]">
                            {
                              invoice.invoiceNumber
                            }
                          </div>

                        </td>

                        {/* CLIENT */}

                        <td className="py-3.5 pr-4 text-[#20243A]">

                          {
                            invoice.customerName
                          }

                          {invoice.customerEmail && (
                            <div className="mt-0.5 text-[10px] text-[#999DB0]">
                              {
                                invoice.customerEmail
                              }
                            </div>
                          )}

                        </td>

                        {/* AMOUNT */}

                        <td className="py-3.5 pr-4 font-mono font-bold text-[#20243A]">

                          <div>
                            {KES(
                              totalAmount
                            )}
                          </div>

                          {outstanding <
                            totalAmount &&
                            outstanding >
                              0 && (
                              <div className="text-[10px] text-amber-500 font-medium mt-0.5">
                                {KES(
                                  outstanding
                                )}{" "}
                                outstanding
                              </div>
                            )}

                        </td>

                        {/* DUE DATE */}

                        <td className="py-3.5 pr-4">

                          {new Date(
                            invoice.dueDate
                          ).toLocaleDateString(
                            "en-KE"
                          )}

                        </td>

                        {/* STATUS */}

                        <td className="py-3.5 pr-4">

                          {status ===
                          "Paid" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">

                              <CheckCircle2 className="w-3.5 h-3.5" />

                              Paid

                            </span>
                          ) : status ===
                            "Partially Paid" ? (
                            <span className="inline-flex items-center gap-1 text-blue-500 font-bold">

                              <CheckCircle2 className="w-3.5 h-3.5" />

                              Partially Paid

                            </span>
                          ) : status ===
                            "Overdue" ? (
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