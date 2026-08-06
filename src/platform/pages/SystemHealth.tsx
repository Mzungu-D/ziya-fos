import {
  Activity,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  HardDrive,
  Network,
  Server,
  Users,
} from "lucide-react";

import PageHeader from "../components/PageHeader";

export default function SystemHealth() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="System Health"
        subtitle="Monitor the health, availability and performance of the Ziya Financial Operating System."
      />

      {/* Status Cards */}

      <div className="grid grid-cols-4 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Server className="mb-4 text-[#16A34A]" size={30} />

          <p className="text-sm text-[#666B84]">
            API Status
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            Online
          </h2>

          <span className="mt-3 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            Healthy
          </span>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Database className="mb-4 text-[#2563EB]" size={30} />

          <p className="text-sm text-[#666B84]">
            PostgreSQL
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            Connected
          </h2>

          <span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Active
          </span>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Users className="mb-4 text-[#6D5DF6]" size={30} />

          <p className="text-sm text-[#666B84]">
            Active Users
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            1,284
          </h2>

          <p className="mt-3 text-sm text-[#16A34A]">
            +18 today
          </p>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Activity className="mb-4 text-[#F59E0B]" size={30} />

          <p className="text-sm text-[#666B84]">
            Uptime
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            99.98%
          </h2>

          <p className="mt-3 text-sm text-[#16A34A]">
            Last 30 Days
          </p>

        </div>

      </div>

      {/* Infrastructure */}

      <div className="grid grid-cols-2 gap-6">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <h2 className="mb-6 text-lg font-semibold text-[#20243A]">
            Infrastructure
          </h2>

          <div className="space-y-5">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <Server className="text-[#6D5DF6]" />

                Railway Server

              </div>

              <CheckCircle2 className="text-green-600" />

            </div>

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <Database className="text-[#2563EB]" />

                PostgreSQL

              </div>

              <CheckCircle2 className="text-green-600" />

            </div>

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <Network className="text-[#16A34A]" />

                API Gateway

              </div>

              <CheckCircle2 className="text-green-600" />

            </div>

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <Cpu className="text-[#F59E0B]" />

                AI Engine

              </div>

              <CheckCircle2 className="text-green-600" />

            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <h2 className="mb-6 text-lg font-semibold text-[#20243A]">
            Resource Usage
          </h2>

          <div className="space-y-6">

            <div>

              <div className="mb-2 flex justify-between">

                <span>CPU</span>

                <span>34%</span>

              </div>

              <div className="h-3 rounded-full bg-[#ECECF3]">

                <div className="h-3 w-[34%] rounded-full bg-[#6D5DF6]" />

              </div>

            </div>

            <div>

              <div className="mb-2 flex justify-between">

                <span>Memory</span>

                <span>61%</span>

              </div>

              <div className="h-3 rounded-full bg-[#ECECF3]">

                <div className="h-3 w-[61%] rounded-full bg-[#2563EB]" />

              </div>

            </div>

            <div>

              <div className="mb-2 flex justify-between">

                <span>Storage</span>

                <span>43%</span>

              </div>

              <div className="h-3 rounded-full bg-[#ECECF3]">

                <div className="h-3 w-[43%] rounded-full bg-[#16A34A]" />

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Footer Cards */}

      <div className="grid grid-cols-3 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Clock3 className="mb-3 text-[#6D5DF6]" />

          <h3 className="font-semibold text-[#20243A]">
            Last Deployment
          </h3>

          <p className="mt-2 text-[#666B84]">
            06 Aug 2026 • Railway Production
          </p>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <HardDrive className="mb-3 text-[#2563EB]" />

          <h3 className="font-semibold text-[#20243A]">
            Database Size
          </h3>

          <p className="mt-2 text-[#666B84]">
            2.8 GB
          </p>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Activity className="mb-3 text-[#16A34A]" />

          <h3 className="font-semibold text-[#20243A]">
            Background Jobs
          </h3>

          <p className="mt-2 text-[#666B84]">
            14 Running
          </p>

        </div>

      </div>

    </div>
  );
}