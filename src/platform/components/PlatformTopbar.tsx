import {
  Bell,
  ChevronDown,
  Search,
  Settings,
} from "lucide-react";

export default function PlatformTopbar() {
  return (
    <header className="flex h-[78px] items-center justify-between border-b border-[#ECECF3] bg-white px-10">

      {/* Search */}

      <div className="relative w-[420px]">

        <Search
          size={18}
          className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="text"
          placeholder="Search organizations, users, subscriptions..."
          className="h-12 w-full rounded-2xl border border-[#ECECF3] bg-[#F8F9FC] pl-14 pr-5 text-[15px] text-[#20243A] outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#6D5DF6] focus:bg-white"
        />

      </div>

      {/* Right Side */}

      <div className="flex items-center gap-4">

        {/* Notification */}

        <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white transition hover:bg-[#F8F9FC]">

          <Bell
            size={19}
            className="text-slate-600"
          />

          <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500" />

        </button>

        {/* Settings */}

        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white transition hover:bg-[#F8F9FC]">

          <Settings
            size={19}
            className="text-slate-600"
          />

        </button>

        {/* Profile */}

        <button className="flex items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white px-4 py-2 transition hover:bg-[#F8F9FC]">

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6D5DF6] font-semibold text-white">

            ZA

          </div>

          <div className="text-left">

            <h3 className="text-[15px] font-semibold text-[#20243A]">
              Platform Admin
            </h3>

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