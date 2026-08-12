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
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#20243A]">
          Activity Feed
        </h2>

        <button className="text-[#20243A] text-sm hover:text-[#20243A]">
          View All
        </button>
      </div>

      <div className="space-y-5">
        {activities.map((activity, index) => (
          <div key={index} className="border-b border-[#ECECF3] pb-4">
            <p className="text-[#20243A] font-medium">
              {activity.title}
            </p>

            <p className="text-[#666B84] text-sm mt-1">
              {activity.description}
            </p>

            <p className="text-[#666B84] text-xs mt-2">
              {activity.time}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
