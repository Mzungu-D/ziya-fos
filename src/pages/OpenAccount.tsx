import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Building2, Check,
  Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, User,
} from "lucide-react";

type ApplicationForm = {
  products:           string[];
  organizationName:   string;
  registrationNumber: string;
  country:            string;
  adminName:          string;
  email:              string;
  phone:              string;
  password:           string;
  confirmPassword:    string;
};

const products = [
  { id: "core-finance",          name: "Core Finance",           description: "Accounting, general ledger, journals, receivables, payables and financial reporting." },
  { id: "payments-banking",      name: "Payments & Banking",     description: "Banking, cash management, M-Pesa and digital payment operations." },
  { id: "business-operations",   name: "Business Operations",    description: "Procurement, HR, payroll, assets, vendors and operational finance." },
  { id: "financial-intelligence", name: "Financial Intelligence", description: "Analytics, forecasting, fraud detection and intelligent financial insights." },
];

export default function OpenAccount() {
  const [step,      setStep]      = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const [form, setForm] = useState<ApplicationForm>({
    products:           ["core-finance"],
    organizationName:   "",
    registrationNumber: "",
    country:            "Kenya",
    adminName:          "",
    email:              "",
    phone:              "",
    password:           "",
    confirmPassword:    "",
  });

  const toggleProduct = (id: string) => {
    setForm((c) => ({
      ...c,
      products: c.products.includes(id)
        ? c.products.filter((p) => p !== id)
        : [...c.products, id],
    }));
  };

  const nextStep = () => {
    setError("");
    if (step === 1 && form.products.length === 0) { setError("Select at least one Ziya product."); return; }
    if (step === 2 && !form.organizationName.trim()) { setError("Enter your organisation name."); return; }
    setStep((c) => Math.min(c + 1, 3));
  };

  const submitApplication = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!form.organizationName.trim() || !form.adminName.trim() ||
        !form.email.trim() || !form.phone.trim() ||
        !form.password || form.products.length === 0) {
      setError("Please complete all required fields.");
      return;
    }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName:     form.organizationName.trim(),
          ownerName:   form.adminName.trim(),
          email:       form.email.trim().toLowerCase(),
          password:    form.password,
          country:     form.country,
          phoneNumber: form.phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Registration failed. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Unable to connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081019] px-6 pt-24 text-[#20243A]">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10">
            <Check size={30} className="text-emerald-400" />
          </div>
          <h1 className="mt-7 text-4xl font-semibold tracking-tight">Application received.</h1>
          <p className="mt-5 leading-7 text-white/60">
            Your organisation application has been received. Ziya will verify
            the application before provisioning your financial workspace.
          </p>
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left">
            <Detail label="Organisation" value={form.organizationName} />
            <Detail label="Administrator" value={form.adminName} />
            <Detail label="Email"        value={form.email} />
            <Detail label="Phone"        value={form.phone} />
            <div className="mt-5">
              <p className="text-sm text-white/40">Status</p>
              <p className="mt-1 font-semibold text-amber-300">Pending verification &amp; Ziya approval</p>
            </div>
          </div>
          <Link to="/" className="mt-8 inline-flex rounded-full bg-white px-7 py-4 font-semibold text-[#081019]">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081019] px-6 pb-20 pt-36 text-[#20243A]">
      <div className="mx-auto max-w-3xl">

        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e5b83b]">Open account</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Build your Ziya workspace.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-white/55">
          Each approved organisation receives its own secure financial workspace,
          users, roles, permissions and organisation-specific data.
        </p>

        <div className="mt-10 flex gap-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? "bg-white" : "bg-white/10"}`} />
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submitApplication} className="mt-6 rounded-[32px] border border-white/10 bg-white/[0.035] p-7 md:p-10">

          {step === 1 && (
            <>
              <p className="text-sm text-white/40">Step 1 of 3</p>
              <h2 className="mt-2 text-2xl font-semibold">Select your products</h2>
              <p className="mt-2 text-white/50">Choose the capabilities your organisation needs.</p>
              <div className="mt-7 space-y-4">
                {products.map((product) => {
                  const selected = form.products.includes(product.id);
                  return (
                    <button key={product.id} type="button" onClick={() => toggleProduct(product.id)}
                      className={`w-full rounded-2xl border p-5 text-left transition ${selected ? "border-[#e5b83b] bg-[#e5b83b]/10" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"}`}>
                      <div className="flex items-start justify-between gap-5">
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="mt-2 text-sm leading-6 text-white/50">{product.description}</p>
                        </div>
                        {selected && <Check size={20} className="shrink-0 text-[#e5b83b]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-white/40">Step 2 of 3</p>
              <div className="mt-2 flex items-center gap-3">
                <Building2 className="text-[#e5b83b]" />
                <h2 className="text-2xl font-semibold">Organisation details</h2>
              </div>
              <p className="mt-3 text-white/50">This information identifies the tenant that Ziya will provision after approval.</p>
              <div className="mt-7 space-y-5">
                <Field label="Organisation name"    value={form.organizationName}   onChange={(v) => setForm({ ...form, organizationName: v })}   placeholder="Organisation or business name"       required />
                <Field label="Registration number"  value={form.registrationNumber} onChange={(v) => setForm({ ...form, registrationNumber: v })} placeholder="Company registration number (optional)" />
                <Field label="Country"              value={form.country}            onChange={(v) => setForm({ ...form, country: v })}            placeholder="Country"                             required />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-white/40">Step 3 of 3</p>
              <div className="mt-2 flex items-center gap-3">
                <User className="text-[#e5b83b]" />
                <h2 className="text-2xl font-semibold">Organisation administrator</h2>
              </div>
              <p className="mt-3 text-white/50">After approval, this person becomes the organisation's initial administrator.</p>
              <div className="mt-7 space-y-5">
                <Field label="Full name"    value={form.adminName} onChange={(v) => setForm({ ...form, adminName: v })} placeholder="Administrator full name"  icon={<User size={18} />} required />
                <Field label="Work email"   value={form.email}     onChange={(v) => setForm({ ...form, email: v })}     placeholder="name@company.com"         type="email" icon={<Mail size={18} />} required />
                <Field label="Phone number" value={form.phone}     onChange={(v) => setForm({ ...form, phone: v })}     placeholder="+254..."                  type="tel"   icon={<Phone size={18} />} required />
                <PasswordField label="Password"         value={form.password}        onChange={(v) => setForm({ ...form, password: v })}        placeholder="At least 8 characters" />
                <PasswordField label="Confirm password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} placeholder="Repeat your password" />
                <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <ShieldCheck size={21} className="shrink-0 text-[#e5b83b]" />
                  <p className="text-sm leading-6 text-white/50">
                    Your account will be activated once Ziya reviews and approves your organisation.
                    You can then log in with your email and password.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="mt-9 flex items-center justify-between">
            {step > 1 ? (
              <button type="button" onClick={() => { setError(""); setStep((c) => c - 1); }}
                className="inline-flex items-center gap-2 text-white/60 transition hover:text-[#20243A]">
                <ArrowLeft size={18} /> Back
              </button>
            ) : <div />}

            {step < 3 ? (
              <button type="button" onClick={nextStep}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-[#081019]">
                Continue <ArrowRight size={18} />
              </button>
            ) : (
              <button type="submit" disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-[#081019] disabled:opacity-60">
                {loading ? "Submitting…" : "Submit application"}{!loading && <ArrowRight size={18} />}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required = false, icon }: {
  label: string; value: string; onChange: (value: string) => void;
  placeholder: string; type?: string; required?: boolean; icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/75">
        {label}{required && <span className="text-[#e5b83b]"> *</span>}
      </span>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-white/30">
        {icon && <span className="text-white/40">{icon}</span>}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="h-14 w-full bg-transparent text-[#20243A] outline-none placeholder:text-white/25" />
      </div>
    </label>
  );
}

function PasswordField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/75">
        {label} <span className="text-[#e5b83b]">*</span>
      </span>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-white/30">
        <span className="text-white/40"><Lock size={18} /></span>
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required
          className="h-14 w-full bg-transparent text-[#20243A] outline-none placeholder:text-white/25" />
        <button type="button" onClick={() => setShow((s) => !s)} className="text-white/30 hover:text-white/60">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="text-sm text-white/40">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}