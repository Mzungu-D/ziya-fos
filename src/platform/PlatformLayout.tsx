import { Outlet } from "react-router-dom";

import PlatformSidebar from "./PlatformSidebar";

export default function PlatformLayout() {
  return (
    <div className="flex min-h-screen bg-slate-950">

      {/* Sidebar */}

      <PlatformSidebar />

      {/* Main Workspace */}

      <main className="flex-1 overflow-hidden">

        <div className="h-screen overflow-y-auto bg-slate-950">

          <Outlet />

        </div>

      </main>

    </div>
  );
}