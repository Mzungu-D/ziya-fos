import { Outlet } from "react-router-dom";

import PlatformSidebar from "./PlatformSidebar";
import PlatformTopbar from "./components/PlatformTopbar";

export default function PlatformLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FC]">

      {/* Sidebar */}

      <PlatformSidebar />

      {/* Workspace */}

      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top Navigation */}

        <PlatformTopbar />

        {/* Main Content */}

        <main className="flex-1 overflow-y-auto bg-[#F8F9FC] px-10 py-8">

          <div className="mx-auto max-w-[1700px]">

            <Outlet />

          </div>

        </main>

      </div>

    </div>
  );
}