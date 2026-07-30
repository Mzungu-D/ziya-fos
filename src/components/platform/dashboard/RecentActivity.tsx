import {
  CheckCircle2,
  Clock3,
  Building2,
  UserPlus,
  ShieldCheck,
} from "lucide-react";

interface Activity {
  id: number;
  title: string;
  description: string;
  time: string;
  icon: React.ElementType;
}

const activities: Activity[] = [
  {
    id: 1,
    title: "Organization Created",
    description: "Ziya Bridge was successfully provisioned.",
    time: "5 minutes ago",
    icon: Building2,
  },
  {
    id: 2,
    title: "Administrator Added",
    description: "A new platform administrator was invited.",
    time: "18 minutes ago",
    icon: UserPlus,
  },
  {
    id: 3,
    title: "Backup Completed",
    description: "Automatic database backup completed successfully.",
    time: "1 hour ago",
    icon: CheckCircle2,
  },
  {
    id: 4,
    title: "Security Policy Updated",
    description: "Platform security policies were updated.",
    time: "Today",
    icon: ShieldCheck,
  },
];

export default function RecentActivity() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">
          Recent Activity
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Latest actions across the platform.
        </p>
      </div>

      <div className="space-y-5">
        {activities.map((activity) => {
          const Icon = activity.icon;

          return (
            <div
              key={activity.id}
              className="flex gap-4"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10">
                <Icon className="h-5 w-5 text-amber-400" />
              </div>

              <div className="flex-1 border-b border-slate-800 pb-5 last:border-none last:pb-0">
                <h3 className="font-medium text-white">
                  {activity.title}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {activity.description}
                </p>

                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  {activity.time}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}