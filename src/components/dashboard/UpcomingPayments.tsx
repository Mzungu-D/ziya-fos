import { CalendarClock } from "lucide-react";

const payments = [
  {
    date: "08 Jul 2026",
    description: "Office Rent",
    amount: "KES 80,000",
    status: "Due Soon",
  },
  {
    date: "10 Jul 2026",
    description: "Monthly Payroll",
    amount: "KES 1,250,000",
    status: "Scheduled",
  },
  {
    date: "12 Jul 2026",
    description: "Internet Services",
    amount: "KES 15,000",
    status: "Pending",
  },
  {
    date: "15 Jul 2026",
    description: "Electricity Bill",
    amount: "KES 42,000",
    status: "Pending",
  },
];

export default function UpcomingPayments() {
  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <CalendarClock className="text-orange-400" size={24} />
        </div>

        <div>
          <h2 className="text-[#20243A] text-xl font-bold">
            Upcoming Payments
          </h2>

          <p className="text-[#666B84] text-sm">
            Bills and scheduled payments
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {payments.map((payment, index) => (
          <div
            key={index}
            className="flex justify-between items-center border-b border-[#ECECF3] pb-4 last:border-none"
          >
            <div>
              <h3 className="text-[#20243A] font-medium">
                {payment.description}
              </h3>

              <p className="text-[#666B84] text-sm">
                {payment.date}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[#20243A] font-semibold">
                {payment.amount}
              </p>

              <span
                className={`text-xs px-3 py-1 rounded-full ${
                  payment.status === "Due Soon"
                    ? "bg-red-500/20 text-red-400"
                    : payment.status === "Scheduled"
                    ? "bg-[#6D5DF6]/20 text-[#6D5DF6]"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {payment.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}