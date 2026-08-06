import {
  Bell,
  ChevronDown,
  Search,
} from "lucide-react";

export default function PlatformTopbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-[#ECECF3] bg-white px-10">

      <div className="relative w-[420px]">

        <Search
          size={18}
          className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          placeholder="Search organizations, users, reports..."
          className="h-12 w-full rounded-2xl border border-[#ECECF3] bg-[#F8F9FC] pl-14 pr-4 outline-none transition focus:border-[#6D5DF6]"
        />

      </div>

      <div className="flex items-center gap-5">

        <button className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white">

          <Bell size={20} />

          <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500" />

        </button>

        <button className="flex items-center gap-4 rounded-2xl border border-[#ECECF3] bg-white px-4 py-2">

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6D5DF6] font-bold text-white">
            Z
          </div>

          <div className="text-left">

            <p className="font-semibold text-[#20243A]">
              Platform Admin
            </p>

            <p className="text-sm text-[#666B84]">
              Super Administrator
            </p>

          </div>

          <ChevronDown size={18} />

        </button>

      </div>

    </header>
  );
}