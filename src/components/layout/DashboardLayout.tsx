import { Outlet } from "react-router-dom";

import Sidebar              from "./Sidebar";
import Header               from "./Header";
import OrganizationSwitcher from "../auth/OrganizationSwitcher";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FC]">

      {/* Fixed sidebar */}
      <Sidebar />

      {/* Scrollable main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <OrganizationSwitcher />

        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>

    </div>
  );
}