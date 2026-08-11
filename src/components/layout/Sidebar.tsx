import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";

import { clearAuthenticatedSession } from "../../lib/auth";

interface OrgInfo  { name?: string; logoUrl?: string | null; country?: string }
interface UserInfo { name?: string; email?: string }

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function initials(name?: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

interface NavItem {
  label:     string;
  to?:       string;
  icon:      React.ReactNode;
  children?: { label: string; to: string }[];
}

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: <LayoutDashboard size={17} /> },
  {
    label: "Core Financial", icon: <BookOpen size={17} />,
    children: [
      { label: "Chart of Accounts", to: "/dashboard/chart-of-accounts" },
      { label: "General Ledger",    to: "/dashboard/general-ledger"    },
      { label: "Journal Entries",   to: "/dashboard/journal-entries"   },
      { label: "Trial Balance",     to: "/dashboard/trial-balance"     },
      { label: "Financial Reports", to: "/dashboard/financial-reports" },
    ],
  },
  {
    label: "Receivables", icon: <HandCoins size={17} />,
    children: [
      { label: "Accounts Receivable", to: "/dashboard/accounts-receivable" },
      { label: "Invoicing",           to: "/dashboard/invoicing"           },
    ],
  },
  {
    label: "Payables", icon: <CreditCard size={17} />,
    children: [
      { label: "Accounts Payable", to: "/dashboard/accounts-payable" },
      { label: "Expenses",         to: "/dashboard/expenses"         },
      { label: "Vendors",          to: "/dashboard/vendors"          },
      { label: "Procurement",      to: "/dashboard/procurement"      },
    ],
  },
  {
    label: "Cash & Banking", icon: <PiggyBank size={17} />,
    children: [
      { label: "Cash & Bank",      to: "/dashboard/cash-bank"         },
      { label: "Bank Integration", to: "/dashboard/bank-integration"  },
      { label: "M-Pesa",           to: "/dashboard/mpesa-integration" },
    ],
  },
  {
    label: "Investments", icon: <TrendingUp size={17} />,
    children: [
      { label: "Portfolio Companies", to: "/dashboard/portfolio-companies" },
    ],
  },
  {
    label: "HR & Payroll", icon: <Users size={17} />,
    children: [
      { label: "HR Management", to: "/dashboard/hr-management" },
      { label: "Payroll",       to: "/dashboard/payroll"       },
    ],
  },
  {
    label: "Assets & Tax", icon: <Building2 size={17} />,
    children: [
      { label: "Fixed Assets",   to: "/dashboard/assets"         },
      { label: "Tax Management", to: "/dashboard/tax-management" },
      { label: "Budgeting",      to: "/dashboard/budgeting"      },
    ],
  },
  {
    label: "Intelligence", icon: <Bot size={17} />,
    children: [
      { label: "Analytics",       to: "/dashboard/analytics"       },
      { label: "Fraud Detection", to: "/dashboard/fraud-detection" },
    ],
  },
  {
    label: "Workflow & Control", icon: <ClipboardList size={17} />,
    children: [
      { label: "Approvals",    to: "/dashboard/approvals"    },
      { label: "Audit Trails", to: "/dashboard/audit-trails" },
      { label: "Documents",    to: "/dashboard/documents"    },
    ],
  },
  { label: "Settings", to: "/dashboard/settings", icon: <Settings size={17} /> },
];

function LeafLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-sm transition-colors ${
          isActive
            ? "font-semibold text-[#6D5DF6]"
            : "text-[#666B84] hover:text-[#20243A]"
        }`
      }
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-50" />
      {label}
    </NavLink>
  );
}

function NavGroup({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);

  if (!item.children) {
    return (
      <NavLink
        to={item.to!}
        end
        className={({ isActive }) =>
          `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? "bg-[#6D5DF6]/10 text-[#6D5DF6]"
              : "text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A]"
          }`
        }
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {item.label}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-[#666B84] transition-colors hover:bg-[#F8F9FC] hover:text-[#20243A]"
      >
        <span className="flex items-center gap-3">
          <span className="flex-shrink-0">{item.icon}</span>
          {item.label}
        </span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map((c) => (
            <LeafLink key={c.to} to={c.to} label={c.label} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const org      = readJson<OrgInfo>("organization");
  const user     = readJson<UserInfo>("user");
  const orgName  = org?.name  ?? "Your Organisation";
  const userName = user?.name ?? "User";

  function handleLogout() {
    clearAuthenticatedSession();
    navigate("/login");
  }

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-[#ECECF3] bg-white">

      {/* Org identity */}
      <div className="flex items-center gap-3 border-b border-[#ECECF3] px-5 py-5">
        {org?.logoUrl ? (
          <img
            src={org.logoUrl}
            alt={orgName}
            className="h-10 w-10 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#6D5DF6]/10 text-sm font-bold text-[#6D5DF6]">
            {initials(orgName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#20243A]">{orgName}</p>
          <p className="truncate text-xs text-[#94A3B8]">{org?.country ?? ""}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => (
          <NavGroup key={item.label} item={item} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-[#ECECF3] px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#6D5DF6]/10 text-xs font-bold text-[#6D5DF6]">
              {initials(userName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#20243A]">{userName}</p>
              <p className="truncate text-[10px] text-[#94A3B8]">{user?.email ?? ""}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F8F9FC] hover:text-[#EF4444]"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}