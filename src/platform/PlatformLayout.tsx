import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import PlatformSidebar from "./PlatformSidebar";
import PlatformTopbar from "./components/PlatformTopbar";

export default function PlatformLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-[#F8F9FC]">
      {/* Desktop sidebar */}
      <div className="hidden h-full w-[300px] shrink-0 lg:block">
        <PlatformSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/50"
          />

          <div className="absolute inset-y-0 left-0 h-dvh w-[min(300px,88vw)] shadow-2xl">
            <PlatformSidebar />
          </div>
        </div>
      )}

      {/* Workspace */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PlatformTopbar
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#F8F9FC]">
          <div className="mx-auto w-full max-w-[1700px] px-3 py-4 sm:px-5 sm:py-5 md:px-6 lg:px-8 lg:py-7 xl:px-10 xl:py-8">
            <Outlet />
          </div>
        </main>
      </section>
    </div>
  );
}
