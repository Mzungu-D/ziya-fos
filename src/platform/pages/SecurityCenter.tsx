import {
  KeyRound,
  Lock,
  Shield,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

export default function SecurityCenter() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Security Center"
        subtitle="Manage authentication, security policies and platform protection."
      />

      <div className="flex justify-end">

        <PrimaryButton>
          Save Security Settings
        </PrimaryButton>

      </div>

      <div className="grid grid-cols-2 gap-6">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <Shield className="text-[#20243A]" />

            <h2 className="text-lg font-semibold">
              Authentication
            </h2>

          </div>

          <div className="space-y-4">

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              Multi-Factor Authentication

              <ShieldCheck />

            </button>

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              Password Policy

              <KeyRound />

            </button>

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              Session Timeout

              <Lock />

            </button>

          </div>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <UserCheck className="text-[#16A34A]" />

            <h2 className="text-lg font-semibold">
              Access Control
            </h2>

          </div>

          <div className="space-y-4">

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              Role Permissions

              <Shield />

            </button>

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              Login Audit

              <ShieldCheck />

            </button>

            <button className="flex w-full items-center justify-between rounded-xl border border-[#ECECF3] p-4">

              Device Trust

              <Lock />

            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
