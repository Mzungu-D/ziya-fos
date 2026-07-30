import { Outlet } from "react-router-dom";

import PlatformSidebar from "./PlatformSidebar";
import PlatformHeader from "./PlatformHeader";

export default function PlatformLayout() {
  return (
    <div className="min-h-screen bg-[#030712] flex">
      {/* Platform Navigation */}
      <PlatformSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <PlatformHeader />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}