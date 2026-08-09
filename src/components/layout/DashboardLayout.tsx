import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";
import OrganizationSwitcher from "../auth/OrganizationSwitcher";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#030712] flex">
      <Sidebar />

      <div className="flex-1 p-8 overflow-y-auto">
        <Header />
        <OrganizationSwitcher />

        <Outlet />
      </div>
    </div>
  );
}
