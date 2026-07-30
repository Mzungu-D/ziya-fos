import { useState } from "react";

interface PlatformSettingsState {
  platformName: string;
  companyName: string;
  supportEmail: string;
  timezone: string;
  currency: string;
}

export default function PlatformSettings() {
  const [settings, setSettings] =
    useState<PlatformSettingsState>({
      platformName:
        "Ziya Financial Operating System",

      companyName:
        "Ziya Bridge",

      supportEmail:
        "support@ziya.co.ke",

      timezone:
        "Africa/Nairobi",

      currency:
        "KES",
    });

  const [
    maintenanceMode,
    setMaintenanceMode,
  ] = useState(false);

  return (
    <div className="space-y-8">

      {/* ===========================================================
          PAGE HEADER
      =========================================================== */}

      <div>

        <h1 className="text-3xl font-bold text-white">
          Platform Settings
        </h1>

        <p className="mt-2 text-slate-400">
          Configure global settings that affect the
          entire Ziya Financial Operating System.
        </p>

      </div>

      {/* ===========================================================
          GENERAL SETTINGS
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          General Settings
        </h2>

        <p className="mt-2 text-slate-400">
          Configure organization-wide defaults.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Platform Name
            </label>

            <input
              value={settings.platformName}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  platformName:
                    e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Company Name
            </label>

            <input
              value={settings.companyName}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  companyName:
                    e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Support Email
            </label>

            <input
              value={settings.supportEmail}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  supportEmail:
                    e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Timezone
            </label>

            <select
              value={settings.timezone}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  timezone:
                    e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>
                Africa/Nairobi
              </option>

              <option>
                UTC
              </option>

              <option>
                Europe/London
              </option>

            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Base Currency
            </label>

            <select
              value={settings.currency}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  currency:
                    e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>KES</option>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
            </select>

          </div>

        </div>

        <div className="mt-8 flex justify-end">

          <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black transition hover:bg-amber-400">
            Save General Settings
          </button>

        </div>

      </section>

      {/* ===========================================================
          ENTERPRISE SECURITY
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Enterprise Security
            </h2>

            <p className="mt-2 text-slate-400">
              Configure platform-wide security
              policies and authentication rules.
            </p>

          </div>

          <div className="rounded-xl bg-emerald-600 px-5 py-3">

            <p className="text-sm text-white">
              Security Score
            </p>

            <p className="text-3xl font-bold text-white">
              96%
            </p>

          </div>

        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Multi-Factor Authentication
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Strong Password Policy
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Login Rate Limiting
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              AI Threat Detection
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

        </div>

      </section>      {/* ===========================================================
          AUTHENTICATION & IDENTITY
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Authentication & Identity
        </h2>

        <p className="mt-2 text-slate-400">
          Configure authentication providers, login methods,
          identity verification and session policies.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Email & Password Login
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Email OTP Authentication
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Phone OTP Authentication
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Magic Link Login
            </span>

            <input
              type="checkbox"
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Google Authentication
            </span>

            <input
              type="checkbox"
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Microsoft Entra ID
            </span>

            <input
              type="checkbox"
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              SAML Single Sign-On
            </span>

            <input
              type="checkbox"
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Biometric Authentication
            </span>

            <input
              type="checkbox"
            />

          </label>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Access Token Lifetime (Minutes)
            </label>

            <input
              defaultValue="15"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Refresh Token Lifetime (Days)
            </label>

            <input
              defaultValue="30"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Maximum Concurrent Sessions
            </label>

            <input
              defaultValue="3"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Remember Me Duration (Days)
            </label>

            <input
              defaultValue="30"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

        </div>

      </section>

      {/* ===========================================================
          NOTIFICATIONS & COMMUNICATION
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Notifications & Communication
        </h2>

        <p className="mt-2 text-slate-400">
          Configure email, SMS, WhatsApp, push notifications
          and collaboration platforms.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Email Notifications
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              SMS Notifications
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              WhatsApp Notifications
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Push Notifications
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Slack Notifications
            </span>

            <input
              type="checkbox"
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Microsoft Teams Notifications
            </span>

            <input
              type="checkbox"
            />

          </label>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              SMTP Host
            </label>

            <input
              defaultValue="smtp.gmail.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              SMTP Port
            </label>

            <input
              defaultValue="587"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              SMS Provider
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>
                Africa's Talking
              </option>

              <option>
                Twilio
              </option>

              <option>
                Infobip
              </option>

            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              WhatsApp Provider
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>
                Meta WhatsApp Cloud API
              </option>

              <option>
                Twilio
              </option>

              <option>
                Infobip
              </option>

              <option>
                360dialog
              </option>

            </select>

          </div>

        </div>

      </section>      {/* ===========================================================
          FINANCIAL DEFAULTS & ACCOUNTING
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Financial Defaults & Accounting
        </h2>

        <p className="mt-2 text-slate-400">
          Configure platform-wide accounting standards,
          taxation and financial defaults.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Base Currency
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>KES - Kenyan Shilling</option>
              <option>USD - US Dollar</option>
              <option>EUR - Euro</option>
              <option>GBP - British Pound</option>
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Decimal Places
            </label>

            <input
              defaultValue="2"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Rounding Method
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>Half Up</option>
              <option>Half Down</option>
              <option>Banker's Rounding</option>
              <option>Always Up</option>
              <option>Always Down</option>
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Fiscal Year
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>January - December</option>
              <option>July - June</option>
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Default VAT Rate (%)
            </label>

            <input
              defaultValue="16"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Tax Registration Number
            </label>

            <input
              placeholder="Enter KRA PIN"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Journal Prefix
            </label>

            <input
              defaultValue="JRNL"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Invoice Prefix
            </label>

            <input
              defaultValue="INV"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Receipt Prefix
            </label>

            <input
              defaultValue="RCT"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Payment Prefix
            </label>

            <input
              defaultValue="PAY"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Budget Approval Threshold (KES)
            </label>

            <input
              defaultValue="100000"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Auto Close Accounting Period
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>Yes</option>
              <option>No</option>
            </select>

          </div>

        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Enable Multi-Currency
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Automatic Exchange Rates
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Require Journal Approval
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Lock Closed Accounting Periods
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

        </div>

      </section>

      {/* ===========================================================
          AI & AUTOMATION
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          AI & Automation
        </h2>

        <p className="mt-2 text-slate-400">
          Configure AI services, predictive analytics,
          intelligent automation and fraud detection.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Enable AI Assistant
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Predictive Analytics
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              AI Recommendations
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Smart Categorization
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Fraud Detection
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Automatic Approvals
            </span>

            <input
              type="checkbox"
            />

          </label>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              AI Provider
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>OpenAI</option>
              <option>Azure OpenAI</option>
              <option>Google Gemini</option>
              <option>Anthropic Claude</option>
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Default AI Model
            </label>

            <input
              defaultValue="GPT-5.5"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Maximum Requests Per Minute
            </label>

            <input
              defaultValue="100"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Confidence Threshold (%)
            </label>

            <input
              defaultValue="85"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

        </div>

      </section>      {/* ===========================================================
          INTEGRATIONS
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Integrations
        </h2>

        <p className="mt-2 text-slate-400">
          Connect the platform with external services,
          payment providers, communication channels and APIs.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Bank Integration
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              M-Pesa Integration
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              WhatsApp Business API
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Email Services
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              SMS Gateway
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Accounting APIs
            </span>

            <input
              type="checkbox"
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Microsoft 365
            </span>

            <input
              type="checkbox"
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Google Workspace
            </span>

            <input
              type="checkbox"
            />

          </label>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Primary Bank Provider
            </label>

            <input
              defaultValue="NCBA"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              M-Pesa Short Code
            </label>

            <input
              placeholder="Enter Short Code"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Webhook URL
            </label>

            <input
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              API Timeout (Seconds)
            </label>

            <input
              defaultValue="30"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

        </div>

      </section>

      {/* ===========================================================
          MULTI-TENANT MANAGEMENT
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Multi-Tenant Management
        </h2>

        <p className="mt-2 text-slate-400">
          Configure tenant provisioning, organization
          isolation and workspace management.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Enable Multi-Tenancy
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Tenant Isolation
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Organization Switching
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Automatic Tenant Provisioning
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Custom Branding
            </span>

            <input
              type="checkbox"
              defaultChecked
            />

          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">

            <span className="text-white">
              Custom Domains
            </span>

            <input
              type="checkbox"
            />

          </label>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Default Tenant Plan
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>Starter</option>
              <option>Professional</option>
              <option>Enterprise</option>
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Maximum Users Per Tenant
            </label>

            <input
              defaultValue="100"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Storage Quota (GB)
            </label>

            <input
              defaultValue="50"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Trial Period (Days)
            </label>

            <input
              defaultValue="30"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

        </div>

      </section>      {/* ===========================================================
          BACKUP & DISASTER RECOVERY
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Backup & Disaster Recovery
        </h2>

        <p className="mt-2 text-slate-400">
          Configure automated backups, disaster recovery,
          retention policies and restoration settings.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">
            <span className="text-white">
              Automatic Daily Backups
            </span>

            <input
              type="checkbox"
              defaultChecked
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">
            <span className="text-white">
              Incremental Backups
            </span>

            <input
              type="checkbox"
              defaultChecked
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">
            <span className="text-white">
              Offsite Backup Replication
            </span>

            <input
              type="checkbox"
              defaultChecked
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">
            <span className="text-white">
              Encryption At Rest
            </span>

            <input
              type="checkbox"
              defaultChecked
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">
            <span className="text-white">
              Backup Verification
            </span>

            <input
              type="checkbox"
              defaultChecked
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">
            <span className="text-white">
              Disaster Recovery Testing
            </span>

            <input
              type="checkbox"
              defaultChecked
            />
          </label>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Backup Frequency
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>Every Hour</option>
              <option>Every 6 Hours</option>
              <option>Daily</option>
              <option>Weekly</option>
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Retention Period
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>30 Days</option>
              <option>90 Days</option>
              <option>180 Days</option>
              <option>1 Year</option>
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Backup Storage Provider
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>AWS S3</option>
              <option>Azure Blob Storage</option>
              <option>Google Cloud Storage</option>
              <option>Railway Storage</option>
            </select>

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Recovery Time Objective (RTO)
            </label>

            <input
              defaultValue="30 Minutes"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

        </div>

      </section>

      {/* ===========================================================
          PLATFORM MAINTENANCE
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Platform Maintenance
            </h2>

            <p className="mt-2 text-slate-400">
              Control maintenance windows,
              updates and scheduled downtime.
            </p>

          </div>

          <label className="flex items-center gap-3">

            <span className="text-white">
              Maintenance Mode
            </span>

            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={() =>
                setMaintenanceMode(!maintenanceMode)
              }
            />

          </label>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Maintenance Window
            </label>

            <input
              defaultValue="Sunday 02:00 - 04:00"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Update Channel
            </label>

            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            >
              <option>Stable</option>
              <option>Beta</option>
              <option>Development</option>
            </select>

          </div>

        </div>

      </section>

      {/* ===========================================================
          API KEYS & SECURITY CREDENTIALS
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          API Keys & Security Credentials
        </h2>

        <p className="mt-2 text-slate-400">
          Manage API keys, webhook secrets,
          JWT configuration and encryption keys.
        </p>

        <div className="mt-8 grid gap-6">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              OpenAI API Key
            </label>

            <input
              type="password"
              placeholder="sk-********************************"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              JWT Secret
            </label>

            <input
              type="password"
              placeholder="••••••••••••••••••••••"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Webhook Secret
            </label>

            <input
              type="password"
              placeholder="Webhook Secret"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
            />

          </div>

        </div>

      </section>      {/* ===========================================================
          PLATFORM ACTIONS
      =========================================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Platform Actions
        </h2>

        <p className="mt-2 text-slate-400">
          Execute administrative actions that affect the
          entire platform.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">

          <button className="rounded-xl bg-amber-500 px-6 py-4 font-semibold text-black transition hover:bg-amber-400">
            Save Platform Settings
          </button>

          <button className="rounded-xl bg-blue-600 px-6 py-4 font-semibold text-white transition hover:bg-blue-500">
            Test Integrations
          </button>

          <button className="rounded-xl bg-emerald-600 px-6 py-4 font-semibold text-white transition hover:bg-emerald-500">
            Run Health Check
          </button>

          <button className="rounded-xl bg-purple-600 px-6 py-4 font-semibold text-white transition hover:bg-purple-500">
            Refresh System Cache
          </button>

          <button className="rounded-xl bg-orange-600 px-6 py-4 font-semibold text-white transition hover:bg-orange-500">
            Restart Background Jobs
          </button>

          <button className="rounded-xl bg-cyan-600 px-6 py-4 font-semibold text-white transition hover:bg-cyan-500">
            Export Configuration
          </button>

        </div>

      </section>

      {/* ===========================================================
          DANGER ZONE
      =========================================================== */}

      <section className="rounded-2xl border border-red-700 bg-red-950/30 p-8">

        <h2 className="text-2xl font-semibold text-red-400">
          Danger Zone
        </h2>

        <p className="mt-2 text-red-200">
          These actions are irreversible and should only
          be performed by authorized system administrators.
        </p>

        <div className="mt-8 space-y-6">

          <div className="flex flex-col gap-4 rounded-xl border border-red-800 bg-red-950/40 p-6 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h3 className="text-lg font-semibold text-white">
                Enable Maintenance Mode
              </h3>

              <p className="mt-1 text-sm text-slate-300">
                Temporarily prevent users from accessing
                the platform while maintenance is being
                performed.
              </p>

            </div>

            <button
              className={`rounded-xl px-6 py-3 font-semibold transition ${
                maintenanceMode
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "bg-amber-500 text-black hover:bg-amber-400"
              }`}
              onClick={() =>
                setMaintenanceMode(!maintenanceMode)
              }
            >
              {maintenanceMode
                ? "Disable Maintenance"
                : "Enable Maintenance"}
            </button>

          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-red-800 bg-red-950/40 p-6 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h3 className="text-lg font-semibold text-white">
                Clear System Cache
              </h3>

              <p className="mt-1 text-sm text-slate-300">
                Removes cached data and forces the platform
                to rebuild application caches.
              </p>

            </div>

            <button className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition hover:bg-orange-500">
              Clear Cache
            </button>

          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-red-800 bg-red-950/40 p-6 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h3 className="text-lg font-semibold text-white">
                Reset Platform Configuration
              </h3>

              <p className="mt-1 text-sm text-slate-300">
                Restore all platform settings to their
                default values.
              </p>

            </div>

            <button className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-500">
              Reset Configuration
            </button>

          </div>

        </div>

      </section>

      {/* ===========================================================
          SAVE SETTINGS
      =========================================================== */}

      <div className="flex justify-end gap-4">

        <button className="rounded-xl border border-slate-700 bg-slate-800 px-8 py-3 font-semibold text-white transition hover:bg-slate-700">
          Cancel
        </button>

        <button className="rounded-xl bg-amber-500 px-8 py-3 font-semibold text-black transition hover:bg-amber-400">
          Save All Changes
        </button>

      </div>

    </div>
  );
}