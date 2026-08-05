import { useState } from "react";

export default function SecurityCenter() {
  const [security] = useState({
    securityScore: 96,
    activeSessions: 184,
    failedLogins: 9,
    blockedIPs: 4,
    lockedAccounts: 2,
    mfaEnabled: 97,
    passwordPolicy: "Strong",
    apiStatus: "Protected",
    firewall: "Active",
    encryption: "AES-256",
  });

  return (
    <div className="space-y-8">

      {/* ===========================================
          PAGE HEADER
      =========================================== */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-white">
            Security Center
          </h1>

          <p className="mt-2 text-slate-400">
            Monitor platform security, authentication,
            access control and threat protection across
            all organizations.
          </p>

        </div>

        <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black transition hover:bg-amber-400">
          Security Report
        </button>

      </div>

      {/* ===========================================
          SECURITY OVERVIEW
      =========================================== */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Security Score
          </p>

          <h2 className="mt-4 text-4xl font-bold text-emerald-400">
            {security.securityScore}%
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Active Sessions
          </p>

          <h2 className="mt-4 text-4xl font-bold text-white">
            {security.activeSessions}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Failed Logins
          </p>

          <h2 className="mt-4 text-4xl font-bold text-red-400">
            {security.failedLogins}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Blocked IPs
          </p>

          <h2 className="mt-4 text-4xl font-bold text-orange-400">
            {security.blockedIPs}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Locked Accounts
          </p>

          <h2 className="mt-4 text-4xl font-bold text-yellow-400">
            {security.lockedAccounts}
          </h2>

        </div>

      </div>      {/* ===========================================
          IDENTITY & ACCESS MANAGEMENT
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Identity & Access Management
        </h2>

        <p className="mt-2 text-slate-400">
          Authentication policies protecting the entire
          Ziya Financial Operating System.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">

          <div className="space-y-5">

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="font-semibold text-white">
                    Multi-Factor Authentication
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Platform administrators protected using MFA.
                  </p>

                </div>

                <span className="rounded-full bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300">
                  {security.mfaEnabled}%
                </span>

              </div>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="font-semibold text-white">
                    Password Policy
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Current password complexity policy.
                  </p>

                </div>

                <span className="rounded-full bg-blue-900/40 px-4 py-2 text-sm font-semibold text-blue-300">
                  {security.passwordPolicy}
                </span>

              </div>

            </div>

          </div>

          <div className="space-y-5">

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="font-semibold text-white">
                    API Protection
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    API authentication and request protection.
                  </p>

                </div>

                <span className="rounded-full bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300">
                  {security.apiStatus}
                </span>

              </div>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="font-semibold text-white">
                    Encryption
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Database and platform encryption standard.
                  </p>

                </div>

                <span className="rounded-full bg-purple-900/40 px-4 py-2 text-sm font-semibold text-purple-300">
                  {security.encryption}
                </span>

              </div>

            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="font-semibold text-white">
                    Firewall
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Platform perimeter protection.
                  </p>

                </div>

                <span className="rounded-full bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300">
                  {security.firewall}
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>      {/* ===========================================
          SECURITY EVENTS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Security Events
            </h2>

            <p className="mt-2 text-slate-400">
              Recent authentication and security activities
              across the platform.
            </p>

          </div>

          <button className="rounded-xl bg-slate-800 px-5 py-3 font-medium text-white transition hover:bg-slate-700">
            View Full Audit
          </button>

        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Time
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  User
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Event
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  IP Address
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Severity
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 text-slate-300">
                  09:15 AM
                </td>

                <td className="px-6 py-5 text-white">
                  Dennis Odhiambo
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Successful Super Admin Login
                </td>

                <td className="px-6 py-5 text-slate-300">
                  102.68.xxx.xxx
                </td>

                <td className="px-6 py-5 text-center">

                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                    Normal
                  </span>

                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 text-slate-300">
                  08:47 AM
                </td>

                <td className="px-6 py-5 text-white">
                  Grace Wanjiku
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Password Changed
                </td>

                <td className="px-6 py-5 text-slate-300">
                  41.89.xxx.xxx
                </td>

                <td className="px-6 py-5 text-center">

                  <span className="rounded-full bg-blue-900/40 px-3 py-1 text-sm font-semibold text-blue-300">
                    Info
                  </span>

                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 text-slate-300">
                  07:55 AM
                </td>

                <td className="px-6 py-5 text-white">
                  Unknown User
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Multiple Failed Login Attempts
                </td>

                <td className="px-6 py-5 text-slate-300">
                  197.248.xxx.xxx
                </td>

                <td className="px-6 py-5 text-center">

                  <span className="rounded-full bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-300">
                    Critical
                  </span>

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>

      {/* ===========================================
          THREAT PROTECTION
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Threat Protection
        </h2>

        <p className="mt-2 text-slate-400">
          Current protection mechanisms safeguarding the
          platform.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-xl bg-slate-950 p-6 border border-slate-800">

            <h3 className="font-semibold text-white">
              Intrusion Detection
            </h3>

            <p className="mt-4 text-emerald-400 font-semibold">
              Active
            </p>

          </div>

          <div className="rounded-xl bg-slate-950 p-6 border border-slate-800">

            <h3 className="font-semibold text-white">
              Malware Protection
            </h3>

            <p className="mt-4 text-emerald-400 font-semibold">
              Enabled
            </p>

          </div>

          <div className="rounded-xl bg-slate-950 p-6 border border-slate-800">

            <h3 className="font-semibold text-white">
              Rate Limiting
            </h3>

            <p className="mt-4 text-emerald-400 font-semibold">
              Enabled
            </p>

          </div>

          <div className="rounded-xl bg-slate-950 p-6 border border-slate-800">

            <h3 className="font-semibold text-white">
              DDoS Protection
            </h3>

            <p className="mt-4 text-emerald-400 font-semibold">
              Protected
            </p>

          </div>

        </div>

      </section>      {/* ===========================================
          ACTIVE SESSIONS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Active Platform Sessions
        </h2>

        <p className="mt-2 text-slate-400">
          Current authenticated sessions across the platform.
        </p>

        <div className="mt-8 space-y-4">

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-5">

            <div>

              <h3 className="font-semibold text-white">
                Super Administrator
              </h3>

              <p className="text-sm text-slate-400">
                Chrome • Windows • Nairobi
              </p>

            </div>

            <span className="rounded-full bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300">
              Active
            </span>

          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-5">

            <div>

              <h3 className="font-semibold text-white">
                Platform Administrator
              </h3>

              <p className="text-sm text-slate-400">
                Edge • Windows • Mombasa
              </p>

            </div>

            <button className="rounded-xl bg-red-600 px-5 py-2 font-semibold text-white transition hover:bg-red-500">
              Terminate Session
            </button>

          </div>

        </div>

      </section>

      {/* ===========================================
          BLOCKED IP ADDRESSES
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Blocked IP Addresses
        </h2>

        <p className="mt-2 text-slate-400">
          IP addresses currently denied access to the platform.
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  IP Address
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Reason
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Blocked On
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Action
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 text-white">
                  197.248.xxx.xxx
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Excessive failed login attempts
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Today
                </td>

                <td className="px-6 py-5 text-center">

                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500">
                    Unblock
                  </button>

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>

      {/* ===========================================
          SECURITY ACTIONS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <h2 className="text-2xl font-semibold text-white">
          Security Actions
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <button className="rounded-xl bg-blue-600 px-6 py-4 font-semibold text-white transition hover:bg-blue-500">
            Force Password Reset
          </button>

          <button className="rounded-xl bg-purple-600 px-6 py-4 font-semibold text-white transition hover:bg-purple-500">
            Rotate API Keys
          </button>

          <button className="rounded-xl bg-emerald-600 px-6 py-4 font-semibold text-white transition hover:bg-emerald-500">
            Run Security Scan
          </button>

          <button className="rounded-xl bg-orange-600 px-6 py-4 font-semibold text-white transition hover:bg-orange-500">
            Export Security Report
          </button>

        </div>

      </section>

      {/* ===========================================
          SECURITY RECOMMENDATIONS
      =========================================== */}

      <section className="rounded-2xl border border-amber-700 bg-amber-950/20 p-8">

        <h2 className="text-2xl font-semibold text-amber-400">
          Security Recommendations
        </h2>

        <ul className="mt-6 list-disc space-y-3 pl-6 text-slate-300">

          <li>
            Enable Multi-Factor Authentication for all privileged accounts.
          </li>

          <li>
            Review blocked IP addresses weekly.
          </li>

          <li>
            Rotate API credentials every 90 days.
          </li>

          <li>
            Schedule monthly penetration testing.
          </li>

          <li>
            Review platform audit logs daily.
          </li>

        </ul>

      </section>

    </div>
  );
}