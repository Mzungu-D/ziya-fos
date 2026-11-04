import {
  Bell,
  Search,
  Calendar,
  ChevronDown,
  X,
  User,
  Settings,
  LogOut,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  authenticatedFetch,
  getOrganizationRole,
  hasAnyPermission,
} from "../../lib/auth";

interface HeaderOrganization {
  name?: string;
  legalName?: string;
  logoUrl?: string | null;
}

interface OrganizationMembership {
  id?: string;
  role?: string;
  permissions?: string[];
  isDefault?: boolean;
  joinedAt?: string;
}

interface OrganizationResponse {
  success?: boolean;
  organization?: HeaderOrganization;
  membership?: OrganizationMembership;
}

interface AuthenticatedUser {
  name?: string;
  email?: string;
}

interface SearchItem {
  name: string;
  path: string;
  permissions?: readonly string[];
  ownerOnly?: boolean;
}

function getInitials(name?: string): string {
  const value = name?.trim();

  if (!value) {
    return "ORG";
  }

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

function getCachedUser(): AuthenticatedUser | null {
  try {
    const raw =
      localStorage.getItem("user") ??
      localStorage.getItem("authUser") ??
      localStorage.getItem("currentUser");

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    const user = parsed as Record<
      string,
      unknown
    >;

    return {
      name:
        typeof user.name === "string"
          ? user.name
          : undefined,

      email:
        typeof user.email === "string"
          ? user.email
          : undefined,
    };
  } catch {
    return null;
  }
}

function toDateInputValue(
  date: Date
): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange(): {
  start: string;
  end: string;
} {
  const now = new Date();

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  );

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
}

/*
 * =========================================================
 * HEADER SEARCH INDEX
 * =========================================================
 *
 * Search visibility follows the same permission model
 * used by tenant navigation.
 *
 * The backend remains the authoritative authorization
 * boundary. This list only controls what is displayed
 * in the header search.
 *
 * No organization ID is accepted from search input.
 * Authorization is resolved from the authenticated
 * tenant session.
 */

const searchItems: readonly SearchItem[] = [
  {
    name: "Dashboard",
    path: "/dashboard",
  },

  {
    name: "General Ledger",
    path: "/dashboard/general-ledger",
    permissions: ["ledger.view"],
  },

  {
    name: "Chart of Accounts",
    path: "/dashboard/chart-of-accounts",
    permissions: ["account.view"],
  },

  {
    name: "Journal Entries",
    path: "/dashboard/journal-entries",
    permissions: ["journal.view"],
  },

  {
    name: "Trial Balance",
    path: "/dashboard/trial-balance",
    permissions: ["reports.view"],
  },

  {
    name: "Financial Reports",
    path: "/dashboard/financial-reports",
    permissions: ["reports.view"],
  },

  {
    name: "Accounts Payable",
    path: "/dashboard/accounts-payable",
    permissions: [
      "accountsPayable.view",
    ],
  },

  {
    name: "Accounts Receivable",
    path: "/dashboard/accounts-receivable",
    permissions: [
      "accountsReceivable.view",
    ],
  },

  {
    name: "Invoicing",
    path: "/dashboard/invoicing",
    permissions: ["invoice.view"],
  },

  {
    name: "Expenses",
    path: "/dashboard/expenses",
    permissions: ["expense.view"],
  },

  {
    name: "Cash & Bank",
    path: "/dashboard/cash-bank",
    permissions: [
      "bankAccount.view",
    ],
  },

  {
    name: "Bank Integration",
    path: "/dashboard/bank-integration",
    permissions: [
      "bankAccount.view",
    ],
  },

  {
    name: "M-Pesa Integration",
    path: "/dashboard/mpesa-integration",
    permissions: [
      "mpesa.view",
    ],
  },

  {
    name: "Portfolio Companies",
    path: "/dashboard/portfolio-companies",
    permissions: [
      "portfolioCompany.view",
    ],
  },

  {
    name: "Vendors",
    path: "/dashboard/vendors",
    permissions: ["vendor.view"],
  },

  {
    name: "HR Management",
    path: "/dashboard/hr-management",
    permissions: ["employee.view"],
  },

  {
    name: "Payroll",
    path: "/dashboard/payroll",
    permissions: ["payroll.view"],
  },

  {
    name: "Procurement",
    path: "/dashboard/procurement",
    permissions: [
      "procurement.view",
    ],
  },

  {
    name: "Assets",
    path: "/dashboard/assets",
    permissions: ["asset.view"],
  },

  {
    name: "Tax Management",
    path: "/dashboard/tax-management",
    permissions: ["tax.view"],
  },

  {
    name: "Budgeting & Forecasting",
    path: "/dashboard/budgeting",
    permissions: ["budget.view"],
  },

  {
    name: "Analytics & Insights",
    path: "/dashboard/analytics",
    permissions: ["reports.view"],
  },

  {
    name: "Fraud Detection",
    path: "/dashboard/fraud-detection",
    permissions: ["fraud.view"],
  },

  {
    name: "Approvals",
    path: "/dashboard/approvals",
    permissions: ["approval.view"],
  },

  {
    name: "Audit Trails",
    path: "/dashboard/audit-trails",
    permissions: [
      "reports.view",
      "users.view",
    ],
  },

  {
    name: "Documents",
    path: "/dashboard/documents",
    permissions: ["document.view"],
  },

  {
    name: "Settings",
    path: "/dashboard/settings",
    ownerOnly: true,
  },
];

