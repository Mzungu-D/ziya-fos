import WelcomeBanner from "../../components/platform/dashboard/WelcomeBanner";
import KPIGrid from "../../components/platform/dashboard/KPIGrid";
import QuickActions from "../../components/platform/dashboard/QuickActions";
import OrganizationGrowthChart from "../../components/platform/dashboard/OrganizationGrowthChart";
import RecentOrganizations from "../../components/platform/dashboard/RecentOrganizations";
import RecentActivity from "../../components/platform/dashboard/RecentActivity";
import SystemHealth from "../../components/platform/dashboard/SystemHealth";
import NotificationsPanel from "../../components/platform/dashboard/NotificationsPanel";

export default function PlatformDashboard() {
  return (
    <div className="space-y-6">
      <WelcomeBanner
        firstName="Dennis"
        organizationName="Ziya Platform"
        lastLogin="Today • 09:14 AM"
        version="1.0.0"
      />

      <KPIGrid />

      <QuickActions />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <OrganizationGrowthChart />
        </div>

        <NotificationsPanel />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentOrganizations />
        <RecentActivity />
      </div>

      <SystemHealth />
    </div>
  );
}