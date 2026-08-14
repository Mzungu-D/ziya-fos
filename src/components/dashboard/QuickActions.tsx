import {
  FileText,
  Wallet,
  BookOpen,
  Landmark,
  FileBarChart,
  Target,
  Brain,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
}

const quickActions: QuickAction[] = [
  {
    label: "New Invoice",
    icon: FileText,
    path: "/dashboard/invoicing",
  },
  {
    label: "New Expense",
    icon: Wallet,
    path: "/dashboard/expenses",
  },
  {
    label: "Journal Entry",
    icon: BookOpen,
    path: "/dashboard/journal-entries",
  },
  {
    label: "Bank Reconciliation",
    icon: Landmark,
    path: "/dashboard/bank-integration",
  },
  {
    label: "Financial Report",
    icon: FileBarChart,
    path: "/dashboard/financial-reports",
  },
  {
    label: "Budget Planning",
    icon: Target,
    path: "/dashboard/budgeting",
  },
  {
    label: "AI Insights",
    icon: Brain,
    path: "/dashboard/analytics",
  },
  {
    label: "Payroll Run",
    icon: Users,
    path: "/dashboard/payroll",
  },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <section className="rounded-2xl border border-[#ECECF3] bg-white p-8">
      <h2 className="mb-12 text-3xl font-bold text-[#20243A]">
        Quick Actions
      </h2>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.path)}
              className="group flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-[#ECECF3] bg-white px-6 py-8 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#D8D9E2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#20243A]/20 focus:ring-offset-2"
              aria-label={action.label}
            >
              <Icon
                size={48}
                strokeWidth={1.8}
                className="mb-8 text-[#20243A] transition-transform duration-200 group-hover:scale-105"
              />

              <span className="text-2xl font-medium leading-tight text-[#20243A]">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}