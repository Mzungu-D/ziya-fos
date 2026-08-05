import { useState } from "react";

export default function Integrations() {
  const [platform] = useState({
    railway: "Connected",
    postgres: "Connected",
    storage: "Connected",

    email: "Connected",
    sms: "Connected",
    whatsapp: "Connected",

    mpesa: "Configured",
    bankGateway: "Configured",
    paymentGateway: "Configured",

    emailOtp: "Enabled",
    phoneOtp: "Enabled",
    googleOAuth: "Disabled",
    microsoftOAuth: "Disabled",

    webhooks: "Active",
    apiKeys: 8,
  });

  return (
    <div className="space-y-8">

      {/* ===========================================
          PAGE HEADER
      =========================================== */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-white">
            Platform Integrations
          </h1>

          <p className="mt-2 text-slate-400">
            Configure and monitor external services used by
            the Ziya Financial Operating System Platform.
          </p>

        </div>

        <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black transition hover:bg-amber-400">
          Verify Connections
        </button>

      </div>

      {/* ===========================================
          PLATFORM SUMMARY
      =========================================== */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Connected Services
          </p>

          <h2 className="mt-4 text-4xl font-bold text-emerald-400">
            12
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Platform APIs
          </p>

          <h2 className="mt-4 text-4xl font-bold text-blue-400">
            Active
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Webhooks
          </p>

          <h2 className="mt-4 text-4xl font-bold text-purple-400">
            {platform.apiKeys}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Platform Status
          </p>

          <h2 className="mt-4 text-4xl font-bold text-emerald-400">
            Healthy
          </h2>

        </div>

      </div>      {/* ===========================================
          INFRASTRUCTURE SERVICES
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Infrastructure Services
            </h2>

            <p className="mt-2 text-slate-400">
              Core infrastructure powering every Ziya FOS organization.
            </p>

          </div>

          <button className="rounded-xl bg-slate-800 px-5 py-3 font-medium text-white transition hover:bg-slate-700">
            Verify Infrastructure
          </button>

        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <div className="flex items-center justify-between">

              <h3 className="text-lg font-semibold text-white">
                Railway Platform
              </h3>

              <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                {platform.railway}
              </span>

            </div>

            <p className="mt-4 text-sm text-slate-400">
              Production hosting, deployments, environment variables,
              scaling and platform runtime.
            </p>

            <div className="mt-6 flex gap-3">

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
                Configure
              </button>

              <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Health
              </button>

            </div>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <div className="flex items-center justify-between">

              <h3 className="text-lg font-semibold text-white">
                PostgreSQL Cluster
              </h3>

              <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                {platform.postgres}
              </span>

            </div>

            <p className="mt-4 text-sm text-slate-400">
              Multi-tenant production database, replication,
              backups and disaster recovery.
            </p>

            <div className="mt-6 flex gap-3">

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
                Manage
              </button>

              <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Metrics
              </button>

            </div>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <div className="flex items-center justify-between">

              <h3 className="text-lg font-semibold text-white">
                Object Storage
              </h3>

              <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                {platform.storage}
              </span>

            </div>

            <p className="mt-4 text-sm text-slate-400">
              Secure storage for documents, reports,
              attachments and generated exports.
            </p>

            <div className="mt-6 flex gap-3">

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
                Configure
              </button>

              <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Usage
              </button>

            </div>

          </div>

        </div>

      </section>

      {/* ===========================================
          COMMUNICATION SERVICES
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Communication Services
            </h2>

            <p className="mt-2 text-slate-400">
              Platform communication channels used by every organization.
            </p>

          </div>

          <button className="rounded-xl bg-slate-800 px-5 py-3 font-medium text-white transition hover:bg-slate-700">
            Test Messaging
          </button>

        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              Email Provider
            </h3>

            <p className="mt-4 text-sm text-slate-400">
              Verification emails, password resets,
              reports and platform notifications.
            </p>

            <div className="mt-6 flex items-center justify-between">

              <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                {platform.email}
              </span>

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                Configure
              </button>

            </div>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              SMS Gateway
            </h3>

            <p className="mt-4 text-sm text-slate-400">
              OTP delivery and transactional
              SMS notifications.
            </p>

            <div className="mt-6 flex items-center justify-between">

              <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                {platform.sms}
              </span>

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                Configure
              </button>

            </div>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              WhatsApp Business
            </h3>

            <p className="mt-4 text-sm text-slate-400">
              Customer messaging and business communication
              through the platform.
            </p>

            <div className="mt-6 flex items-center justify-between">

              <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                {platform.whatsapp}
              </span>

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                Configure
              </button>

            </div>

          </div>

        </div>

      </section>      {/* ===========================================
          FINANCIAL SERVICES
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Financial Services
            </h2>

            <p className="mt-2 text-slate-400">
              Platform-level payment infrastructure available to every organization.
            </p>

          </div>

          <button className="rounded-xl bg-slate-800 px-5 py-3 font-medium text-white hover:bg-slate-700">
            Verify Financial Services
          </button>

        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-3">

          {/* M-Pesa */}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              M-Pesa Platform API
            </h3>

            <p className="mt-4 text-sm text-slate-400">
              Shared integration infrastructure for STK Push,
              C2B, B2C, transaction callbacks and reconciliation.
            </p>

            <div className="mt-6 flex items-center justify-between">

              <span className="rounded-full bg-blue-900/40 px-3 py-1 text-sm font-semibold text-blue-300">
                {platform.mpesa}
              </span>

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                Manage
              </button>

            </div>

          </div>

          {/* Banking */}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              Banking Gateway
            </h3>

            <p className="mt-4 text-sm text-slate-400">
              Secure gateway for bank integrations,
              statements, reconciliation and payment services.
            </p>

            <div className="mt-6 flex items-center justify-between">

              <span className="rounded-full bg-blue-900/40 px-3 py-1 text-sm font-semibold text-blue-300">
                {platform.bankGateway}
              </span>

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                Configure
              </button>

            </div>

          </div>

          {/* Payment Gateway */}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              Payment Gateway
            </h3>

            <p className="mt-4 text-sm text-slate-400">
              Subscription billing, online payments
              and future marketplace transactions.
            </p>

            <div className="mt-6 flex items-center justify-between">

              <span className="rounded-full bg-blue-900/40 px-3 py-1 text-sm font-semibold text-blue-300">
                {platform.paymentGateway}
              </span>

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                Configure
              </button>

            </div>

          </div>

        </div>

      </section>

      {/* ===========================================
          AUTHENTICATION SERVICES
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Authentication Services
            </h2>

            <p className="mt-2 text-slate-400">
              Identity services protecting every organization on the platform.
            </p>

          </div>

          <button className="rounded-xl bg-slate-800 px-5 py-3 font-medium text-white hover:bg-slate-700">
            Test Authentication
          </button>

        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Service
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Purpose
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Status
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 text-white">
                  Email OTP
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Email verification and secure login.
                </td>

                <td className="px-6 py-5 text-center">

                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                    {platform.emailOtp}
                  </span>

                </td>

                <td className="px-6 py-5 text-center">

                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Configure
                  </button>

                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 text-white">
                  Phone OTP
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Secure phone-based authentication.
                </td>

                <td className="px-6 py-5 text-center">

                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                    {platform.phoneOtp}
                  </span>

                </td>

                <td className="px-6 py-5 text-center">

                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Configure
                  </button>

                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 text-white">
                  Google OAuth
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Optional single sign-on integration.
                </td>

                <td className="px-6 py-5 text-center">

                  <span className="rounded-full bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-300">
                    {platform.googleOAuth}
                  </span>

                </td>

                <td className="px-6 py-5 text-center">

                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Enable
                  </button>

                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 text-white">
                  Microsoft OAuth
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Enterprise Microsoft identity provider.
                </td>

                <td className="px-6 py-5 text-center">

                  <span className="rounded-full bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-300">
                    {platform.microsoftOAuth}
                  </span>

                </td>

                <td className="px-6 py-5 text-center">

                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Enable
                  </button>

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>      {/* ===========================================
          DEVELOPER & INTEGRATION HUB
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Developer & Integration Hub
            </h2>

            <p className="mt-2 text-slate-400">
              Securely manage APIs, webhooks and developer integrations
              used by the Ziya Financial Operating System Platform.
            </p>

          </div>

          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">
            Create API Key
          </button>

        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              API Keys
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              Manage platform API credentials for secure integrations.
            </p>

            <h2 className="mt-6 text-4xl font-bold text-emerald-400">
              {platform.apiKeys}
            </h2>

            <button className="mt-6 rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">
              Manage Keys
            </button>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              Webhooks
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              Configure outbound events and callback endpoints.
            </p>

            <h2 className="mt-6 text-4xl font-bold text-blue-400">
              {platform.webhooks}
            </h2>

            <button className="mt-6 rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">
              View Webhooks
            </button>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-lg font-semibold text-white">
              API Documentation
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              Access developer documentation and integration guides.
            </p>

            <h2 className="mt-6 text-4xl font-bold text-purple-400">
              v1
            </h2>

            <button className="mt-6 rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">
              View Docs
            </button>

          </div>

        </div>

      </section>

      {/* ===========================================
          INTEGRATION HEALTH SUMMARY
      =========================================== */}

      <section className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-8">

        <h2 className="text-2xl font-semibold text-emerald-400">
          Integration Health Summary
        </h2>

        <p className="mt-4 text-slate-300">
          All integrations displayed on this page operate at the
          platform level and provide shared services to organizations
          using Ziya Financial Operating System. Individual organization
          configurations, bank accounts, payment credentials, AI usage
          and business-specific integrations are managed within each
          organization's workspace and are intentionally separated from
          platform administration.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

            <h3 className="font-semibold text-white">
              Infrastructure
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Railway, PostgreSQL and Storage services are operational.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

            <h3 className="font-semibold text-white">
              Communication
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Email, SMS and WhatsApp channels are available.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

            <h3 className="font-semibold text-white">
              Financial Services
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Payment infrastructure is configured and monitored.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

            <h3 className="font-semibold text-white">
              Authentication
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Identity and access integrations are active and secured.
            </p>

          </div>

        </div>

      </section>

    </div>
  );
}