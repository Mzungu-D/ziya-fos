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

  return (
    <header
      ref={headerRef}
      className="flex items-center justify-between mb-8 relative z-50"
    >
      {/* Left */}

      <div>
        <h1 className="text-4xl font-bold text-[#20243A]">
          Dashboard
        </h1>

        <p className="text-[#666B84] mt-2">
          Welcome to Ziya Financial Operating System
        </p>
      </div>

      {/* Right */}

      <div className="flex items-center gap-4">

        {/* SEARCH */}

        <div className="relative">

          <div className="flex items-center bg-[#111827] border border-[#ECECF3] rounded-xl px-4 py-3 w-80">

            <Search
              size={18}
              className="text-[#666B84]"
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
              className="bg-transparent flex-1 outline-none px-3 text-[#20243A] placeholder:text-[#666B84]"
            />

            {search ? (
              <button
                onClick={() => setSearch("")}
                className="text-[#666B84] hover:text-[#20243A]"
              >
                <X size={16} />
              </button>
            ) : (
              <span className="text-xs text-[#666B84] border border-[#ECECF3] rounded px-2 py-1">
                Ctrl /
              </span>
            )}

          </div>

          {searchOpen && search && (

            <div className="absolute top-14 left-0 w-80 max-h-96 overflow-y-auto bg-[#111827] border border-[#ECECF3] rounded-xl shadow-2xl">

              {filteredItems.length > 0 ? (

                filteredItems.map((item) => (

                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSearch("");
                      setSearchOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A]"
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
            className="relative w-12 h-12 rounded-xl bg-[#111827] border border-[#ECECF3] flex items-center justify-center hover:bg-[#F8F9FC]"
          >
            <Bell
              size={20}
              className="text-[#20243A]"
            />

            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {notificationsOpen && (

            <div className="absolute right-0 top-14 w-96 bg-[#111827] border border-[#ECECF3] rounded-xl shadow-2xl overflow-hidden">

              <div className="px-5 py-4 border-b border-[#ECECF3]">

                <h3 className="text-[#20243A] font-semibold">
                  Notifications
                </h3>

              </div>

              <div className="px-5 py-8 text-center">

                <Bell
                  size={30}
                  className="mx-auto text-[#666B84]"
                />

                <p className="text-[#666B84] mt-3">
                  No new notifications.
                </p>

              </div>

            </div>

          )}

        </div>

        {/* DATE RANGE */}

        <div className="relative">

          <button
            onClick={() => {
              setDateOpen(!dateOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 px-4 h-12 rounded-xl bg-[#111827] border border-[#ECECF3] text-[#20243A] hover:bg-[#F8F9FC]"
          >
            <Calendar size={18} />

            {formatDate(startDate)}
            {" - "}
            {formatDate(endDate)}

            <ChevronDown size={16} />
          </button>

          {dateOpen && (

            <div className="absolute right-0 top-14 w-80 bg-[#111827] border border-[#ECECF3] rounded-xl shadow-2xl p-5">

              <h3 className="text-[#20243A] font-semibold mb-4">
                Reporting Period
              </h3>

              <label className="block text-sm text-[#666B84] mb-2">
                From
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(e) =>
                  setStartDate(e.target.value)
                }
                className="w-full bg-white border border-[#ECECF3] rounded-lg px-3 py-3 text-[#20243A] mb-4"
              />

              <label className="block text-sm text-[#666B84] mb-2">
                To
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(e) =>
                  setEndDate(e.target.value)
                }
                className="w-full bg-white border border-[#ECECF3] rounded-lg px-3 py-3 text-[#20243A]"
              />

              <button
                onClick={() => setDateOpen(false)}
                className="w-full mt-5 bg-blue-600 hover:bg-blue-700 rounded-lg py-3 text-[#20243A] font-medium"
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