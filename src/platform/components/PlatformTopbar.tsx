import {
  Bell,
  Search,
  Settings,
} from "lucide-react";

import ProfileDropdown from "./ProfileDropdown";

export default function PlatformTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[#ECECF3] bg-white px-8">

      {/* Search */}

      <div className="relative w-[460px]">

        <Search
          size={18}
          className="absolute left-5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
        />

        <input
          type="text"
          placeholder="Search organizations, users, subscriptions..."
          className="h-14 w-full rounded-2xl border border-[#ECECF3] bg-[#F8F9FC] pl-14 pr-20 text-sm text-[#20243A] placeholder:text-[#94A3B8] outline-none transition-all duration-200 focus:border-[#6D5DF6] focus:bg-white focus:ring-2 focus:ring-[#6D5DF6]/10"
        />

        <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg border border-[#ECECF3] bg-white px-2 py-1 text-xs font-medium text-[#666B84] shadow-sm">
          Ctrl K
        </div>

      </div>

      {/* Right Section */}

      <div className="flex items-center gap-3">

        {/* Notifications */}

        <button className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white shadow-sm transition-all duration-200 hover:bg-[#F8F9FC]">

          <Bell
            size={20}
            className="text-[#475569]"
          />

          <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#EF4444]" />

        </button>

        {/* Settings */}

        <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white shadow-sm transition-all duration-200 hover:bg-[#F8F9FC]">

          <Settings
            size={20}
            className="text-[#475569]"
          />

        </button>

        {/* Profile */}

        <ProfileDropdown />

      </div>

    </header>
  );
}