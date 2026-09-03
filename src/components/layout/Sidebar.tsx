import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

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

import {
  authenticatedFetch,
  clearAuthenticatedSession,
} from "../../lib/auth";

interface OrgInfo {
  name?: string;
  logoUrl?: string | null;
  country?: string;
}

interface UserInfo {
  name?: string;
  email?: string;
}

interface OrganizationSettingsResponse {
  success: boolean;
  organization?: OrgInfo;
  message?: string;
}

interface NavChild {
  label: string;
  to: string;
}

interface NavItem {
  label: string;
  to?: string;
  icon: ReactNode;
  children?: readonly NavChild[];
}

function readJson<T>(key: string): T | null {
  try {
    const raw =
      localStorage.getItem(key) ??
      sessionStorage.getItem(key);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function initials(name?: string): string {
  const value = name?.trim();

  if (!value) {
    return "?";
  }

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((word) =>
      word.charAt(0).toUpperCase()
    )
    .join("");
}

/*
 * =========================================================
 * MAIN NAVIGATION
 * =========================================================
 *
 * Navigation visibility is intentionally independent from
 * the permission payload.
 *
 * The sidebar provides navigation.
 * The backend remains the authorization boundary.
 *
 * Protected APIs/routes must continue enforcing RBAC and
 * organization-level permissions.
 */

const MAIN_NAV: readonly NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: (
      <LayoutDashboard
        size={17}
        aria-hidden="true"
      />
    ),
  },

  {
    label: "Accounting",
    icon: (
      <BookOpen
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Chart of Accounts",
        to: "/dashboard/chart-of-accounts",
      },
      {
        label: "General Ledger",
        to: "/dashboard/general-ledger",
      },
      {
        label: "Journal Entries",
        to: "/dashboard/journal-entries",
      },
      {
        label: "Trial Balance",
        to: "/dashboard/trial-balance",
      },
      {
        label: "Financial Reports",
        to: "/dashboard/financial-reports",
      },
    ],
  },

  {
    label: "Receivables",
    icon: (
      <HandCoins
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Invoicing",
        to: "/dashboard/invoicing",
      },
      {
        label: "Accounts Receivable",
        to: "/dashboard/accounts-receivable",
      },
    ],
  },

  {
    label: "Payables",
    icon: (
      <CreditCard
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Accounts Payable",
        to: "/dashboard/accounts-payable",
      },
      {
        label: "Expenses",
        to: "/dashboard/expenses",
      },
      {
        label: "Vendors",
        to: "/dashboard/vendors",
      },
      {
        label: "Procurement",
        to: "/dashboard/procurement",
      },
    ],
  },

  {
    label: "Cash & Banking",
    icon: (
      <PiggyBank
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Cash & Bank",
        to: "/dashboard/cash-bank",
      },
      {
        label: "Bank Integration",
        to: "/dashboard/bank-integration",
      },
      {
        label: "M-Pesa",
        to: "/dashboard/mpesa-integration",
      },
    ],
  },

  {
    label: "Investments",
    icon: (
      <TrendingUp
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Portfolio Companies",
        to: "/dashboard/portfolio-companies",
      },
    ],
  },

  {
    label: "HR & Payroll",
    icon: (
      <Users
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "HR Management",
        to: "/dashboard/hr-management",
      },
      {
        label: "Payroll",
        to: "/dashboard/payroll",
      },
    ],
  },

  {
    label: "Assets",
    icon: (
      <Building2
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Fixed Assets",
        to: "/dashboard/assets",
      },
      {
        label: "Asset Assignments",
        to: "/dashboard/assets/assignments",
      },
      {
        label: "Tax Management",
        to: "/dashboard/tax-management",
      },
      {
        label: "Budgeting",
        to: "/dashboard/budgeting",
      },
    ],
  },

  {
    label: "Intelligence",
    icon: (
      <Bot
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Analytics",
        to: "/dashboard/analytics",
      },
      {
        label: "Fraud Detection",
        to: "/dashboard/fraud-detection",
      },
    ],
  },

  {
    label: "Workflow & Control",
    icon: (
      <ClipboardList
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Approvals",
        to: "/dashboard/approvals",
      },
      {
        label: "Audit Trails",
        to: "/dashboard/audit-trails",
      },
      {
        label: "Documents",
        to: "/dashboard/documents",
      },
    ],
  },
];

/*
 * =========================================================
 * SYSTEM NAVIGATION
 * =========================================================
 */

const SYSTEM_NAV: readonly NavItem[] = [
  {
    label: "Settings",
    to: "/dashboard/settings",
    icon: (
      <Settings
        size={17}
        aria-hidden="true"
      />
    ),
  },
];

/*
 * =========================================================
 * LEAF LINK
 * =========================================================
 */

