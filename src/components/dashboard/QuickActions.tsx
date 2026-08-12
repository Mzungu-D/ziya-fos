import {
  Receipt,
  Wallet,
  BookOpen,
  Landmark,
  FileText,
  Target,
  Brain,
  Users,
} from "lucide-react";

const actions = [
  {
    title: "New Invoice",
    icon: Receipt,
  },
  {
    title: "New Expense",
    icon: Wallet,
  },
  {
    title: "Journal Entry",
    icon: BookOpen,
  },
  {
    title: "Bank Reconciliation",
    icon: Landmark,
  },
  {
    title: "Financial Report",
    icon: FileText,
  },
  {
    title: "Budget Planning",
    icon: Target,
  },
  {
    title: "AI Insights",
    icon: Brain,
  },
  {
    title: "Payroll Run",
    icon: Users,
  },
];

export default function QuickActions() {
  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <h2 className="text-xl font-bold text-[#20243A] mb-6">
        Quick Actions
      </h2>

      <div className="grid grid-cols-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.title}
              className="
                bg-white
                border
                border-[#ECECF3]
                rounded-xl
                p-5
                flex
                flex-col
                items-center
                justify-center
                gap-3
                hover:border-[#20243A]
                hover:bg-[#F8F9FC]
                transition-all
              "
            >
              <Icon size={24} className="text-[#20243A]" />

              <span className="text-sm text-[#20243A] text-center">
                {action.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
