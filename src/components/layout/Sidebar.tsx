import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

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

/* =========================================================
   TYPES
========================================================= */

interface OrgInfo {
  name?: string;
  logoUrl?: string | null;
  country?: string;
}

interface UserInfo {
  name?: string;
  email?: string;
}

interface MembershipInfo {
  id?: string;
  role?: string;
  permissions?: string[];
  isDefault?: boolean;
  joinedAt?: string;
}

interface OrganizationSettingsResponse {
  success: boolean;
  organization?: OrgInfo;
  membership?: MembershipInfo;
  message?: string;
}

interface NavChild {
  label: string;
  to: string;
  permissions?: string[];
}

interface NavItem {
  label: string;
  to?: string;
  icon: React.ReactNode;
  children?: NavChild[];
  permissions?: string[];
}

/* =========================================================
   LOCAL STORAGE HELPERS
========================================================= */

function readJson<T>(
  key: string
): T | null {
  try {
    const raw =
      localStorage.getItem(key) ??
      sessionStorage.getItem(key);

    return raw
      ? (JSON.parse(raw) as T)
      : null;
  } catch {
    return null;
  }
}

function initials(
  name?: string
): string {
  if (!name) {
    return "?";
  }

  return name
    .split(" ")
    .slice(0, 2)
    .map((word) =>
      word.charAt(0).toUpperCase()
    )
    .join("");
}

/* =========================================================
   PERMISSION HELPERS
========================================================= */

function hasPermission(
  permissions: Set<string>,
  requiredPermissions?: string[]
): boolean {
  /*
   * No permission requirement means the item is
   * available to every authenticated organization user.
   */
  if (
    !requiredPermissions ||
    requiredPermissions.length === 0
  ) {
    return true;
  }

  /*
   * OWNER / server wildcard.
   *
   * The backend remains the real security boundary.
   * This only controls frontend visibility.
   */
  if (permissions.has("*")) {
    return true;
  }

  /*
   * A navigation item is visible when the user has
   * at least one permission required by that item.
   */
  return requiredPermissions.some(
    (permission) =>
      permissions.has(permission)
  );
}

/* =========================================================
   NAVIGATION

   IMPORTANT:

   These permissions are only for frontend visibility.

   The backend MUST continue enforcing the same
   permissions with requirePermission().
========================================================= */

