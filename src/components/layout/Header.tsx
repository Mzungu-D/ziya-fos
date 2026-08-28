import {
  Bell,
  Search,
  Calendar,
  ChevronDown,
  X,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

interface HeaderOrganization {
  name?: string;
  legalName?: string;
  logoUrl?: string | null;
}

interface OrganizationResponse {
  success?: boolean;
  organization?: HeaderOrganization;
}

function getInitials(name?: string): string {
  const value = name?.trim();

  if (!value) {
    return "ORG";
  }

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getCachedOrganization(): HeaderOrganization | null {
  try {
    const raw = localStorage.getItem("organization");

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

    return parsed as HeaderOrganization;
  } catch {
    return null;
  }
}

const searchItems = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "General Ledger", path: "/dashboard/general-ledger" },
  { name: "Chart of Accounts", path: "/dashboard/chart-of-accounts" },
  { name: "Journal Entries", path: "/dashboard/journal-entries" },
  { name: "Trial Balance", path: "/dashboard/trial-balance" },
  { name: "Financial Reports", path: "/dashboard/financial-reports" },

  { name: "Accounts Payable", path: "/dashboard/accounts-payable" },
  { name: "Accounts Receivable", path: "/dashboard/accounts-receivable" },
  { name: "Invoicing", path: "/dashboard/invoicing" },
  { name: "Expenses", path: "/dashboard/expenses" },
  { name: "Cash & Bank", path: "/dashboard/cash-bank" },
  { name: "Bank Integration", path: "/dashboard/bank-integration" },
  { name: "M-Pesa Integration", path: "/dashboard/mpesa-integration" },
  { name: "Portfolio Companies", path: "/dashboard/portfolio-companies" },
  { name: "Vendors", path: "/dashboard/vendors" },

  { name: "HR Management", path: "/dashboard/hr-management" },
  { name: "Payroll", path: "/dashboard/payroll" },
  { name: "Procurement", path: "/dashboard/procurement" },
  { name: "Assets", path: "/dashboard/assets" },
  { name: "Tax Management", path: "/dashboard/tax-management" },
  { name: "Budgeting & Forecasting", path: "/dashboard/budgeting" },

  { name: "Analytics & Insights", path: "/dashboard/analytics" },
  { name: "Fraud Detection", path: "/dashboard/fraud-detection" },

  { name: "Approvals", path: "/dashboard/approvals" },
  { name: "Audit Trails", path: "/dashboard/audit-trails" },
  { name: "Documents", path: "/dashboard/documents" },
  { name: "Settings", path: "/dashboard/settings" },
];

