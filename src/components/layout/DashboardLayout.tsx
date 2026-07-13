import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#030712] flex">
      <Sidebar />

      <div className="flex-1 p-8 overflow-y-auto">
        <Header />

        <Outlet />
      </div>
    </div>
  );
}