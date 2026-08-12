import {
  Building2,
  CheckCircle2,
  CreditCard,
  Globe,
  Smartphone,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

export default function Integrations() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Integrations"
        subtitle="Manage external integrations connected to Ziya FOS."
      />

      <div className="flex justify-end">

        <PrimaryButton>
          Add Integration
        </PrimaryButton>

      </div>

      <div className="grid grid-cols-2 gap-6">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="flex items-center gap-4">

            <Building2 className="text-[#2563EB]" />

            <div>

              <h3 className="font-semibold">
                Banking Integration
              </h3>

              <p className="text-sm text-[#666B84]">
                Connected
              </p>

            </div>

            <CheckCircle2 className="ml-auto text-green-600" />

          </div>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="flex items-center gap-4">

            <Smartphone className="text-[#16A34A]" />

            <div>

              <h3 className="font-semibold">
                M-Pesa
              </h3>

              <p className="text-sm text-[#666B84]">
                Connected
              </p>

            </div>

            <CheckCircle2 className="ml-auto text-green-600" />

          </div>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="flex items-center gap-4">

            <Globe className="text-[#20243A]" />

            <div>

              <h3 className="font-semibold">
                REST API
              </h3>

              <p className="text-sm text-[#666B84]">
                Active
              </p>

            </div>

            <CheckCircle2 className="ml-auto text-green-600" />

          </div>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <div className="flex items-center gap-4">

            <CreditCard className="text-[#F59E0B]" />

            <div>

              <h3 className="font-semibold">
                Payment Gateway
              </h3>

              <p className="text-sm text-[#666B84]">
                Connected
              </p>

            </div>

            <CheckCircle2 className="ml-auto text-green-600" />

          </div>

        </div>

      </div>

    </div>
  );
}
