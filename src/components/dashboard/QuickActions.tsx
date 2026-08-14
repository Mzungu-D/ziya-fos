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

interface QuickAction {
  title: string;
  icon: typeof Receipt;
  path: string;
}

const actions: QuickAction[] = [
  {
    title: "New Invoice",
    icon: Receipt,
    path: "/invoicing",
  },
  {
    title: "New Expense",
    icon: Wallet,
    path: "/expenses",
  },
  {
    title: "Journal Entry",
    icon: BookOpen,
    path: "/journal-entries",
  },
  {
    title: "Bank Reconciliation",
    icon: Landmark,
    path: "/bank-accounts",
  },
  {
    title: "Financial Report",
    icon: FileText,
    path: "/financial-reports",
  },
  {
    title: "Budget Planning",
    icon: Target,
    path: "/budgets",
  },
  {
    title: "AI Insights",
    icon: Brain,
    path: "/ai-insights",
  },
  {
    title: "Payroll Run",
    icon: Users,
    path: "/payroll",
  },
];

export default function QuickActions() {
  const handleAction = (
    path: string
  ) => {
    window.location.href = path;
  };

  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <h2 className="text-xl font-bold text-[#20243A] mb-6">
        Quick Actions
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.title}
              type="button"
              onClick={() =>
                handleAction(
                  action.path
                )
              }
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
                cursor-pointer
              "
            >
              <Icon
                size={24}
                className="text-[#20243A]"
              />

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