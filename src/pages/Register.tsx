import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/* ─── types ──────────────────────────────────────────────── */

interface FormState {
  orgName:     string;
  ownerName:   string;
  email:       string;
  password:    string;
  confirm:     string;
  country:     string;
  currency:    string;
  phoneNumber: string;
}

const INITIAL: FormState = {
  orgName:     "",
  ownerName:   "",
  email:       "",
  password:    "",
  confirm:     "",
  country:     "Kenya",
  currency:    "KES",
  phoneNumber: "",
};

const COUNTRIES = [
  "Kenya", "Uganda", "Tanzania", "Rwanda", "Ethiopia",
  "Ghana", "Nigeria", "South Africa", "Other",
];

const CURRENCIES: Record<string, string> = {
  Kenya:        "KES",
  Uganda:       "UGX",
  Tanzania:     "TZS",
  Rwanda:       "RWF",
  Ethiopia:     "ETB",
  Ghana:        "GHS",
  Nigeria:      "NGN",
  "South Africa": "ZAR",
  Other:        "USD",
};

/* ─── component ──────────────────────────────────────────── */

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm]       = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "country") next.currency = CURRENCIES[value] ?? "USD";
      return next;
    });
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orgName:     form.orgName.trim(),
          ownerName:   form.ownerName.trim(),
          email:       form.email.trim().toLowerCase(),
          password:    form.password,
          country:     form.country,
          currency:    form.currency,
          phoneNumber: form.phoneNumber.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message ?? "Registration failed. Please try again.");
        return;
      }

      setDone(true);
    } catch {
      setError("Unable to connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Success screen ─────────────────────────────────────── */

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F8FC] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#ECECF3] bg-white p-10 text-center shadow-sm">
          {/* tick icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#22C55E]/10">
            <svg className="h-8 w-8 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#20243A]">Registration Submitted</h1>
          <p className="mt-3 text-sm text-[#666B84] leading-relaxed">
            Your organisation has been registered successfully. Our team will review your
            account and activate it within <strong>1 business day</strong>.
          </p>
          <p className="mt-2 text-sm text-[#666B84]">
            You'll be able to log in once your account is approved.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="mt-8 w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-semibold text-[#20243A] hover:bg-[#b8972e] transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  /* ── Registration form ──────────────────────────────────── */

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F8FC] px-4 py-12">
      <div className="w-full max-w-lg">

        {/* logo / brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#20243A]">
            <span className="text-lg font-bold text-[#D4AF37]">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-[#20243A]">Create your Ziya FOS account</h1>
          <p className="mt-1 text-sm text-[#666B84]">
            Set up your organisation and start managing your finances.
          </p>
        </div>

        {/* card */}
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-8 shadow-sm">

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* ── Organisation ── */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                Organisation Details
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#20243A]">
                    Organisation Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="orgName"
                    type="text"
                    required
                    value={form.orgName}
                    onChange={handleChange}
                    placeholder="Acme Ltd"
                    className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F8FC] px-4 py-3 text-sm text-[#20243A] placeholder-[#C7CCD9] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#20243A]">Country</label>
                    <select
                      name="country"
                      value={form.country}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F8FC] px-4 py-3 text-sm text-[#20243A] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#20243A]">Currency</label>
                    <input
                      name="currency"
                      type="text"
                      value={form.currency}
                      onChange={handleChange}
                      placeholder="KES"
                      maxLength={5}
                      className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F8FC] px-4 py-3 text-sm text-[#20243A] placeholder-[#C7CCD9] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* divider */}
            <div className="border-t border-[#ECECF3]" />

            {/* ── Owner / Account ── */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                Your Account
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#20243A]">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="ownerName"
                    type="text"
                    required
                    value={form.ownerName}
                    onChange={handleChange}
                    placeholder="Jane Wanjiru"
                    className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F8FC] px-4 py-3 text-sm text-[#20243A] placeholder-[#C7CCD9] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#20243A]">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="jane@acme.co.ke"
                    className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F8FC] px-4 py-3 text-sm text-[#20243A] placeholder-[#C7CCD9] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#20243A]">
                    Phone Number <span className="text-[#94A3B8] font-normal">(optional)</span>
                  </label>
                  <input
                    name="phoneNumber"
                    type="tel"
                    value={form.phoneNumber}
                    onChange={handleChange}
                    placeholder="+254 700 000 000"
                    className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F8FC] px-4 py-3 text-sm text-[#20243A] placeholder-[#C7CCD9] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#20243A]">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="password"
                    type="password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F8FC] px-4 py-3 text-sm text-[#20243A] placeholder-[#C7CCD9] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#20243A]">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="confirm"
                    type="password"
                    required
                    value={form.confirm}
                    onChange={handleChange}
                    placeholder="Repeat your password"
                    className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F8FC] px-4 py-3 text-sm text-[#20243A] placeholder-[#C7CCD9] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  />
                </div>
              </div>
            </div>

            {/* submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#D4AF37] py-3.5 text-sm font-semibold text-[#20243A] hover:bg-[#b8972e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>

          </form>

          <p className="mt-5 text-center text-xs text-[#94A3B8]">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[#D4AF37] hover:underline">
              Sign in
            </Link>
          </p>

        </div>

        <p className="mt-6 text-center text-xs text-[#C7CCD9]">
          Accounts are reviewed and activated within 1 business day.
        </p>
      </div>
    </div>
  );
}