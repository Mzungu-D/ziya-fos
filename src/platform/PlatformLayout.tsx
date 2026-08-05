import { Outlet } from "react-router-dom";

import PlatformSidebar from "./PlatformSidebar";
import PlatformTopbar from "./components/PlatformTopbar";

export default function PlatformLayout() {
  return (
    <div className="flex h-screen bg-[#F5F7FA]">

      {/* Sidebar */}

      <PlatformSidebar />

      {/* Workspace */}

      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top Navigation */}

        <PlatformTopbar />

        {/* Page Content */}

        <main className="flex-1 overflow-y-auto p-8">

          <Outlet />

        </main>

      </div>

    </div>
  );
}