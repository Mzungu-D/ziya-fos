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
  useLocation,
} from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";
import OrganizationSwitcher from "../auth/OrganizationSwitcher";

export default function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  const location = useLocation();

  /*
   * Close the mobile navigation whenever
   * the route changes.
   */
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  /*
   * Prevent background scrolling while
   * the mobile navigation is open.
   */
  useEffect(() => {
    if (!mobileSidebarOpen) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  /*
   * Escape closes mobile navigation.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-[#F8F9FC]">
      {/* =====================================================
          DESKTOP SIDEBAR
      ===================================================== */}

      <aside className="hidden h-full w-64 shrink-0 lg:flex">
        <Sidebar />
      </aside>

      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-[90] cursor-default bg-[#111827]/60 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* =====================================================
          MOBILE SIDEBAR
      ===================================================== */}

      <aside
        id="mobile-dashboard-navigation"
        className={[
          "fixed inset-y-0 left-0 z-[100]",
          "w-[min(18rem,88vw)]",
          "transform bg-[#0D9488]",
          "shadow-[0_20px_60px_rgba(15,23,42,0.3)]",
          "transition-transform duration-200 ease-out",
          "lg:hidden",
          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
        aria-label="Mobile navigation"
        aria-hidden={!mobileSidebarOpen}
      >
        <div className="relative h-full min-h-0 overflow-hidden">
          <button
            type="button"
            onClick={() =>
              setMobileSidebarOpen(false)
            }
            aria-label="Close navigation"
            className="absolute right-3 top-3 z-[110] flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <X
              size={18}
              aria-hidden="true"
            />
          </button>

          <Sidebar />
        </div>
      </aside>

      {/* =====================================================
          MAIN WORKSPACE
      ===================================================== */}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* ===================================================
            TOP AREA
        =================================================== */}

        <header className="relative z-50 shrink-0 bg-[#F8F9FC]">
          {/* Mobile workspace bar */}

          <div className="border-b border-[#ECECF3] px-3 py-3 sm:px-4 lg:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMobileSidebarOpen(true)
                }
                aria-label="Open navigation"
                aria-controls="mobile-dashboard-navigation"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E6E8F0] bg-white text-[#20243A] shadow-sm transition hover:bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              >
                <Menu
                  size={19}
                  aria-hidden="true"
                />
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A8FA5]">
                  Financial workspace
                </p>

                <p className="truncate text-sm font-semibold text-[#20243A]">
                  Ziya FOS
                </p>
              </div>
            </div>
          </div>

          {/* Header */}

          <div className="min-w-0 px-3 pt-3 sm:px-5 sm:pt-4 lg:px-7 xl:px-8">
            <Header />
          </div>
        </header>

        {/* ===================================================
            ORGANIZATION SWITCHER
        =================================================== */}

        <div className="relative z-40 shrink-0 px-3 pb-2 sm:px-5 lg:px-7 xl:px-8">
          <div className="flex min-w-0 justify-end">
            <div className="w-full max-w-sm min-w-0">
              <OrganizationSwitcher />
            </div>
          </div>
        </div>

        {/* ===================================================
            PAGE CONTENT

            IMPORTANT:
            The workspace itself must NOT horizontally scroll.
            Individual wide components such as tables should
            provide their own overflow-x-auto container.
        =================================================== */}

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-8 pt-2 sm:px-5 lg:px-7 xl:px-8">
          <div className="mx-auto w-full min-w-0 max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}