import { useState } from "react";
import {
  ChevronDown,
  LogOut,
  Settings,
  Shield,
  User,
} from "lucide-react";

import zayi from "../../assets/logo/zayi.png";

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">

      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white px-4 py-2 shadow-sm transition hover:bg-[#F8F9FC]"
      >

        <img
          src={zayi}
          alt="Platform Admin"
          className="h-11 w-11 rounded-full object-cover"
        />

        <div className="text-left">

          <h3 className="text-sm font-semibold text-[#20243A]">
            Platform Admin
          </h3>

          <p className="text-xs text-[#666B84]">
            Super Administrator
          </p>

        </div>

        <ChevronDown
          size={18}
          className={`transition ${
            open ? "rotate-180" : ""
          }`}
        />

      </button>

      {open && (

        <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-xl">

          <div className="border-b border-[#ECECF3] p-5">

            <div className="flex items-center gap-4">

              <img
                src={zayi}
                alt="Admin"
                className="h-14 w-14 rounded-full"
              />

              <div>

                <h3 className="font-semibold text-[#20243A]">
                  Platform Admin
                </h3>

                <p className="text-sm text-[#666B84]">
                  admin@ziya.co.ke
                </p>

              </div>

            </div>

          </div>

          <div className="p-2">

            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#20243A] transition hover:bg-[#F8F9FC]">

              <User size={18} />

              My Profile

            </button>

            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#20243A] transition hover:bg-[#F8F9FC]">

              <Shield size={18} />

              Security

            </button>

            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#20243A] transition hover:bg-[#F8F9FC]">

              <Settings size={18} />

              Settings

            </button>

          </div>

          <div className="border-t border-[#ECECF3] p-2">

            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50">

              <LogOut size={18} />

              Sign Out

            </button>

          </div>

        </div>

      )}

    </div>
  );
}