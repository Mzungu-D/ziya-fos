import {
  Bell,
  Bot,
  Database,
  Globe,
  KeyRound,
  Lock,
  Mail,
  Save,
  Server,
  Shield,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

export default function PlatformSettings() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Platform Settings"
        subtitle="Configure global settings for the Ziya Financial Operating System."
      />

      {/* Save */}

      <div className="flex justify-end">

        <PrimaryButton>

          <Save size={18} />

          <span className="ml-2">
            Save Changes
          </span>

        </PrimaryButton>

      </div>

      {/* Settings Grid */}

      <div className="grid grid-cols-2 gap-6">

        {/* General */}

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <Globe className="text-[#6D5DF6]" />

            <h2 className="text-lg font-semibold text-[#20243A]">
              General
            </h2>

          </div>

          <div className="space-y-4">

            <input
              className="w-full rounded-xl border border-[#ECECF3] p-3"
              placeholder="Platform Name"
              defaultValue="Ziya Financial Operating System"
            />

            <input
              className="w-full rounded-xl border border-[#ECECF3] p-3"
              placeholder="Platform URL"
              defaultValue="https://fos.ziya.co.ke"
            />

          </div>

        </div>

        {/* Email */}

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <Mail className="text-[#16A34A]" />

            <h2 className="text-lg font-semibold text-[#20243A]">
              Email Configuration
            </h2>

          </div>

          <div className="space-y-4">

            <input
              className="w-full rounded-xl border border-[#ECECF3] p-3"
              placeholder="SMTP Host"
            />

            <input
              className="w-full rounded-xl border border-[#ECECF3] p-3"
              placeholder="SMTP Username"
            />

          </div>

        </div>

        {/* Security */}

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <Shield className="text-[#F59E0B]" />

            <h2 className="text-lg font-semibold text-[#20243A]">
              Security
            </h2>

          </div>

          <div className="space-y-4">

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              <span>
                Two Factor Authentication
              </span>

              <Lock />

            </button>

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              <span>
                Password Policy
              </span>

              <KeyRound />

            </button>

          </div>

        </div>

        {/* AI */}

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <Bot className="text-[#6D5DF6]" />

            <h2 className="text-lg font-semibold text-[#20243A]">
              AI Configuration
            </h2>

          </div>

          <div className="space-y-4">

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              <span>
                AI Predictions
              </span>

              <Bot />

            </button>

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              <span>
                Notification Engine
              </span>

              <Bell />

            </button>

          </div>

        </div>

        {/* Database */}

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <Database className="text-[#2563EB]" />

            <h2 className="text-lg font-semibold text-[#20243A]">
              Database
            </h2>

          </div>

          <div className="space-y-4">

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              PostgreSQL

              <Server />

            </button>

          </div>

        </div>

      </div>

    </div>
  );
}