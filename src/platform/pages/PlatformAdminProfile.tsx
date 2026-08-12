import { useState } from "react";
import {
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  User,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import zayi      from "../../assets/zayi.jpg";
import { getAuthToken } from "../../lib/auth";

function Section({ title, icon, children }: {
  title:    string;
  icon:     React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3 border-b border-[#F1F5F9] pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F0FF]">
          {icon}
        </div>
        <h2 className="text-base font-bold text-[#20243A]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-[#475569]">{label}</label>
      {children}
    </div>
  );
}

export default function PlatformAdminProfile() {
  const [showPw,   setShowPw]   = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [pwSaved,  setPwSaved]  = useState(false);
  const [pwError,  setPwError]  = useState("");

  const [profile, setProfile] = useState({
    name:  "Platform Admin",
    email: "admin@ziya.co.ke",
    phone: "+254 700 000 000",
    role:  "Super Administrator",
  });

  const [passwords, setPasswords] = useState({
    current: "",
    next:    "",
    confirm: "",
  });

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (passwords.next !== passwords.confirm) {
      setPwError("New passwords do not match.");
      return;
    }
    if (passwords.next.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/platform/admin/change-password", {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword:     passwords.next,
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { message?: string };
        setPwError(j.message ?? "Failed to change password.");
        return;
      }
      setPwSaved(true);
      setPasswords({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwSaved(false), 3000);
    } catch {
      setPwError("Network error — please try again.");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Manage your administrator account details and security settings."
      />

      {/* Identity card */}
      <div className="flex items-center gap-6 rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
        <div className="relative">
          <img src={zayi} alt="Platform Admin" className="h-20 w-20 rounded-2xl object-cover shadow-md" />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 ring-2 ring-white">
            <span className="h-2 w-2 rounded-full bg-white" />
          </span>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[#20243A]">{profile.name}</h2>
          <p className="mt-0.5 text-sm text-[#666B84]">{profile.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F0FF] px-3 py-1 text-xs font-semibold text-[#20243A]">
              <Shield size={11} /> {profile.role}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          {[
            { label: "Role",     value: "Super Admin" },
            { label: "Status",   value: "Active"      },
            { label: "Region",   value: "Kenya"       },
            { label: "Platform", value: "Ziya FOS"    },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[#ECECF3] px-4 py-3">
              <p className="text-xs text-[#94A3B8]">{label}</p>
              <p className="mt-0.5 text-sm font-semibold text-[#20243A]">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Profile Details */}
        <Section title="Account Details" icon={<User size={18} className="text-[#20243A]" />}>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Full Name">
              <input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
              />
            </Field>
            <Field label="Email Address">
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-10 pr-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                />
              </div>
            </Field>
            <Field label="Phone Number">
              <input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
              />
            </Field>
            <Field label="Role">
              <input
                value={profile.role}
                disabled
                className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F1F5F9] px-3 text-sm text-[#94A3B8] cursor-not-allowed"
              />
            </Field>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D9488] py-2.5 text-sm font-semibold text-white hover:bg-[#5A4BE8] disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> :
               saved  ? <CheckCircle size={15} className="text-green-300" /> :
                        <Save size={15} />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
            </button>
          </form>
        </Section>

        {/* Change Password */}
        <Section title="Change Password" icon={<KeyRound size={18} className="text-[#20243A]" />}>
          <form onSubmit={changePassword} className="space-y-4">
            {pwError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {pwError}
              </div>
            )}
            <Field label="Current Password">
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-10 pr-10 text-sm outline-none focus:border-[#0D9488]"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            <Field label="New Password">
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type={showNew ? "text" : "password"}
                  required
                  value={passwords.next}
                  onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-10 pr-10 text-sm outline-none focus:border-[#0D9488]"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            <Field label="Confirm New Password">
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type={showConf ? "text" : "password"}
                  required
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-10 pr-10 text-sm outline-none focus:border-[#0D9488]"
                />
                <button type="button" onClick={() => setShowConf((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]">
                  {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            {passwords.next.length > 0 && (
              <div className="space-y-1">
                {[
                  { ok: passwords.next.length >= 8,           label: "At least 8 characters" },
                  { ok: /[A-Z]/.test(passwords.next),         label: "One uppercase letter"  },
                  { ok: /[0-9]/.test(passwords.next),         label: "One number"            },
                  { ok: passwords.next === passwords.confirm && passwords.confirm.length > 0, label: "Passwords match" },
                ].map(({ ok, label }) => (
                  <div key={label} className={`flex items-center gap-2 text-xs ${ok ? "text-green-600" : "text-[#94A3B8]"}`}>
                    <CheckCircle size={11} className={ok ? "text-green-500" : "text-[#ECECF3]"} />
                    {label}
                  </div>
                ))}
              </div>
            )}
            <button
              type="submit"
              disabled={pwSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D9488] py-2.5 text-sm font-semibold text-white hover:bg-[#2D3350] disabled:opacity-50"
            >
              {pwSaving ? <Loader2 size={15} className="animate-spin" /> :
               pwSaved  ? <CheckCircle size={15} className="text-green-300" /> :
                          <KeyRound size={15} />}
              {pwSaving ? "Updating…" : pwSaved ? "Password Updated!" : "Update Password"}
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}

