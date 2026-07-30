import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";

interface Notification {
  id: number;
  title: string;
  description: string;
  time: string;
  type: "success" | "warning" | "info" | "critical";
}

const notifications: Notification[] = [
  {
    id: 1,
    title: "New Organization Registered",
    description: "Mombasa Finance SACCO has joined the platform.",
    time: "5 min ago",
    type: "success",
  },
  {
    id: 2,
    title: "Pending Organization Approval",
    description: "2 organizations are awaiting verification.",
    time: "20 min ago",
    type: "warning",
  },
  {
    id: 3,
    title: "Database Backup Completed",
    description: "Nightly backup finished successfully.",
    time: "1 hour ago",
    type: "info",
  },
  {
    id: 4,
    title: "Security Alert",
    description: "Multiple failed login attempts detected.",
    time: "3 hours ago",
    type: "critical",
  },
];

export default function NotificationsPanel() {
  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-400" />;

      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-400" />;

      case "critical":
        return <ShieldAlert className="h-5 w-5 text-red-400" />;

      default:
        return <Clock className="h-5 w-5 text-blue-400" />;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">
          Notifications
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Latest platform events and alerts.
        </p>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="rounded-xl border border-slate-800 bg-slate-800 p-4 transition hover:border-amber-500"
          >
            <div className="flex items-start gap-3">
              {getIcon(notification.type)}

              <div className="flex-1">
                <h3 className="font-medium text-white">
                  {notification.title}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {notification.description}
                </p>

                <span className="mt-2 block text-xs text-slate-500">
                  {notification.time}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}