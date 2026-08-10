import { useEffect, useState } from "react";
import {
  Bell, CheckCircle, Database, Globe,
  KeyRound, Loader2, Lock, Save,
  Server, Settings, Shield, XCircle,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import { getPlatformOverview, loadLocalSettings, saveLocalSettings } from "../../services/platformSettings";
import type { PlatformOverview, LocalSettings } from "../../services/platformSettings";

/* ─── helpers ────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ─── section wrapper ────────────────────────────────────── */

function Section({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
      <div className={`mb-6 flex items-center gap-3 pb-4 border-b border-[#F1F5F9]`}>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
          {icon}
        </div>
        <h2 className="text-base font-bold text-[#20243A]">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/* ─── field components ───────────────────────────────────── */

const INP = "h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#20243A] outline-none focus:border-[#D4AF37] focus:bg-white transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#475569]">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[#20243A]">{label}</p>
        {description && <p className="text-xs text-[#94A3B8]">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#D4AF37]" : "bg-[#E2E8F0]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-3">
      <p className="text-sm text-[#666B84]">{label}</p>
      <div className="text-right">
        <p className="text-sm font-bold text-[#20243A]">{value}</p>
        {sub && <p className="text-xs text-[#94A3B8]">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────── */

export default function PlatformSettings() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [settings, setSettings] = useState<LocalSettings>(loadLocalSettings());
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    getPlatformOverview()
      .then((res) => setOverview(res.overview))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof LocalSettings>(k: K, v: LocalSettings[K]) {
    setSettings((s) => ({ ...s, [k]: v }));
  }

  function save() {
    saveLocalSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const TIMEZONES = [
    "Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg",
    "Africa/Cairo", "Europe/London", "UTC",
  ];
  const CURRENCIES = ["KES", "USD", "EUR", "GBP", "UGX", "TZS", "ZAR"];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Settings"
        subtitle="Configure global settings for the Ziya Financial Operating System."
      />

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between rounded-2xl border border-[#ECECF3] bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-[#94A3B8]" />
          <p className="text-sm text-[#666B84]">Settings are stored locally in this browser session.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle size={14} /> Saved
            </div>
          )}
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B8962E]"
          >
            <Save size={14} /> Save Changes
          </button>
        </div>
      </div>

      {/* ── Platform Overview (live) ── */}
      <Section icon={<Server size={16} className="text-white" />} title="Platform Overview" color="bg-[#D4AF37]">
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[#D4AF37]" />
          </div>
        ) : overview ? (
          <div className="grid grid-cols-2 gap-3">
            <StatRow label="Organizations"   value={overview.organizations.total} sub={`${overview.organizations.active} active · ${overview.organizations.pending} pending`} />
            <StatRow label="Users"           value={overview.users.total}         sub={`${overview.users.active} active`} />
            <StatRow label="Subscriptions"   value={overview.subscriptions.total} sub={`${overview.subscriptions.active} active`} />
            <StatRow label="Audit Events"    value={overview.auditLogs.toLocaleString()} />
            <StatRow label="Environment"     value={overview.environment.toUpperCase()} />
            <StatRow label="Database"        value={overview.dbConnected ? "Connected" : "Disconnected"} sub="PostgreSQL · Railway" />
            <StatRow label="Server Time"     value={fmtTime(overview.serverTime)} />
            {overview.latestOrg && (
              <StatRow label="Latest Org"    value={overview.latestOrg.name} sub={fmtDate(overview.latestOrg.createdAt)} />
            )}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center gap-2 text-sm text-red-500">
            <XCircle size={16} /> Could not load overview
          </div>
        )}
      </Section>

      {/* ── Settings grid ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* General */}
        <Section icon={<Globe size={16} className="text-white" />} title="General" color="bg-blue-500">
          <Field label="Platform Name">
            <input value={settings.platformName} onChange={(e) => set("platformName", e.target.value)} className={INP} />
          </Field>
          <Field label="Platform URL">
            <input value={settings.platformUrl} onChange={(e) => set("platformUrl", e.target.value)} className={INP} />
          </Field>
          <Field label="Timezone">
            <select value={settings.timezone} onChange={(e) => set("timezone", e.target.value)} className={INP}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Default Currency">
            <select value={settings.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value)} className={INP}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Toggle
            label="Maintenance Mode"
            description="Blocks all organization logins"
            checked={settings.maintenanceMode}
            onChange={(v) => set("maintenanceMode", v)}
          />
        </Section>

        {/* Security */}
        <Section icon={<Shield size={16} className="text-white" />} title="Security" color="bg-amber-500">
          <Field label="Max Login Attempts">
            <input
              type="number" min={1} max={20}
              value={settings.maxLoginAttempts}
              onChange={(e) => set("maxLoginAttempts", parseInt(e.target.value) || 5)}
              className={INP}
            />
          </Field>
          <Field label="Session Timeout (minutes)">
            <input
              type="number" min={5} max={1440}
              value={settings.sessionTimeoutMin}
              onChange={(e) => set("sessionTimeoutMin", parseInt(e.target.value) || 60)}
              className={INP}
            />
          </Field>
          <Field label="Account Lockout Duration (minutes)">
            <input
              type="number" min={1} max={1440}
              value={settings.lockoutMin}
              onChange={(e) => set("lockoutMin", parseInt(e.target.value) || 15)}
              className={INP}
            />
          </Field>
          <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-3 flex items-center gap-3">
            <Lock size={14} className="text-[#94A3B8]" />
            <p className="text-xs text-[#666B84]">
              Two-factor authentication and password policies are enforced at the system level via environment configuration.
            </p>
          </div>
          <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-3 flex items-center gap-3">
            <KeyRound size={14} className="text-[#94A3B8]" />
            <p className="text-xs text-[#666B84]">
              SMTP credentials and API keys are managed via Railway environment variables.
            </p>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={<Bell size={16} className="text-white" />} title="Notifications" color="bg-purple-500">
          <Toggle
            label="Email Notifications"
            description="Send system emails for key events"
            checked={settings.emailNotifications}
            onChange={(v) => set("emailNotifications", v)}
          />
          <Toggle
            label="New Organization Alerts"
            description="Alert when a new org is provisioned"
            checked={settings.newOrgAlerts}
            onChange={(v) => set("newOrgAlerts", v)}
          />
          <Toggle
            label="Subscription Alerts"
            description="Alert on subscription changes"
            checked={settings.subscriptionAlerts}
            onChange={(v) => set("subscriptionAlerts", v)}
          />
          <Field label="Audit Log Retention (days)">
            <input
              type="number" min={30} max={3650}
              value={settings.auditRetentionDays}
              onChange={(e) => set("auditRetentionDays", parseInt(e.target.value) || 365)}
              className={INP}
            />
          </Field>
        </Section>

        {/* Database */}
        <Section icon={<Database size={16} className="text-white" />} title="Database & Infrastructure" color="bg-green-600">
          {overview ? (
            <div className="space-y-3">
              <StatRow label="Provider"    value="PostgreSQL" />
              <StatRow label="Host"        value="Railway (centerbeam proxy)" />
              <StatRow label="Status"      value={overview.dbConnected ? "✓ Connected" : "✗ Disconnected"} />
              <StatRow label="Total Orgs"  value={overview.organizations.total} />
              <StatRow label="Total Users" value={overview.users.total} />
              <StatRow label="Audit Logs"  value={overview.auditLogs.toLocaleString()} />
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center">
              <Loader2 size={18} className="animate-spin text-[#D4AF37]" />
            </div>
          )}
          <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-3 flex items-center gap-3 mt-2">
            <Server size={14} className="text-[#94A3B8]" />
            <p className="text-xs text-[#666B84]">
              Database connection strings and migration commands are managed via Railway and Prisma CLI.
            </p>
          </div>
        </Section>

      </div>
    </div>
  );
}