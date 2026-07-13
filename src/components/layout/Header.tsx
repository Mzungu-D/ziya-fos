import { Bell, Search, Calendar, ChevronDown } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center justify-between mb-8">
      {/* Left Side */}
      <div>
        <h1 className="text-4xl font-bold text-white">
          Dashboard
        </h1>

        <p className="text-slate-400 mt-2">
          Welcome to Ziya Financial Operating System
        </p>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">

        {/* Search */}
        <div className="flex items-center bg-[#111827] border border-slate-700 rounded-xl px-4 py-3 w-80">
          <Search size={18} className="text-slate-400" />

          <input
            type="text"
            placeholder="Search anything..."
            className="bg-transparent flex-1 outline-none px-3 text-white placeholder:text-slate-500"
          />

          <span className="text-xs text-slate-500 border border-slate-600 rounded px-2 py-1">
            Ctrl /
          </span>
        </div>

        {/* Notification */}
        <button className="w-12 h-12 rounded-xl bg-[#111827] border border-slate-700 flex items-center justify-center hover:bg-slate-800">
          <Bell size={20} className="text-white" />
        </button>

        {/* Date Picker */}
        <button className="flex items-center gap-2 px-4 h-12 rounded-xl bg-[#111827] border border-slate-700 text-white">
          <Calendar size={18} />
          Jun 1 - Jun 30, 2025
          <ChevronDown size={16} />
        </button>

      </div>
    </header>
  );
}