export default function Header() {
  const navigate = useNavigate();

  /*
   * =========================================================
   * TENANT ORGANIZATION STATE
   * =========================================================
   *
   * IMPORTANT:
   *
   * The active organization is intentionally NOT initialized
   * from localStorage.
   *
   * localStorage can contain a previous tenant's organization
   * during a tenant switch. The authenticated backend session
   * is therefore the authoritative source of tenant identity.
   */

  const [organization, setOrganization] =
    useState<HeaderOrganization | null>(
      null
    );

  /*
   * The workspace role is initially read from the authenticated
   * session only as a fallback.
   *
   * The authoritative value is refreshed from:
   *
   * GET /api/settings/organization
   *
   * because that endpoint resolves the current membership from
   * the authenticated tenant session.
   */

  const [workspaceRole, setWorkspaceRole] =
    useState<string | null>(
      getOrganizationRole()
    );

  const [currentUser, setCurrentUser] =
    useState<AuthenticatedUser | null>(
      getCachedUser
    );

  const [search, setSearch] =
    useState("");

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [dateOpen, setDateOpen] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const initialPeriod =
    getCurrentMonthRange();

  const [startDate, setStartDate] =
    useState(initialPeriod.start);

  const [endDate, setEndDate] =
    useState(initialPeriod.end);

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  const headerRef =
    useRef<HTMLDivElement>(null);

  /*
   * =========================================================
   * LOAD AUTHENTICATED TENANT
   * =========================================================
   *
   * /api/settings/organization MUST resolve the organization
   * from the authenticated tenant session on the backend.
   *
   * No organizationId is supplied by this component.
   *
   * This prevents:
   *
   *   Tenant A -> accidentally displaying Tenant B
   *
   * after switching companies.
   */

  useEffect(() => {
    let cancelled = false;

    async function loadOrganization(): Promise<void> {
      try {
        const response =
          await authenticatedFetch(
            "/api/settings/organization"
          );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as OrganizationResponse;

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

        /*
         * IMPORTANT:
         *
         * The current membership returned by the backend is the
         * authoritative source for the user's role in the active
         * organization.
         *
         * This fixes the situation where localStorage contains
         * no role, an old role, or a role from a previous tenant.
         *
         * Example:
         *
         * Auditor
         *   -> Header displays "Auditor"
         *
         * Accountant
         *   -> Header displays "Accountant"
         *
         * Junior Accountant
         *   -> Header displays "Junior Accountant"
         *
         * Finance Officer
         *   -> Header displays "Finance Officer"
         *
         * Owner
         *   -> Header displays organization name.
         */

        if (
          typeof data.membership?.role === "string" &&
          data.membership.role.trim()
        ) {
          setWorkspaceRole(
            data.membership.role.trim()
          );
        }

        /*
         * Keep the existing localStorage value updated
         * for compatibility with other parts of the app.
         *
         * IMPORTANT:
         * It is NOT used as the source of truth for this
         * component.
         */

        try {
          localStorage.setItem(
            "organization",
            JSON.stringify(
              data.organization
            )
          );
        } catch {
          // Ignore localStorage failures.
        }
      } catch {
        /*
         * Do not replace authenticated tenant information
         * with stale client-side organization data.
         */
      }
    }

    void loadOrganization();

    /*
     * Tenant switching in the FOS currently performs a
     * full navigation. This custom event also allows future
     * tenant-switch implementations to refresh the header
     * without relying on a browser reload.
     */

    const handleTenantChanged = () => {
      /*
       * Reset the role while the new authenticated tenant
       * membership is being loaded. This prevents the previous
       * tenant's role from temporarily appearing after a switch.
       */

      setWorkspaceRole(null);

      void loadOrganization();
    };

    window.addEventListener(
      "ziya:tenant-changed",
      handleTenantChanged
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "ziya:tenant-changed",
        handleTenantChanged
      );
    };
  }, []);

  /*
   * =========================================================
   * LOAD CURRENT USER
   * =========================================================
   */

  useEffect(() => {
    setCurrentUser(getCachedUser());

    const handleStorage = () => {
      setCurrentUser(
        getCachedUser()
      );
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () =>
      window.removeEventListener(
        "storage",
        handleStorage
      );
  }, []);

  /*
   * =========================================================
   * TENANT WORKSPACE IDENTITY
   * =========================================================
   */

  const organizationName =
    organization?.name?.trim() ||
    organization?.legalName?.trim() ||
    "Your Organization";

  const userName =
    currentUser?.name?.trim() ||
    currentUser?.email?.trim() ||
    "User";

  const userEmail =
    currentUser?.email?.trim() ||
    "Account";

  /*
   * The role comes from the authenticated tenant membership.
   *
   * It is used for permission-sensitive UI and for displaying
   * the workspace identity.
   *
   * OWNER is intentionally displayed as the organization name.
   */

  const organizationRole =
    workspaceRole;

  const workspaceIdentity =
    organizationRole &&
    organizationRole.toUpperCase() !==
      "OWNER"
      ? organizationRole
          .trim()
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (character) =>
            character.toUpperCase()
          )
      : organizationName;

  /*
   * =========================================================
   * PERMISSION-AWARE SEARCH
   * =========================================================
   *
   * Frontend permission filtering improves UX.
   *
   * Backend authorization remains mandatory and authoritative.
   */

  const filteredItems =
    searchItems.filter((item) => {
      const query =
        search
          .trim()
          .toLowerCase();

      const matchesSearch =
        !query ||
        item.name
          .toLowerCase()
          .includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (item.ownerOnly) {
        return (
          organizationRole?.toUpperCase() ===
          "OWNER"
        );
      }

      if (
        !item.permissions ||
        item.permissions.length === 0
      ) {
        return false;
      }

      return hasAnyPermission(
        ...item.permissions
      );
    });

  /*
   * =========================================================
   * KEYBOARD SHORTCUTS
   * =========================================================
   */

  useEffect(() => {
    const handleKeyboard = (
      event: KeyboardEvent
    ) => {
      if (
        event.ctrlKey &&
        event.key === "/"
      ) {
        event.preventDefault();

        searchInputRef.current?.focus();

        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setDateOpen(false);
        setProfileOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyboard
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
  }, []);

  /*
   * =========================================================
   * OUTSIDE CLICK
   * =========================================================
   */

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent
    ) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(
          event.target as Node
        )
      ) {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setDateOpen(false);
        setProfileOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
  }, []);

  /*
   * =========================================================
   * DATE FORMATTING
   * =========================================================
   */

  const formatDate = (
    value: string
  ): string => {
    if (!value) {
      return "";
    }

    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  };

  /*
   * =========================================================
   * LOGOUT
   * =========================================================
   */

  const handleLogout =
    async (): Promise<void> => {
      try {
        await authenticatedFetch(
          "/api/auth/logout",
          {
            method: "POST",
          }
        );
      } catch (error) {
        console.warn(
          "Logout request failed:",
          error
        );
      } finally {
        localStorage.removeItem(
          "user"
        );

        localStorage.removeItem(
          "authUser"
        );

        localStorage.removeItem(
          "currentUser"
        );

        localStorage.removeItem(
          "organization"
        );

        localStorage.removeItem(
          "token"
        );

        localStorage.removeItem(
          "accessToken"
        );

        navigate("/login", {
          replace: true,
        });
      }
    };

  return (
    <header
      ref={headerRef}
      className="relative z-50 mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-center lg:justify-between"
    >
      {/* =====================================================
          TENANT WORKSPACE IDENTITY

          IMPORTANT:

          There is intentionally NO "Dashboard" heading here.

          The actual page owns its page title.

          This area identifies the authenticated tenant/member.
      ===================================================== */}

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          {organization?.logoUrl ? (
            <img
              src={organization.logoUrl}
              alt={`${organizationName} logo`}
              className="h-11 w-11 shrink-0 rounded-xl border border-[#ECECF3] bg-white object-cover shadow-sm"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-sm font-bold text-[#20243A] shadow-sm"
            >
              {getInitials(
                organizationName
              )}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#20243A]">
              {workspaceIdentity}
            </p>

            <p className="mt-0.5 truncate text-xs text-[#8A8FA3]">
              Financial workspace
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          HEADER ACTIONS
      ===================================================== */}

      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3 lg:w-auto lg:flex-nowrap lg:gap-4">

        {/* ===================================================
            SEARCH
        =================================================== */}

        <div className="relative min-w-0 flex-1 lg:flex-none">
          <div className="flex min-w-[180px] items-center rounded-xl border border-[#ECECF3] bg-white px-3 py-3 sm:min-w-[220px] sm:px-4 lg:w-80">
            <Search
              size={18}
              className="shrink-0 text-[#666B84]"
            />

            <input
              ref={searchInputRef}
              type="text"
              value={search}
              placeholder="Search anything..."
              onFocus={() =>
                setSearchOpen(true)
              }
              onChange={(event) => {
                setSearch(
                  event.target.value
                );

                setSearchOpen(true);
              }}
              className="min-w-0 flex-1 bg-transparent px-3 text-[#20243A] outline-none placeholder:text-[#666B84]"
            />

            {search ? (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="shrink-0 text-[#666B84] hover:text-[#20243A]"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            ) : (
              <span className="hidden whitespace-nowrap rounded border border-[#ECECF3] px-2 py-1 text-xs text-[#666B84] sm:inline-block">
                Ctrl /
              </span>
            )}
          </div>

          {searchOpen &&
            search.trim() && (
              <div className="absolute left-0 top-14 z-[60] max-h-96 w-full overflow-y-auto rounded-xl border border-[#ECECF3] bg-white shadow-2xl sm:w-80">
                {filteredItems.length > 0 ? (
                  filteredItems.map(
                    (item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          navigate(
                            item.path
                          );

                          setSearch("");

                          setSearchOpen(
                            false
                          );
                        }}
                        className="block w-full px-4 py-3 text-left text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A]"
                      >
                        {item.name}
                      </button>
                    )
                  )
                ) : (
                  <div className="px-4 py-4 text-[#666B84]">
                    No accessible
                    results found.
                  </div>
                )}
              </div>
            )}
        </div>

        {/* ===================================================
            NOTIFICATIONS
        =================================================== */}

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(
                !notificationsOpen
              );

              setDateOpen(false);
              setProfileOpen(false);
            }}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#ECECF3] bg-white hover:bg-[#F8F9FC]"
            aria-label="Notifications"
            aria-expanded={
              notificationsOpen
            }
          >
            <Bell
              size={20}
              className="text-[#20243A]"
            />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-14 z-[60] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
              <div className="border-b border-[#ECECF3] px-5 py-4">
                <h3 className="font-semibold text-[#20243A]">
                  Notifications
                </h3>
              </div>

              <div className="px-5 py-8 text-center">
                <Bell
                  size={30}
                  className="mx-auto text-[#666B84]"
                />

                <p className="mt-3 text-[#666B84]">
                  No new
                  notifications.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================
            REPORTING PERIOD
        =================================================== */}

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDateOpen(
                !dateOpen
              );

              setNotificationsOpen(
                false
              );

              setProfileOpen(false);
            }}
            className="flex h-12 max-w-full shrink-0 items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-3 text-sm text-[#20243A] hover:bg-[#F8F9FC] sm:px-4"
            aria-expanded={dateOpen}
          >
            <Calendar
              size={18}
              className="shrink-0"
            />

            <span className="truncate">
              {formatDate(startDate)}
              {" - "}
              {formatDate(endDate)}
            </span>

            <ChevronDown
              size={16}
              className="shrink-0"
            />
          </button>

          {dateOpen && (
            <div className="absolute right-0 top-14 z-[60] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
              <h3 className="mb-4 font-semibold text-[#20243A]">
                Reporting Period
              </h3>

              <label className="mb-2 block text-sm font-medium text-[#666B84]">
                From
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(
                    event.target.value
                  )
                }
                className="mb-4 w-full rounded-lg border border-[#ECECF3] bg-white px-3 py-3 text-[#20243A] outline-none focus:border-[#0D9488]"
              />

              <label className="mb-2 block text-sm font-medium text-[#666B84]">
                To
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(event) =>
                  setEndDate(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-[#ECECF3] bg-white px-3 py-3 text-[#20243A] outline-none focus:border-[#0D9488]"
              />

              <button
                type="button"
                onClick={() =>
                  setDateOpen(false)
                }
                className="mt-5 w-full rounded-lg bg-[#0D9488] py-3 font-medium text-white hover:bg-[#0F766E]"
              >
                Apply Period
              </button>
            </div>
          )}
        </div>

        {/* ===================================================
            TENANT USER PROFILE / LOGOUT
        =================================================== */}

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen(
                !profileOpen
              );

              setNotificationsOpen(
                false
              );

              setDateOpen(false);
            }}
            className="flex h-12 items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-2.5 pr-3 transition hover:bg-[#F8F9FC]"
            aria-label="Open user menu"
            aria-expanded={profileOpen}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#20243A] text-xs font-bold text-white">
              {getInitials(userName)}
            </div>

            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-[120px] truncate text-sm font-semibold text-[#20243A]">
                {userName}
              </p>

              <p className="max-w-[120px] truncate text-[11px] text-[#8A8FA3]">
                {userEmail}
              </p>
            </div>

            <ChevronDown
              size={15}
              className={`shrink-0 text-[#666B84] transition-transform ${
                profileOpen
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-14 z-[70] w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">

              {/* USER IDENTITY */}

              <div className="border-b border-[#ECECF3] px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-sm font-bold text-[#20243A]">
                    {getInitials(
                      userName
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#20243A]">
                      {userName}
                    </p>

                    <p className="truncate text-xs text-[#8A8FA3]">
                      {userEmail}
                    </p>

                    <p className="mt-1 truncate text-[11px] font-medium text-[#0D9488]">
                      {organizationName}
                    </p>
                  </div>
                </div>
              </div>

              {/* PROFILE ACTIONS */}

              <div className="p-2">
                {organizationRole?.toUpperCase() ===
                  "OWNER" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(
                          false
                        );

                        navigate(
                          "/dashboard/settings"
                        );
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#4F556B] hover:bg-[#F8F9FC] hover:text-[#20243A]"
                    >
                      <User
                        size={17}
                        className="text-[#666B84]"
                      />

                      Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(
                          false
                        );

                        navigate(
                          "/dashboard/settings"
                        );
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#4F556B] hover:bg-[#F8F9FC] hover:text-[#20243A]"
                    >
                      <Settings
                        size={17}
                        className="text-[#666B84]"
                      />

                      Organization
                      Settings
                    </button>
                  </>
                )}

                <div className="my-1 border-t border-[#ECECF3]" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <LogOut
                    size={17}
                  />

                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}