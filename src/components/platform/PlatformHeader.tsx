import {
  Bell,
  Search,
  UserCircle,
} from "lucide-react";

export default function PlatformHeader() {
  return (
    <header className="h-20 border-b border-slate-800 bg-[#030712] flex items-center justify-between px-8">

      {/* Left */}
      <div>
        <h2 className="text-2xl font-semibold text-white">
          Platform Dashboard
        </h2>

        <p className="text-sm text-slate-400">
          Manage organizations and monitor the Ziya FOS platform.
        </p>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">

        <button className="p-2 rounded-lg hover:bg-slate-800 transition">
          <Search
            size={20}
            className="text-slate-400"
          />
        </button>

        <button className="p-2 rounded-lg hover:bg-slate-800 transition">
          <Bell
            size={20}
            className="text-slate-400"
          />
        </button>

        <div className="flex items-center gap-3 border border-slate-700 rounded-xl px-3 py-2">

          <UserCircle
            size={28}
            className="text-amber-400"
          />

          <div>
            <p className="text-white text-sm font-medium">
              Platform Admin
            </p>

            <p className="text-xs text-slate-400">
              Ziya FOS
            </p>
          </div>

        </div>

      </div>

    </header>
  );
}