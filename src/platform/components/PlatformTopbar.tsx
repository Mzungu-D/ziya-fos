import {
  Bell,
  ChevronDown,
  Search,
} from "lucide-react";

export default function PlatformTopbar() {
  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">

      {/* Left */}

      <div>

        <h1 className="text-2xl font-bold text-slate-900">
          Platform Workspace
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage every organization using Ziya FOS.
        </p>

      </div>

      {/* Right */}

      <div className="flex items-center gap-5">

        {/* Search */}

        <div className="flex h-11 w-80 items-center rounded-xl border border-slate-200 bg-slate-50 px-4">

          <Search
            size={18}
            className="text-slate-400"
          />

          <input
            placeholder="Search..."
            className="ml-3 w-full bg-transparent text-sm outline-none"
          />

        </div>

        {/* Notifications */}

        <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50">

          <Bell
            size={19}
            className="text-slate-600"
          />

        </button>

        {/* User */}

        <button className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 transition hover:bg-slate-50">

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D4AF37] font-semibold text-slate-900">

            Z

          </div>

          <div className="text-left">

            <p className="text-sm font-semibold text-slate-900">
              Platform Admin
            </p>

            <p className="text-xs text-slate-500">
              Super Administrator
            </p>

          </div>

          <ChevronDown
            size={18}
            className="text-slate-500"
          />

        </button>

      </div>

    </header>
  );
}