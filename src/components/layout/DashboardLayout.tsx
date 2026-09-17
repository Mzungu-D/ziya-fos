import {
  Menu,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  Outlet,
} from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";
import OrganizationSwitcher from "../auth/OrganizationSwitcher";

export default function DashboardLayout() {
  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

  /*
   * =========================================================
   * CLOSE MOBILE NAVIGATION WHEN ROUTE CONTENT CHANGES
   * =========================================================
   */

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, []);

  /*
   * =========================================================
   * LOCK BODY SCROLL WHILE MOBILE SIDEBAR IS OPEN
   * =========================================================
   */

  useEffect(() => {
    if (!mobileSidebarOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  /*
   * =========================================================
   * ESCAPE KEY
   * =========================================================
   */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape" &&
        mobileSidebarOpen
      ) {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="flex h-screen min-h-0 w-full overflow-hidden bg-[#F8F9FC]">
      {/* =====================================================
          DESKTOP SIDEBAR
      ===================================================== */}

      <aside className="hidden h-full w-64 flex-shrink-0 lg:flex">
        <Sidebar />
      </aside>

      {/* =====================================================
          MOBILE SIDEBAR OVERLAY
      ===================================================== */}

      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-[90] bg-[#111827]/60 lg:hidden"
          aria-hidden="true"
          onClick={() =>
            setMobileSidebarOpen(false)
          }
        />
      )}

      {/* =====================================================
          MOBILE SIDEBAR DRAWER
      ===================================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-[100] w-[min(18rem,88vw)] transform bg-[#0D9488] shadow-[0_20px_60px_rgba(15,23,42,0.3)] transition-transform duration-200 ease-out lg:hidden ${
          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileSidebarOpen}
      >
        {/* Mobile drawer header */}

        <div className="absolute right-3 top-3 z-[110]">
          <button
            type="button"
            onClick={() =>
              setMobileSidebarOpen(false)
            }
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
          >
            <X
              size={18}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="h-full overflow-hidden">
          <Sidebar />
        </div>
      </aside>

      {/* =====================================================
          MAIN TENANT WORKSPACE
      ===================================================== */}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* ===================================================
            RESPONSIVE TOP BAR
        =================================================== */}

        <div className="relative z-50 flex-shrink-0 bg-[#F8F9FC]">
          {/* Mobile workspace bar */}

          <div className="flex items-center gap-3 border-b border-[#ECECF3] px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() =>
                setMobileSidebarOpen(true)
              }
              aria-label="Open navigation"
              aria-controls="mobile-dashboard-navigation"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#E6E8F0] bg-white text-[#20243A] shadow-sm transition hover:bg-[#F8F9FC]"
            >
              <Menu
                size={19}
                aria-hidden="true"
              />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold uppercase tracking-wider text-[#8A8FA5]">
                Financial workspace
              </p>

              <p className="truncate text-sm font-semibold text-[#20243A]">
                Ziya FOS
              </p>
            </div>
          </div>

          {/* Header */}

          <div className="px-4 pt-4 sm:px-6 lg:px-8">
            <Header />
          </div>
        </div>

        {/* ===================================================
            ORGANIZATION SWITCHER
        =================================================== */}

        <div className="relative z-40 flex-shrink-0 px-4 pb-2 sm:px-6 lg:px-8">
          <div className="flex justify-end">
            <div className="w-full max-w-sm">
              <OrganizationSwitcher />
            </div>
          </div>
        </div>

        {/* ===================================================
            PAGE CONTENT
        =================================================== */}

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-auto px-4 pb-8 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