function LeafLink({
  to,
  label,
}: NavChild) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-sm transition-colors ${
          isActive
            ? "font-semibold text-white"
            : "text-white/50 hover:bg-white/5 hover:text-white/80"
        }`
      }
    >
      <span
        className="h-1 w-1 rounded-full bg-current opacity-60"
        aria-hidden="true"
      />

      <span className="truncate">
        {label}
      </span>
    </NavLink>
  );
}

/*
 * =========================================================
 * NAV GROUP
 * =========================================================
 */

function NavGroup({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const hasActiveChild = useMemo(
    () =>
      item.children?.some(
        (child) =>
          pathname === child.to ||
          pathname.startsWith(
            `${child.to}/`
          )
      ) ?? false,
    [item.children, pathname]
  );

  const [open, setOpen] =
    useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) {
      setOpen(true);
    }
  }, [hasActiveChild]);

  if (!item.children) {
    return (
      <NavLink
        to={item.to!}
        end
        className={({ isActive }) =>
          `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? "bg-white text-[#20243A]"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`
        }
      >
        <span className="flex-shrink-0">
          {item.icon}
        </span>

        <span className="truncate">
          {item.label}
        </span>
      </NavLink>
    );
  }

  const sectionId = `nav-${item.label
    .replace(
      /[^a-z0-9]+/gi,
      "-"
    )
    .toLowerCase()}`;

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        aria-expanded={open}
        aria-controls={sectionId}
        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          hasActiveChild
            ? "bg-white/10 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex-shrink-0">
            {item.icon}
          </span>

          <span className="truncate">
            {item.label}
          </span>
        </span>

        {open ? (
          <ChevronDown
            size={13}
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            size={13}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          id={sectionId}
          className="mt-0.5 space-y-0.5"
        >
          {item.children.map(
            (child) => (
              <LeafLink
                key={child.to}
                {...child}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

/*
 * =========================================================
 * SECTION LABEL
 * =========================================================
 */

function SectionLabel({
  label,
}: {
  label: string;
}) {
  return (
    <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
      {label}
    </p>
  );
}

/*
 * =========================================================
 * SIDEBAR
 * =========================================================
 */

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } =
    useLocation();

  const [
    organization,
    setOrganization,
  ] =
    useState<OrgInfo | null>(() =>
      readJson<OrgInfo>(
        "organization"
      )
    );

  const user =
    readJson<UserInfo>("user");

  const userName =
    user?.name ?? "User";

  const orgName =
    organization?.name ??
    "Your Organisation";

  /*
   * =======================================================
   * LOAD ORGANIZATION
   * =======================================================
   */

  useEffect(() => {
    let cancelled = false;

    async function loadOrganization() {
      try {
        const response =
          await authenticatedFetch(
            "/api/settings/organization"
          );

        if (!response.ok) {
          throw new Error(
            `Unable to load organization (${response.status}).`
          );
        }

        const data =
          (await response.json()) as OrganizationSettingsResponse;

        if (
          cancelled ||
          !data.success ||
          !data.organization
        ) {
          return;
        }

        setOrganization(
          data.organization
        );

        try {
          localStorage.setItem(
            "organization",
            JSON.stringify(
              data.organization
            )
          );
        } catch {
          // Ignore local-storage failures.
        }
      } catch (error) {
        console.error(
          "[SIDEBAR] Failed to load organization:",
          error
        );
      }
    }

    void loadOrganization();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * =======================================================
   * LOGOUT
   * =======================================================
   */

  function handleLogout() {
    clearAuthenticatedSession();

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  }

  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col bg-[#0D9488]">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          {organization?.logoUrl ? (
            <img
              src={
                organization.logoUrl
              }
              alt={`${orgName} logo`}
              className="h-10 w-10 flex-shrink-0 rounded-xl border border-white/10 bg-white object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-sm font-bold text-[#20243A]"
            >
              {initials(orgName)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              {orgName}
            </p>

            <p className="truncate text-xs text-white/40">
              {organization?.country ??
                "Financial Operating System"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut
              size={16}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <nav
        aria-label="Financial Operating System navigation"
        className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4"
      >
        <SectionLabel label="Main" />

        {MAIN_NAV.map(
          (item) => (
            <NavGroup
              key={item.label}
              item={item}
              pathname={pathname}
            />
          )
        )}

        <SectionLabel label="System" />

        {SYSTEM_NAV.map(
          (item) => (
            <NavGroup
              key={item.label}
              item={item}
              pathname={pathname}
            />
          )
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-xs font-bold text-[#20243A]"
            >
              {initials(userName)}
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {userName}
              </p>

              <p className="truncate text-[10px] text-white/40">
                {user?.email ?? ""}
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="h-8 w-8 flex-shrink-0"
          />
        </div>
      </div>
    </aside>
  );
}