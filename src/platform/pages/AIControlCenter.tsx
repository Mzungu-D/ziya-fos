import {
  Activity,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

export default function AIControlCenter() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="AI Control Center"
        subtitle="Monitor, configure and manage all AI services running across Ziya FOS."
      />

      {/* Actions */}

      <div className="flex justify-end">

        <PrimaryButton>

          <RefreshCw size={18} />

          <span className="ml-2">
            Refresh AI Services
          </span>

        </PrimaryButton>

      </div>

      {/* AI Overview */}

      <div className="grid grid-cols-4 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Bot className="mb-4 text-[#6D5DF6]" size={30} />

          <p className="text-sm text-[#666B84]">
            AI Services
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            12
          </h2>

          <p className="mt-2 text-sm text-[#16A34A]">
            All Operational
          </p>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <BrainCircuit className="mb-4 text-[#2563EB]" size={30} />

          <p className="text-sm text-[#666B84]">
            Predictions Today
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            18,492
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Zap className="mb-4 text-[#F59E0B]" size={30} />

          <p className="text-sm text-[#666B84]">
            Average Response
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            0.42s
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <ShieldCheck className="mb-4 text-[#16A34A]" size={30} />

          <p className="text-sm text-[#666B84]">
            AI Health
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            Healthy
          </h2>

        </div>

      </div>

      {/* AI Modules */}

      <div className="grid grid-cols-2 gap-6">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <Sparkles className="text-[#6D5DF6]" />

            <h2 className="text-lg font-semibold text-[#20243A]">
              AI Modules
            </h2>

          </div>

          <div className="space-y-5">

            {[
              "Fraud Detection",
              "Cash Flow Prediction",
              "Budget Forecasting",
              "Risk Assessment",
              "Financial Insights",
              "Smart Notifications",
            ].map((module) => (

              <div
                key={module}
                className="flex items-center justify-between"
              >

                <span className="text-[#20243A]">
                  {module}
                </span>

                <CheckCircle2 className="text-green-600" />

              </div>

            ))}

          </div>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <Cpu className="text-[#2563EB]" />

            <h2 className="text-lg font-semibold text-[#20243A]">
              AI Infrastructure
            </h2>

          </div>

          <div className="space-y-5">

            <div className="flex items-center justify-between">

              <span>Inference Engine</span>

              <CheckCircle2 className="text-green-600" />

            </div>

            <div className="flex items-center justify-between">

              <span>Vector Database</span>

              <Database className="text-[#6D5DF6]" />

            </div>

            <div className="flex items-center justify-between">

              <span>Prediction Queue</span>

              <Activity className="text-[#16A34A]" />

            </div>

            <div className="flex items-center justify-between">

              <span>Model Version</span>

              <span className="font-semibold text-[#20243A]">
                v2.0
              </span>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}