const MAIN_NAV: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: (
      <LayoutDashboard size={17} />
    ),
  },

  /* =======================================================
     ACCOUNTING
  ======================================================= */

  {
    label: "Accounting",
    icon: <BookOpen size={17} />,

    permissions: [
      "account.view",
      "account.create",
      "account.update",
      "journal.view",
      "journal.create",
      "journal.update",
      "journal.post",
      "journal.approve",
      "ledger.view",
    ],

    children: [
      {
        label: "Chart of Accounts",
        to: "/dashboard/chart-of-accounts",
        permissions: [
          "account.view",
          "account.create",
          "account.update",
        ],
      },

      {
        label: "General Ledger",
        to: "/dashboard/general-ledger",
        permissions: [
          "ledger.view",
        ],
      },

      {
        label: "Journal Entries",
        to: "/dashboard/journal-entries",
        permissions: [
          "journal.view",
          "journal.create",
          "journal.update",
          "journal.post",
          "journal.approve",
        ],
      },

      {
        label: "Trial Balance",
        to: "/dashboard/trial-balance",
        permissions: [
          "ledger.view",
          "reports.view",
        ],
      },

      {
        label: "Financial Reports",
        to: "/dashboard/financial-reports",
        permissions: [
          "reports.view",
        ],
      },
    ],
  },

  /* =======================================================
     RECEIVABLES
  ======================================================= */

  {
    label: "Receivables",
    icon: (
      <HandCoins size={17} />
    ),

    permissions: [
      "accountsReceivable.view",
      "accountsReceivable.create",
      "accountsReceivable.update",
      "accountsReceivable.payment",
      "accountsReceivable.approve",
      "invoice.view",
      "invoice.create",
    ],

    children: [
      {
        label: "Accounts Receivable",
        to: "/dashboard/accounts-receivable",
        permissions: [
          "accountsReceivable.view",
          "accountsReceivable.create",
          "accountsReceivable.update",
          "accountsReceivable.payment",
          "accountsReceivable.approve",
        ],
      },

      {
        label: "Invoicing",
        to: "/dashboard/invoicing",
        permissions: [
          "invoice.view",
          "invoice.create",
        ],
      },
    ],
  },

  /* =======================================================
     PAYABLES
  ======================================================= */

  {
    label: "Payables",
    icon: (
      <CreditCard size={17} />
    ),

    permissions: [
      "accountsPayable.view",
      "accountsPayable.create",
      "accountsPayable.payment",
      "accountsPayable.approve",
      "expense.view",
      "expense.create",
      "vendor.view",
      "vendor.create",
      "vendor.update",
      "vendor.status",
    ],

    children: [
      {
        label: "Accounts Payable",
        to: "/dashboard/accounts-payable",
        permissions: [
          "accountsPayable.view",
          "accountsPayable.create",
          "accountsPayable.payment",
          "accountsPayable.approve",
        ],
      },

      {
        label: "Expenses",
        to: "/dashboard/expenses",
        permissions: [
          "expense.view",
          "expense.create",
        ],
      },

      {
        label: "Vendors",
        to: "/dashboard/vendors",
        permissions: [
          "vendor.view",
          "vendor.create",
          "vendor.update",
          "vendor.status",
        ],
      },

      {
        label: "Procurement",
        to: "/dashboard/procurement",
        permissions: [
          "accountsPayable.view",
          "accountsPayable.create",
          "vendor.view",
          "vendor.create",
          "vendor.update",
        ],
      },
    ],
  },

  /* =======================================================
     CASH & BANKING
  ======================================================= */

  {
    label: "Cash & Banking",
    icon: (
      <PiggyBank size={17} />
    ),

    permissions: [
      "bankAccount.view",
      "bankAccount.create",
      "bankPayment.view",
      "bankPayment.create",
      "mpesa.view",
      "mpesa.create",
    ],

    children: [
      {
        label: "Cash & Bank",
        to: "/dashboard/cash-bank",
        permissions: [
          "bankAccount.view",
          "bankAccount.create",
          "bankPayment.view",
          "bankPayment.create",
        ],
      },

      {
        label: "Bank Integration",
        to: "/dashboard/bank-integration",
        permissions: [
          "bankAccount.view",
          "bankAccount.create",
        ],
      },

      {
        label: "M-Pesa",
        to: "/dashboard/mpesa-integration",
        permissions: [
          "mpesa.view",
          "mpesa.create",
        ],
      },
    ],
  },

  /* =======================================================
     INVESTMENTS
  ======================================================= */

  {
    label: "Investments",
    icon: (
      <TrendingUp size={17} />
    ),

    permissions: [
      "portfolioCompany.view",
      "portfolioCompany.create",
      "portfolioCompany.update",
    ],

    children: [
      {
        label: "Portfolio Companies",
        to: "/dashboard/portfolio-companies",
        permissions: [
          "portfolioCompany.view",
          "portfolioCompany.create",
          "portfolioCompany.update",
        ],
      },
    ],
  },

  /* =======================================================
     HR & PAYROLL
  ======================================================= */

  {
    label: "HR & Payroll",
    icon: (
      <Users size={17} />
    ),

    permissions: [
      "employee.view",
      "employee.create",
      "employee.update",
      "payroll.view",
      "payroll.create",
      "payroll.update",
    ],

    children: [
      {
        label: "HR Management",
        to: "/dashboard/hr-management",
        permissions: [
          "employee.view",
          "employee.create",
          "employee.update",
        ],
      },

      {
        label: "Payroll",
        to: "/dashboard/payroll",
        permissions: [
          "payroll.view",
          "payroll.create",
          "payroll.update",
        ],
      },
    ],
  },

  /* =======================================================
     ASSETS
  ======================================================= */

  {
    label: "Assets",
    icon: (
      <Building2 size={17} />
    ),

    permissions: [
      "asset.view",
      "asset.create",
      "asset.update",
      "asset.delete",
      "assetAssignment.view",
      "assetAssignment.create",
      "assetAssignment.update",
    ],

    children: [
      {
        label: "Fixed Assets",
        to: "/dashboard/assets",
        permissions: [
          "asset.view",
          "asset.create",
          "asset.update",
          "asset.delete",
        ],
      },

      {
        label: "Asset Assignments",
        to: "/dashboard/assets/assignments",
        permissions: [
          "assetAssignment.view",
          "assetAssignment.create",
          "assetAssignment.update",
        ],
      },

      {
        label: "Tax Management",
        to: "/dashboard/tax-management",
        permissions: [
          "tax.view",
          "tax.create",
          "tax.update",
        ],
      },

      {
        label: "Budgeting",
        to: "/dashboard/budgeting",
        permissions: [
          "budget.view",
          "budget.create",
          "budget.update",
        ],
      },
    ],
  },

  /* =======================================================
     INTELLIGENCE
  ======================================================= */

  {
    label: "Intelligence",
    icon: <Bot size={17} />,

    permissions: [
      "reports.view",
      "analytics.view",
      "fraud.view",
    ],

    children: [
      {
        label: "Analytics",
        to: "/dashboard/analytics",
        permissions: [
          "reports.view",
          "analytics.view",
        ],
      },

      {
        label: "Fraud Detection",
        to: "/dashboard/fraud-detection",
        permissions: [
          "fraud.view",
          "reports.view",
        ],
      },
    ],
  },

  /* =======================================================
     WORKFLOW & CONTROL
  ======================================================= */

  {
    label: "Workflow & Control",
    icon: (
      <ClipboardList size={17} />
    ),

    permissions: [
      "approval.view",
      "approval.create",
      "approval.approve",
      "audit.view",
      "document.view",
      "document.create",
    ],

    children: [
      {
        label: "Approvals",
        to: "/dashboard/approvals",
        permissions: [
          "approval.view",
          "approval.create",
          "approval.approve",
        ],
      },

      {
        label: "Audit Trails",
        to: "/dashboard/audit-trails",
        permissions: [
          "audit.view",
          "reports.view",
        ],
      },

      {
        label: "Documents",
        to: "/dashboard/documents",
        permissions: [
          "document.view",
          "document.create",
        ],
      },
    ],
  },
];