export default function Header() {
  const navigate = useNavigate();

  const [organization, setOrganization] =
    useState<HeaderOrganization | null>(
      getCachedOrganization
    );

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [dateOpen, setDateOpen] = useState(false);

  const [startDate, setStartDate] =
    useState("2025-06-01");

  const [endDate, setEndDate] =
    useState("2025-06-30");

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  const headerRef =
    useRef<HTMLDivElement>(null);

  const filteredItems = searchItems.filter((item) =>
    item.name
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // Load the current tenant/workspace branding.
  useEffect(() => {
    let cancelled = false;

    async function loadOrganization() {
      try {
        const response = await fetch(
          "/api/settings/organization",
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as OrganizationResponse;

        if (
          !cancelled &&
          data.success &&
          data.organization
        ) {
          setOrganization(data.organization);

          try {
            localStorage.setItem(
              "organization",
              JSON.stringify(data.organization)
            );
          } catch {
            // Ignore local storage failures.
          }
        }
      } catch {
        // Cached organization information remains available.
      }
    }

    void loadOrganization();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ctrl + / opens search
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "/") {
        event.preventDefault();

        searchInputRef.current?.focus();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setDateOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(
          event.target as Node
        )
      ) {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setDateOpen(false);
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

  const formatDate = (value: string) => {
    if (!value) return "";

    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const organizationName =
    organization?.name?.trim() ||
    organization?.legalName?.trim() ||
    "Your Organization";

  return (
    <header
      ref={headerRef}
      className="relative z-50 mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-center lg:justify-between"
    >
      {/* Workspace identity */}

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
              {getInitials(organizationName)}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#666B84]">
              {organizationName}
            </p>

            <h1 className="truncate text-3xl font-bold tracking-tight text-[#20243A] sm:text-4xl">
              Dashboard
            </h1>

            <p className="mt-0.5 truncate text-xs text-[#8A8FA3]">
              Financial workspace
            </p>
          </div>
        </div>
      </div>

      {/* Right */}

      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:w-auto lg:flex-nowrap lg:gap-4">

        {/* SEARCH */}

        <div className="relative min-w-0 flex-1 lg:flex-none">

          <div className="flex min-w-[180px] flex-1 basis-[min(100%,22rem)] items-center rounded-xl border border-[#ECECF3] bg-white px-3 py-3 sm:min-w-[220px] sm:px-4 lg:w-80 lg:flex-none">

            <Search
              size={18}
              className="shrink-0 text-[#666B84]"
            />

            <input
              ref={searchInputRef}
              type="text"
              value={search}
              placeholder="Search anything..."
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              className="min-w-0 flex-1 bg-transparent px-3 text-[#20243A] outline-none placeholder:text-[#666B84]"
            />

            {search ? (
              <button
                onClick={() => setSearch("")}
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

          {searchOpen && search && (

            <div className="absolute left-0 top-14 z-[60] max-h-96 w-full overflow-y-auto rounded-xl border border-[#ECECF3] bg-white shadow-2xl sm:w-80">

              {filteredItems.length > 0 ? (

                filteredItems.map((item) => (

                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSearch("");
                      setSearchOpen(false);
                    }}
                    className="block w-full px-4 py-3 text-left text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A]"
                  >
                    {item.name}
                  </button>

                ))

              ) : (

                <div className="px-4 py-4 text-[#666B84]">
                  No results found.
                </div>

              )}

            </div>

          )}

        </div>

        {/* NOTIFICATIONS */}

        <div className="relative">

          <button
            onClick={() => {
              setNotificationsOpen(
                !notificationsOpen
              );

              setDateOpen(false);
            }}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#ECECF3] bg-white hover:bg-[#F8F9FC]"
            aria-label="Notifications"
          >
            <Bell
              size={20}
              className="text-[#20243A]"
            />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {notificationsOpen && (

            <div className="absolute right-0 top-14 z-[60] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[#ECECF3] bg-white shadow-2xl">

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
                  No new notifications.
                </p>

              </div>

            </div>

          )}

        </div>        {/* DATE RANGE */}

        <div className="relative">

          <button
            onClick={() => {
              setDateOpen(!dateOpen);
              setNotificationsOpen(false);
            }}
            className="flex h-12 min-w-0 max-w-full shrink-0 items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-3 text-sm text-[#20243A] hover:bg-[#F8F9FC] sm:px-4"
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

            <div className="absolute right-0 top-14 z-[60] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-[#ECECF3] bg-white p-5 shadow-2xl">

              <h3 className="mb-4 font-semibold text-[#20243A]">
                Reporting Period
              </h3>

              <label className="mb-2 block text-sm text-[#666B84]">
                From
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(e) =>
                  setStartDate(e.target.value)
                }
                className="mb-4 w-full rounded-lg border border-[#ECECF3] bg-white px-3 py-3 text-[#20243A]"
              />

              <label className="mb-2 block text-sm text-[#666B84]">
                To
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(e) =>
                  setEndDate(e.target.value)
                }
                className="w-full rounded-lg border border-[#ECECF3] bg-white px-3 py-3 text-[#20243A]"
              />

              <button
                onClick={() => setDateOpen(false)}
                className="mt-5 w-full rounded-lg bg-[#0D9488] py-3 font-medium text-white hover:bg-[#0F766E]"
              >
                Apply Period
              </button>

            </div>

          )}

        </div>

      </div>

    </header>
  );
}