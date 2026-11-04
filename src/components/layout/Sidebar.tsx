import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  NavLink,
  useLocation,
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
  getOrganizationRole,
  hasAnyPermission,
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

interface OrganizationSettingsResponse {
  success: boolean;
  organization?: OrgInfo;
  message?: string;
}

interface NavChild {
  label: string;
  to: string;
  requiredPermissions?: readonly string[];
}

interface NavItem {
  label: string;
  to?: string;
  icon: ReactNode;
  children?: readonly NavChild[];
  ownerOnly?: boolean;
}

/* =========================================================
   HELPERS
========================================================= */

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

/* =========================================================
   MAIN NAVIGATION
========================================================= */

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
        requiredPermissions: [
          "account.view",
        ],
      },
      {
        label: "General Ledger",
        to: "/dashboard/general-ledger",
        requiredPermissions: [
          "ledger.view",
        ],
      },
      {
        label: "Journal Entries",
        to: "/dashboard/journal-entries",
        requiredPermissions: [
          "journal.view",
        ],
      },
      {
        label: "Trial Balance",
        to: "/dashboard/trial-balance",
        requiredPermissions: [
          "reports.view",
        ],
      },
      {
        label: "Financial Reports",
        to: "/dashboard/financial-reports",
        requiredPermissions: [
          "reports.view",
        ],
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
        requiredPermissions: [
          "invoice.view",
        ],
      },
      {
        label: "Accounts Receivable",
        to: "/dashboard/accounts-receivable",
        requiredPermissions: [
          "accountsReceivable.view",
        ],
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
        requiredPermissions: [
          "accountsPayable.view",
        ],
      },
      {
        label: "Expenses",
        to: "/dashboard/expenses",
        requiredPermissions: [
          "expense.view",
        ],
      },
      {
        label: "Vendors",
        to: "/dashboard/vendors",
        requiredPermissions: [
          "vendor.view",
        ],
      },
      {
        label: "Procurement",
        to: "/dashboard/procurement",
        requiredPermissions: [
          "procurement.view",
        ],
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
        requiredPermissions: [
          "bankAccount.view",
        ],
      },
      {
        label: "Bank Integration",
        to: "/dashboard/bank-integration",
        requiredPermissions: [
          "bankAccount.view",
        ],
      },
      {
        label: "M-Pesa",
        to: "/dashboard/mpesa-integration",
        requiredPermissions: [
          "mpesa.view",
        ],
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
        requiredPermissions: [
          "portfolioCompany.view",
        ],
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
        requiredPermissions: [
          "employee.view",
        ],
      },
      {
        label: "Payroll",
        to: "/dashboard/payroll",
        requiredPermissions: [
          "payroll.view",
        ],
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
        requiredPermissions: [
          "asset.view",
        ],
      },
      {
        label: "Asset Assignments",
        to: "/dashboard/assets/assignments",
        requiredPermissions: [
          "assetAssignment.view",
        ],
      },
      {
        label: "Budgeting",
        to: "/dashboard/budgeting",
        requiredPermissions: [
          "budget.view",
        ],
      },
    ],
  },

  {
    label: "Tax Management",
    icon: (
      <BookOpen
        size={17}
        aria-hidden="true"
      />
    ),
    children: [
      {
        label: "Tax Management",
        to: "/dashboard/tax-management",
        requiredPermissions: [
          "tax.view",
        ],
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
        requiredPermissions: [
          "reports.view",
        ],
      },
      {
        label: "Fraud Detection",
        to: "/dashboard/fraud-detection",
        requiredPermissions: [
          "fraud.view",
        ],
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
        requiredPermissions: [
          "approval.view",
        ],
      },
      {
        label: "Audit Trails",
        to: "/dashboard/audit-trails",
        requiredPermissions: [
          "reports.view",
          "users.view",
        ],
      },
      {
        label: "Documents",
        to: "/dashboard/documents",
        requiredPermissions: [
          "document.view",
        ],
      },
    ],
  },
];

/* =========================================================
   SYSTEM / ADMINISTRATION NAVIGATION
========================================================= */

const SYSTEM_NAV: readonly NavItem[] = [
  {
    label: "User Access",
    to: "/dashboard/user-access",
    icon: (
      <Users
        size={17}
        aria-hidden="true"
      />
    ),
    requiredPermissions: ["users.view"],
  } as NavItem & {
    requiredPermissions?: readonly string[];
  },

  {
    label: "Settings",
    to: "/dashboard/settings",
    icon: (
      <Settings
        size={17}
        aria-hidden="true"
      />
    ),
    ownerOnly: true,
  },
];

/* =========================================================
   PERMISSION FILTERING
========================================================= */

function canAccessChild(child: NavChild): boolean {
  if (
    !child.requiredPermissions ||
    child.requiredPermissions.length === 0
  ) {
    return false;
  }

  return hasAnyPermission(...child.requiredPermissions);
}

function canAccessItem(item: NavItem): boolean {
  if (item.children?.length) {
    return item.children.some(canAccessChild);
  }

  if (item.label === "Dashboard") {
    return true;
  }

  const permissionAwareItem = item as NavItem & {
    requiredPermissions?: readonly string[];
  };

  if (
    !permissionAwareItem.requiredPermissions ||
    permissionAwareItem.requiredPermissions.length === 0
  ) {
    return false;
  }

  return hasAnyPermission(
    ...permissionAwareItem.requiredPermissions
  );
}

function filterNavigation(
  navigation: readonly NavItem[],
  organizationRole: string | null
): NavItem[] {
  const normalizedRole =
    organizationRole
      ?.trim()
      .toUpperCase();

  const isOwner =
    normalizedRole === "OWNER";

  return navigation
    .filter((item) => {
      if (item.ownerOnly) {
        return isOwner;
      }

      return canAccessItem(item);
    })
    .map((item) => {
      if (!item.children) {
        return item;
      }

      const visibleChildren =
        item.children.filter(
          canAccessChild
        );

      if (
        visibleChildren.length === 0
      ) {
        return null;
      }

      return {
        ...item,
        children: visibleChildren,
      };
    })
    .filter(
      (
        item
      ): item is NavItem =>
        item !== null
    );
}

/* =========================================================
   LEAF LINK
========================================================= */

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

/* =========================================================
   NAV GROUP
========================================================= */

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

  const sectionId =
    `nav-${item.label
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

  const organizationRole =
    getOrganizationRole();

  const user =
    readJson<UserInfo>("user");

  const userName =
    user?.name ?? "User";

  const orgName =
    organization?.name ??
    "Your Organisation";

  /*
   * Navigation is calculated from
   * the authenticated tenant member's
   * permissions.
   *
   * The Sidebar only controls visibility.
   * The backend remains the authoritative
   * authorization boundary.
   */
  const visibleMainNav =
    useMemo(
      () =>
        filterNavigation(
          MAIN_NAV,
          organizationRole
        ),
      [organizationRole]
    );

  const visibleSystemNav =
    useMemo(
      () =>
        filterNavigation(
          SYSTEM_NAV,
          organizationRole
        ),
      [organizationRole]
    );

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

    navigate("/login", {
      replace: true,
    });
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

        {visibleMainNav.map(
          (item) => (
            <NavGroup
              key={item.label}
              item={item}
              pathname={pathname}
            />
          )
        )}

        {visibleSystemNav.length > 0 && (
          <>
            <SectionLabel label="System" />

            {visibleSystemNav.map(
              (item) => (
                <NavGroup
                  key={item.label}
                  item={item}
                  pathname={pathname}
                />
              )
            )}
          </>
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
