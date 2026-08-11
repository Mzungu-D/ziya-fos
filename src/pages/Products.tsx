import {
  BarChart3,
  Bot,
  Building2,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

const products = [
  {
    icon: Landmark,
    title: "Core Accounting",
    description:
      "A complete accounting foundation for managing your organization's financial records.",
    features: [
      "General Ledger",
      "Chart of Accounts",
      "Journal Entries",
      "Trial Balance",
      "Financial Reports",
    ],
  },
  {
    icon: ReceiptText,
    title: "Receivables & Payables",
    description:
      "Manage customer receivables and supplier obligations from one financial workspace.",
    features: [
      "Accounts Receivable",
      "Accounts Payable",
      "Customer Balances",
      "Vendor Payables",
      "Aging Analysis",
    ],
  },
  {
    icon: CreditCard,
    title: "Payments & Banking",
    description:
      "Connect financial activity across cash, banks and digital payment channels.",
    features: [
      "Bank Integration",
      "M-Pesa Integration",
      "Cash Management",
      "Reconciliation",
      "Payment Controls",
    ],
  },
  {
    icon: FileText,
    title: "Invoicing & Expenses",
    description:
      "Control billing, expenses and supporting financial documentation.",
    features: [
      "Invoicing",
      "Expense Management",
      "Documents",
      "Vendor Management",
      "Approvals",
    ],
  },
  {
    icon: Building2,
    title: "Multi-Company Finance",
    description:
      "Secure financial workspaces for organizations operating independently or across multiple companies.",
    features: [
      "Organization Workspaces",
      "Portfolio Companies",
      "Tenant Isolation",
      "Organization Switching",
      "Company Reporting",
    ],
  },
  {
    icon: Users,
    title: "Business Operations",
    description:
      "Connect operational processes directly to your financial environment.",
    features: [
      "Procurement",
      "HR Management",
      "Payroll",
      "Assets",
      "Tax Management",
    ],
  },
  {
    icon: BarChart3,
    title: "Analytics & Forecasting",
    description:
      "Turn financial activity into actionable information for management.",
    features: [
      "Financial Analytics",
      "Budgeting",
      "Forecasting",
      "Management Reporting",
      "Financial Health Insights",
    ],
  },
  {
    icon: Bot,
    title: "Financial Intelligence",
    description:
      "Apply intelligent analysis to financial patterns, risks and opportunities.",
    features: [
      "AI Financial Insights",
      "Predictive Analysis",
      "Fraud Detection",
      "Decision Support",
      "Automated Monitoring",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Control & Governance",
    description:
      "Protect financial operations with structured permissions and accountability.",
    features: [
      "Role-Based Access",
      "Custom Permissions",
      "Approval Workflows",
      "Audit Trails",
      "Organization Controls",
    ],
  },
];

export default function Products() {
  return (
    <div className="min-h-screen bg-[#081019] px-6 pb-24 pt-36 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e5b83b]">
            Products
          </p>

          <h1 className="mt-5 text-5xl font-medium tracking-[-0.045em] md:text-7xl">
            One system for your
            <br />
            financial operations.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60">
            Ziya FOS brings accounting, payments, operations, reporting and
            financial intelligence together in one secure environment.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const Icon = product.icon;

            return (
              <article
                key={product.title}
                className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7 transition hover:-translate-y-1 hover:bg-white/[0.06]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Icon size={23} />
                </div>

                <h2 className="mt-6 text-2xl font-semibold">
                  {product.title}
                </h2>

                <p className="mt-3 leading-7 text-white/55">
                  {product.description}
                </p>

                <ul className="mt-6 space-y-3 text-sm text-white/75">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span className="text-[#e5b83b]">•</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-20 rounded-[36px] bg-white p-8 text-[#081019] md:p-12">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-semibold md:text-4xl">
                Build your organization's financial workspace.
              </h2>

              <p className="mt-3 max-w-2xl text-black/60">
                Select the Ziya products your organization needs and apply for
                your own secure workspace.
              </p>
            </div>

            <Link
              to="/open-account"
              className="shrink-0 rounded-full bg-[#081019] px-7 py-4 text-center font-semibold text-[#20243A]"
            >
              Open account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}