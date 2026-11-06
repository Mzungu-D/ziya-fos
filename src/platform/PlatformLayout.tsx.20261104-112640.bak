import { Outlet } from "react-router-dom";

import PlatformSidebar from "./PlatformSidebar";
import PlatformTopbar  from "./components/PlatformTopbar";

export default function PlatformLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FC]">

      {/* Sidebar */}
      <PlatformSidebar />

      {/* Workspace */}
      <section className="flex min-w-0 flex-1 flex-col">

        {/* Top Navigation */}
        <PlatformTopbar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FC]">
          <div className="mx-auto w-full max-w-[1700px] px-10 py-8">
            <Outlet />
          </div>
        </main>

      </section>

    </div>
  );
}