/* =========================================================
   SYSTEM NAVIGATION

   Settings is intentionally available to authenticated
   organization users.

   Individual settings operations are protected by the
   backend permission middleware.
========================================================= */

const SYSTEM_NAV: NavItem[] = [
  {
    label: "Settings",
    to: "/dashboard/settings",
    icon: <Settings size={17} />,
  },
];

/* =========================================================
   FILTER NAVIGATION
========================================================= */

function filterNavigation(
  items: NavItem[],
  permissions: Set<string>
): NavItem[] {
  return items
    .map((item) => {
      if (!item.children) {
        return hasPermission(
          permissions,
          item.permissions
        )
          ? item
          : null;
      }

      const visibleChildren =
        item.children.filter(
          (child) =>
            hasPermission(
              permissions,
              child.permissions
            )
        );

      /*
       * Never show an empty parent group.
       */
      if (
        visibleChildren.length === 0
      ) {
        return null;
      }

      return {
        ...item,
        children:
          visibleChildren,
      };
    })
    .filter(
      (item): item is NavItem =>
        item !== null
    );
}

/* =========================================================
   LEAF LINK
========================================================= */

function LeafLink({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-sm transition-colors ${
          isActive
            ? "font-semibold text-white"
            : "text-white/50 hover:text-white/80"
        }`
      }
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
      {label}
    </NavLink>
  );
}

/* =========================================================
   NAV GROUP
========================================================= */

function NavGroup({
  item,
}: {
  item: NavItem;
}) {
  const [open, setOpen] =
    useState(false);

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

        {item.label}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <span className="flex items-center gap-3">
          <span className="flex-shrink-0">
            {item.icon}
          </span>

          {item.label}
        </span>

        {open ? (
          <ChevronDown size={13} />
        ) : (
          <ChevronRight size={13} />
        )}
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map(
            (child) => (
              <LeafLink
                key={child.to}
                to={child.to}
                label={child.label}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SECTION LABEL
========================================================= */

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

/* =========================================================
   SIDEBAR
========================================================= */

export default function Sidebar() {
  const navigate =
    useNavigate();

  const [organization, setOrganization] =
    useState<OrgInfo | null>(
      () =>
        readJson<OrgInfo>(
          "organization"
        )
    );

  const [membership, setMembership] =
    useState<MembershipInfo | null>(
      null
    );

  const [loadingPermissions, setLoadingPermissions] =
    useState(true);

  const user =
    readJson<UserInfo>("user");

  const userName =
    user?.name ?? "User";

  /* =======================================================
     LOAD CURRENT ORGANIZATION MEMBERSHIP

     The server is the source of truth.

     We do NOT trust permissions stored in localStorage.
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      try {
        const response =
          await authenticatedFetch(
            "/api/settings/organization"
          );

        if (!response.ok) {
          throw new Error(
            `Unable to load organization access (${response.status}).`
          );
        }

        const data =
          (await response.json()) as OrganizationSettingsResponse;

        if (
          cancelled ||
          !data.success
        ) {
          return;
        }

        if (data.organization) {
          setOrganization(
            data.organization
          );

          /*
           * Keep the existing organization
           * cache synchronized for other
           * UI components.
           */
          try {
            localStorage.setItem(
              "organization",
              JSON.stringify(
                data.organization
              )
            );
          } catch {
            // Cache failure must not affect authorization.
          }
        }

        if (data.membership) {
          setMembership(
            data.membership
          );
        }
      } catch (error) {
        console.error(
          "[SIDEBAR] Failed to load organization permissions:",
          error
        );

        /*
         * Do not manufacture permissions when
         * the server cannot provide them.
         *
         * This is deliberately fail-closed for
         * protected navigation.
         */
        if (!cancelled) {
          setMembership(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingPermissions(
            false
          );
        }
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     CURRENT PERMISSIONS

     OWNER / "*" receives all frontend modules.
     Normal users only receive their explicit
     OrganizationMember permissions.
  ======================================================= */

  const permissions =
    useMemo(
      () =>
        new Set(
          membership?.permissions ??
            []
        ),
      [membership?.permissions]
    );

  const visibleMainNavigation =
    useMemo(
      () =>
        filterNavigation(
          MAIN_NAV,
          permissions
        ),
      [permissions]
    );

  /*
   * Settings remains visible while its individual
   * operations remain protected server-side.
   */
  const visibleSystemNavigation =
    SYSTEM_NAV;

  const orgName =
    organization?.name ??
    "Your Organisation";

  function handleLogout() {
    clearAuthenticatedSession();
    navigate("/login");
  }

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col bg-[#0D9488]">
      {/* ===================================================
          ORGANIZATION HEADER
      =================================================== */}

      <div className="flex items-center gap-3 px-5 py-5">
        {organization?.logoUrl ? (
          <img
            src={
              organization.logoUrl
            }
            alt={orgName}
            className="h-10 w-10 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-sm font-bold text-[#20243A]">
            {initials(orgName)}
          </div>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">
            {orgName}
          </p>

          <p className="truncate text-xs text-white/40">
            {organization?.country ??
              "Financial Operating System"}
          </p>
        </div>
      </div>

      {/* ===================================================
          NAVIGATION
      =================================================== */}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        <SectionLabel label="Main" />

        {loadingPermissions ? (
          <div className="px-3 py-3 text-xs text-white/40">
            Loading access...
          </div>
        ) : (
          visibleMainNavigation.map(
            (item) => (
              <NavGroup
                key={item.label}
                item={item}
              />
            )
          )
        )}

        <SectionLabel label="System" />

        {visibleSystemNavigation.map(
          (item) => (
            <NavGroup
              key={item.label}
              item={item}
            />
          )
        )}
      </nav>

      {/* ===================================================
          USER FOOTER
      =================================================== */}

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-xs font-bold text-[#20243A]">
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

          <button
            type="button"
            onClick={
              handleLogout
            }
            title="Sign out"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}