import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Loader2 } from "lucide-react";

import { getSubscriptions } from "../../services/platformSubscriptions";
import type { PlanBreakdownItem } from "../../services/platformSubscriptions";

/* ─── plan config ────────────────────────────────────────── */

const PLAN_CFG: Record<string, { color: string; label: string }> = {
  ENTERPRISE:   { color: "#20243A", label: "Enterprise"   },
  PROFESSIONAL: { color: "#2563EB", label: "Professional" },
  STARTER:      { color: "#D4AF37", label: "Starter"      },
  TRIAL:        { color: "#22C55E", label: "Trial"        },
};

function cfgFor(plan: string) {
  return PLAN_CFG[plan] ?? { color: "#94A3B8", label: plan };
}

/* ─── custom tooltip ─────────────────────────────────────── */

interface TooltipProps {
  active?:  boolean;
  payload?: { name: string; value: number }[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const cfg  = cfgFor(item.name);
  return (
    <div className="rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 shadow-lg">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: cfg.color }}
        />
        <span className="text-sm font-semibold text-[#20243A]">{cfg.label}</span>
      </div>
      <p className="mt-0.5 text-xs text-[#666B84]">
        {item.value} organisation{item.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

/* ─── component ──────────────────────────────────────────── */

export default function SubscriptionChart() {
  const [breakdown, setBreakdown] = useState<PlanBreakdownItem[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getSubscriptions({ limit: 1, page: 1 })
      .then((r) => setBreakdown(r.planBreakdown ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total     = breakdown.reduce((s, b) => s + b.count, 0);
  const chartData = breakdown.map((b) => ({ name: b.plan, value: b.count }));

  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

      {/* header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#20243A]">Subscription Overview</h2>
        <p className="mt-1 text-sm text-[#666B84]">
          Distribution of active subscription plans
        </p>
      </div>

      {/* loading */}
      {loading && (
        <div className="flex h-[280px] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#D4AF37]" />
        </div>
      )}

      {/* empty */}
      {!loading && total === 0 && (
        <div className="flex h-[280px] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-[#94A3B8]">No subscription data yet</p>
          <p className="text-xs text-[#C7CCD9]">
            Create subscriptions to see the breakdown
          </p>
        </div>
      )}

      {/* chart + list */}
      {!loading && total > 0 && (
        <>
          {/* donut */}
          <div className="relative h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={98}
                  strokeWidth={3}
                  stroke="#FFFFFF"
                  paddingAngle={2}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={cfgFor(entry.name).color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* centre label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[11px] font-medium uppercase tracking-widest text-[#94A3B8]">
                Total
              </p>
              <p className="mt-0.5 text-4xl font-bold text-[#20243A]">{total}</p>
              <p className="mt-0.5 text-xs text-[#666B84]">Organisations</p>
            </div>
          </div>

          {/* breakdown list */}
          <div className="mt-5 space-y-3">
            {breakdown.map((item) => {
              const cfg = cfgFor(item.plan);
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={item.plan} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="flex-1 text-sm text-[#475569]">{cfg.label}</span>
                  <span className="text-xs text-[#94A3B8]">{pct}%</span>
                  <span className="w-6 text-right text-sm font-semibold text-[#20243A]">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
