import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  Network,
  ScanSearch,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

const solutions = [
  {
    icon: BriefcaseBusiness,
    title: "Finance Teams",
    description:
      "Manage accounting, journals, receivables, payables, reporting, budgets and financial controls from one workspace.",
  },
  {
    icon: Building2,
    title: "Growing Businesses",
    description:
      "Move away from disconnected spreadsheets and fragmented financial processes into one structured operating system.",
  },
  {
    icon: Network,
    title: "Multi-Company Organizations",
    description:
      "Operate separate organizations and companies through isolated workspaces with controlled access and organization-specific records.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Management Teams",
    description:
      "Give decision-makers clearer financial visibility through reporting, analytics, forecasting and intelligent insights.",
  },
  {
    icon: Users,
    title: "Operations Teams",
    description:
      "Connect procurement, vendors, expenses, payroll and assets directly to the financial operation.",
  },
  {
    icon: ScanSearch,
    title: "Audit & Control",
    description:
      "Strengthen accountability through custom permissions, approval workflows, tenant controls and comprehensive audit trails.",
  },
];

export default function Solutions() {
  return (
    <div className="min-h-screen bg-[#081019] px-6 pb-24 pt-36 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e5b83b]">
            Solutions
          </p>

          <h1 className="mt-5 text-5xl font-medium tracking-[-0.045em] md:text-7xl">
            Financial infrastructure
            <br />
            built around your business.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/60">
            From a single finance team to a multi-company organization, Ziya
            FOS provides a controlled financial environment designed to scale.
          </p>
        </div>

        <div className="mt-16 grid overflow-hidden rounded-[32px] border border-white/10 bg-white/10 md:grid-cols-2">
          {solutions.map((solution) => {
            const Icon = solution.icon;

            return (
              <article
                key={solution.title}
                className="border-b border-white/10 bg-[#0b141e] p-8 last:border-b-0 md:border-r md:p-10"
              >
                <Icon className="text-[#e5b83b]" size={27} />

                <h2 className="mt-7 text-2xl font-semibold">
                  {solution.title}
                </h2>

                <p className="mt-4 max-w-xl leading-7 text-white/55">
                  {solution.description}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-7 rounded-[32px] border border-white/10 bg-white/[0.04] p-8 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-3xl font-semibold">
              Give your organization its own Ziya workspace.
            </h2>

            <p className="mt-3 text-white/55">
              Organization data and access remain isolated from other Ziya
              tenants.
            </p>
          </div>

          <Link
            to="/open-account"
            className="inline-flex shrink-0 items-center gap-3 rounded-full bg-white px-7 py-4 font-semibold text-[#081019]"
          >
            Open account
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}