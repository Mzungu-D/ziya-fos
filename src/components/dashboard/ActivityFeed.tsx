const activities = [
  {
    title: "AI Insight Generated",
    description: "Cash flow forecast updated",
    time: "2 minutes ago",
  },
  {
    title: "Payment Received",
    description: "Invoice INV-2025-00124 paid",
    time: "15 minutes ago",
  },
  {
    title: "Expense Approved",
    description: "Office expenses approved",
    time: "1 hour ago",
  },
  {
    title: "Report Generated",
    description: "Monthly financial report",
    time: "2 hours ago",
  },
  {
    title: "Budget Alert",
    description: "Marketing budget 90% used",
    time: "3 hours ago",
  },
  {
    title: "User Login",
    description: "Dennis Odhiambo logged in",
    time: "4 hours ago",
  },
];

export default function ActivityFeed() {
  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">
          Activity Feed
        </h2>

        <button className="text-blue-400 text-sm hover:text-blue-300">
          View All
        </button>
      </div>

      <div className="space-y-5">
        {activities.map((activity, index) => (
          <div key={index} className="border-b border-slate-800 pb-4">
            <p className="text-white font-medium">
              {activity.title}
            </p>

            <p className="text-slate-400 text-sm mt-1">
              {activity.description}
            </p>

            <p className="text-slate-500 text-xs mt-2">
              {activity.time}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}