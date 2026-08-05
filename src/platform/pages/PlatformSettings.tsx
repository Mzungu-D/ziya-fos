import { useState } from "react";

export default function PlatformSettings() {
  const [settings] = useState({
    platformName: "Ziya Financial Operating System",
    company: "Ziya Bridge",
    supportEmail: "support@ziya.co.ke",
    supportPhone: "+254 700 000000",
    website: "https://ziya.co.ke",
    environment: "Production",
    timezone: "Africa/Nairobi",
    currency: "KES",
    language: "English",
    maintenanceMode: false,
    tenantRegistration: true,
    emailVerification: true,
    mfaRequired: true,
    sessionTimeout: 30,
    passwordExpiry: 90,
  });

  return (
    <div className="space-y-8">

      {/* ===========================================
          PAGE HEADER
      =========================================== */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-white">
            Platform Settings
          </h1>

          <p className="mt-2 text-slate-400">
            Configure global settings that affect every
            organization using the Ziya Financial
            Operating System.
          </p>

        </div>

        <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black transition hover:bg-amber-400">
          Save Changes
        </button>

      </div>

      {/* ===========================================
          PLATFORM INFORMATION
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Platform Information
        </h2>

        <p className="mt-2 text-slate-400">
          Basic information about the platform.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Platform Name
            </label>

            <input
              value={settings.platformName}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Company
            </label>

            <input
              value={settings.company}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Support Email
            </label>

            <input
              value={settings.supportEmail}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Support Phone
            </label>

            <input
              value={settings.supportPhone}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Website
            </label>

            <input
              value={settings.website}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Environment
            </label>

            <input
              value={settings.environment}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

        </div>

      </section>      {/* ===========================================
          REGIONAL SETTINGS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Regional Settings
        </h2>

        <p className="mt-2 text-slate-400">
          Configure localization and regional defaults.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Default Timezone
            </label>

            <input
              value={settings.timezone}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Default Currency
            </label>

            <input
              value={settings.currency}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Default Language
            </label>

            <input
              value={settings.language}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

        </div>

      </section>

      {/* ===========================================
          SECURITY SETTINGS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Security Settings
        </h2>

        <p className="mt-2 text-slate-400">
          Configure authentication and platform security.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Session Timeout (Minutes)
            </label>

            <input
              value={settings.sessionTimeout}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

          <div>

            <label className="mb-2 block text-sm text-slate-400">
              Password Expiry (Days)
            </label>

            <input
              value={settings.passwordExpiry}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />

          </div>

        </div>

        <div className="mt-8 grid gap-4">

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-5">

            <div>

              <h3 className="font-semibold text-white">
                Email Verification
              </h3>

              <p className="text-sm text-slate-400">
                Require email verification before login.
              </p>

            </div>

            <span className="rounded-full bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300">
              {settings.emailVerification ? "Enabled" : "Disabled"}
            </span>

          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-5">

            <div>

              <h3 className="font-semibold text-white">
                Multi-Factor Authentication
              </h3>

              <p className="text-sm text-slate-400">
                Require MFA for platform administrators.
              </p>

            </div>

            <span className="rounded-full bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300">
              {settings.mfaRequired ? "Required" : "Optional"}
            </span>

          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-5">

            <div>

              <h3 className="font-semibold text-white">
                Tenant Registration
              </h3>

              <p className="text-sm text-slate-400">
                Allow new organizations to register.
              </p>

            </div>

            <span className="rounded-full bg-blue-900/40 px-4 py-2 text-sm font-semibold text-blue-300">
              {settings.tenantRegistration ? "Enabled" : "Disabled"}
            </span>

          </div>

        </div>

      </section>      {/* ===========================================
          PLATFORM CONTROLS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Platform Controls
        </h2>

        <p className="mt-2 text-slate-400">
          Control the operational state of the Ziya Financial
          Operating System.
        </p>

        <div className="mt-8 space-y-5">

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-5">

            <div>

              <h3 className="font-semibold text-white">
                Platform Environment
              </h3>

              <p className="text-sm text-slate-400">
                Current deployment environment.
              </p>

            </div>

            <span className="rounded-full bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300">
              {settings.environment}
            </span>

          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-5">

            <div>

              <h3 className="font-semibold text-white">
                Maintenance Mode
              </h3>

              <p className="text-sm text-slate-400">
                Restrict access while system maintenance is
                being performed.
              </p>

            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                settings.maintenanceMode
                  ? "bg-red-900/40 text-red-300"
                  : "bg-emerald-900/40 text-emerald-300"
              }`}
            >
              {settings.maintenanceMode ? "Enabled" : "Disabled"}
            </span>

          </div>

        </div>

      </section>

      {/* ===========================================
          PLATFORM ACTIONS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Platform Actions
        </h2>

        <p className="mt-2 text-slate-400">
          Administrative actions affecting the entire platform.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">

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
            Refresh Platform Cache
          </button>

          <button className="rounded-xl bg-orange-600 px-6 py-4 font-semibold text-white transition hover:bg-orange-500">
            Restart Background Jobs
          </button>

          <button className="rounded-xl bg-cyan-600 px-6 py-4 font-semibold text-white transition hover:bg-cyan-500">
            Export Configuration
          </button>

        </div>

      </section>      {/* ===========================================
          DANGER ZONE
      =========================================== */}

      <section className="rounded-2xl border border-red-700 bg-red-950/30 p-8">

        <h2 className="text-2xl font-semibold text-red-400">
          Danger Zone
        </h2>

        <p className="mt-2 text-red-200">
          These actions affect the entire platform and should
          only be performed by authorized Super Administrators.
        </p>

        <div className="mt-8 space-y-5">

          <div className="flex flex-col gap-4 rounded-xl border border-red-800 bg-red-950/40 p-6 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h3 className="text-lg font-semibold text-white">
                Clear Platform Cache
              </h3>

              <p className="mt-1 text-sm text-slate-300">
                Removes cached data and forces the application
                to rebuild cached resources.
              </p>

            </div>

            <button className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition hover:bg-orange-500">
              Clear Cache
            </button>

          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-red-800 bg-red-950/40 p-6 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h3 className="text-lg font-semibold text-white">
                Restart Platform Services
              </h3>

              <p className="mt-1 text-sm text-slate-300">
                Restart background services and scheduled jobs.
              </p>

            </div>

            <button className="rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-500">
              Restart Services
            </button>

          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-red-800 bg-red-950/40 p-6 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h3 className="text-lg font-semibold text-white">
                Reset Platform Configuration
              </h3>

              <p className="mt-1 text-sm text-slate-300">
                Restore all platform configuration settings to
                their default values.
              </p>

            </div>

            <button className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-500">
              Reset Configuration
            </button>

          </div>

        </div>

      </section>

      {/* ===========================================
          SAVE ACTIONS
      =========================================== */}

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