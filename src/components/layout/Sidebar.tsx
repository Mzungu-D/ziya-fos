import { useState } from "react";
import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FileText,
  Landmark,
  Wallet,
  Receipt,
  Users,
  Building2,
  Briefcase,
  ShieldCheck,
  Brain,
  Settings,
  FileCheck,
  CreditCard,
  BarChart3,
  FolderOpen,
} from "lucide-react";

export default function Sidebar() {
  const [openSection, setOpenSection] = useState("core");

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? "" : section);
  };

  return (
    <aside className="w-80 bg-[#081224] border-r border-slate-800 min-h-screen p-6 overflow-y-auto">

      {/* Logo */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">
          Ziya FOS
        </h1>

        <p className="text-slate-500 text-sm mt-1">
          Financial Operating System
        </p>
      </div>

      {/* Dashboard */}
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `w-full flex items-center gap-4 px-4 py-3 rounded-xl mb-6 transition-all ${
            isActive
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`
        }
      >
        <LayoutDashboard size={20} />
        Dashboard
      </NavLink>

      {/* CORE FINANCIAL */}
      <Section
        title="CORE FINANCIAL"
        name="core"
        openSection={openSection}
        toggleSection={toggleSection}
      >
        <MenuItem icon={BookOpen} text="General Ledger" path="/dashboard/general-ledger" />
        <MenuItem icon={FileText} text="Chart of Accounts" path="/dashboard/chart-of-accounts" />
        <MenuItem icon={Receipt} text="Journal Entries" path="/dashboard/journal-entries" />
        <MenuItem icon={Landmark} text="Trial Balance" path="/dashboard/trial-balance" />
        <MenuItem icon={FileCheck} text="Financial Reports" path="/dashboard/financial-reports" />
      </Section>

      {/* BUSINESS OPERATIONS */}
      <Section
        title="BUSINESS OPERATIONS"
        name="operations"
        openSection={openSection}
        toggleSection={toggleSection}
      >
        <MenuItem icon={Wallet} text="Accounts Payable" path="/dashboard/accounts-payable" />
        <MenuItem icon={Receipt} text="Accounts Receivable" path="/dashboard/accounts-receivable" />
        <MenuItem icon={FileText} text="Invoicing" path="/dashboard/invoicing" />
        <MenuItem icon={CreditCard} text="Expenses" path="/dashboard/expenses" />
        <MenuItem icon={Landmark} text="Cash & Bank" path="/dashboard/cash-bank" />
        <MenuItem icon={Building2} text="Bank Integration" path="/dashboard/bank-integration" />
        <MenuItem icon={Wallet} text="M-Pesa Integration" path="/dashboard/mpesa-integration" />
        <MenuItem icon={Users} text="Portfolio Companies" path="/dashboard/portfolio-companies" />
        <MenuItem icon={Building2} text="Vendors" path="/dashboard/vendors" />
      </Section>

      {/* ADVANCED MODULES */}
      <Section
        title="ADVANCED MODULES"
        name="advanced"
        openSection={openSection}
        toggleSection={toggleSection}
      >
        <MenuItem icon={Users} text="HR Management" path="/dashboard/hr-management" />
        <MenuItem icon={Briefcase} text="Payroll" path="/dashboard/payroll" />
        <MenuItem icon={Building2} text="Procurement" path="/dashboard/procurement" />
        <MenuItem icon={Landmark} text="Assets" path="/dashboard/assets" />
        <MenuItem icon={FileCheck} text="Tax Management" path="/dashboard/tax-management" />
        <MenuItem icon={BarChart3} text="Budgeting & Forecasting" path="/dashboard/budgeting" />
      </Section>

      {/* INTELLIGENCE */}
      <Section
        title="INTELLIGENCE"
        name="intelligence"
        openSection={openSection}
        toggleSection={toggleSection}
      >
        <MenuItem icon={Brain} text="AI Assistant" path="/dashboard/ai-assistant" />
        <MenuItem icon={BarChart3} text="Analytics & Insights" path="/dashboard/analytics" />
        <MenuItem icon={ShieldCheck} text="Fraud Detection" path="/dashboard/fraud-detection" />
      </Section>

      {/* WORKFLOW & CONTROL */}
      <Section
        title="WORKFLOW & CONTROL"
        name="workflow"
        openSection={openSection}
        toggleSection={toggleSection}
      >
        <MenuItem icon={FileCheck} text="Approvals" path="/dashboard/approvals" />
        <MenuItem icon={FileText} text="Audit Trails" path="/dashboard/audit-trails" />
        <MenuItem icon={FolderOpen} text="Documents" path="/dashboard/documents" />
        <MenuItem icon={Settings} text="Settings" path="/dashboard/settings" />
      </Section>

    </aside>
  );
}

function MenuItem({
  icon: Icon,
  text,
  path = "#",
}: {
  icon: any;
  text: string;
  path?: string;
}) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
          isActive
            ? "bg-blue-600 text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
        }`
      }
    >
      <Icon size={18} />
      {text}
    </NavLink>
  );
}

function Section({
  title,
  name,
  openSection,
  toggleSection,
  children,
}: any) {
  return (
    <div className="mb-4">
      <button
        onClick={() => toggleSection(name)}
        className="w-full flex items-center justify-between text-slate-300 px-3 py-3 hover:text-white"
      >
        <span className="font-semibold">{title}</span>

        {openSection === name ? (
          <ChevronDown size={18} />
        ) : (
          <ChevronRight size={18} />
        )}
      </button>

      {openSection === name && (
        <div className="ml-4 mt-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}