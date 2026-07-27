import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";

type ApplicationForm = {
  products: string[];
  organizationName: string;
  registrationNumber: string;
  country: string;
  adminName: string;
  email: string;
  phone: string;
};

const products = [
  {
    id: "core-finance",
    name: "Core Finance",
    description:
      "Accounting, general ledger, journals, receivables, payables and financial reporting.",
  },
  {
    id: "payments-banking",
    name: "Payments & Banking",
    description:
      "Banking, cash management, M-Pesa and digital payment operations.",
  },
  {
    id: "business-operations",
    name: "Business Operations",
    description:
      "Procurement, HR, payroll, assets, vendors and operational finance.",
  },
  {
    id: "financial-intelligence",
    name: "Financial Intelligence",
    description:
      "Analytics, forecasting, fraud detection and intelligent financial insights.",
  },
];

export default function OpenAccount() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<ApplicationForm>({
    products: ["core-finance"],
    organizationName: "",
    registrationNumber: "",
    country: "Kenya",
    adminName: "",
    email: "",
    phone: "",
  });

  const toggleProduct = (id: string) => {
    setForm((current) => ({
      ...current,
      products: current.products.includes(id)
        ? current.products.filter((product) => product !== id)
        : [...current.products, id],
    }));
  };

  const nextStep = () => {
    if (step === 1 && form.products.length === 0) {
      alert("Select at least one Ziya product.");
      return;
    }

    if (step === 2 && !form.organizationName.trim()) {
      alert("Enter your organization name.");
      return;
    }

    setStep((current) => Math.min(current + 1, 3));
  };

  const submitApplication = (event: FormEvent) => {
    event.preventDefault();

    if (
      !form.organizationName.trim() ||
      !form.adminName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      form.products.length === 0
    ) {
      alert("Please complete all required fields.");
      return;
    }

    /*
      MULTI-TENANCY PROVISIONING FLOW

      1. Create OrganizationApplication
      2. Verify applicant email
      3. Verify applicant phone
      4. Application remains PENDING
      5. Ziya administrator reviews application
      6. Backend creates Organization after approval
      7. Backend creates initial OrganizationMember
      8. Assign OWNER / ADMIN role
      9. Assign selected product entitlements
      10. Activate isolated organization workspace

      Active tenants must be provisioned by the backend,
      not directly by the browser.
    */

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081019] px-6 pt-24 text-white">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10">
            <Check size={30} className="text-emerald-400" />
          </div>

          <h1 className="mt-7 text-4xl font-semibold tracking-tight">
            Application received.
          </h1>

          <p className="mt-5 leading-7 text-white/60">
            Your organization application has been received. Ziya will verify
            the application before provisioning your financial workspace.
          </p>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left">
            <Detail
              label="Organization"
              value={form.organizationName}
            />

            <Detail
              label="Administrator"
              value={form.adminName}
            />

            <Detail
              label="Email"
              value={form.email}
            />

            <Detail
              label="Phone"
              value={form.phone}
            />

            <div className="mt-5">
              <p className="text-sm text-white/40">
                Status
              </p>

              <p className="mt-1 font-semibold text-amber-300">
                Pending verification & Ziya approval
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="mt-8 inline-flex rounded-full bg-white px-7 py-4 font-semibold text-[#081019]"
          >
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081019] px-6 pb-20 pt-36 text-white">
      <div className="mx-auto max-w-3xl">

        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e5b83b]">
          Open account
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
          Build your Ziya workspace.
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-white/55">
          Each approved organization receives its own secure financial
          workspace, users, roles, permissions and organization-specific data.
        </p>

        {/* Progress */}
        <div className="mt-10 flex gap-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={`h-1.5 flex-1 rounded-full ${
                item <= step
                  ? "bg-white"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <form
          onSubmit={submitApplication}
          className="mt-10 rounded-[32px] border border-white/10 bg-white/[0.035] p-7 md:p-10"
        >

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <p className="text-sm text-white/40">
                Step 1 of 3
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Select your products
              </h2>

              <p className="mt-2 text-white/50">
                Choose the capabilities your organization needs.
              </p>

              <div className="mt-7 space-y-4">
                {products.map((product) => {
                  const selected =
                    form.products.includes(product.id);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        toggleProduct(product.id)
                      }
                      className={`w-full rounded-2xl border p-5 text-left transition ${
                        selected
                          ? "border-[#e5b83b] bg-[#e5b83b]/10"
                          : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-5">
                        <div>
                          <h3 className="font-semibold">
                            {product.name}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-white/50">
                            {product.description}
                          </p>
                        </div>

                        {selected && (
                          <Check
                            size={20}
                            className="shrink-0 text-[#e5b83b]"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <p className="text-sm text-white/40">
                Step 2 of 3
              </p>

              <div className="mt-2 flex items-center gap-3">
                <Building2 className="text-[#e5b83b]" />

                <h2 className="text-2xl font-semibold">
                  Organization details
                </h2>
              </div>

              <p className="mt-3 text-white/50">
                This information identifies the tenant that Ziya will
                provision after approval.
              </p>

              <div className="mt-7 space-y-5">
                <Field
                  label="Organization name"
                  value={form.organizationName}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      organizationName: value,
                    })
                  }
                  placeholder="Organization or business name"
                  required
                />

                <Field
                  label="Registration number"
                  value={form.registrationNumber}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      registrationNumber: value,
                    })
                  }
                  placeholder="Company registration number"
                />

                <Field
                  label="Country"
                  value={form.country}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      country: value,
                    })
                  }
                  placeholder="Country"
                  required
                />
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <p className="text-sm text-white/40">
                Step 3 of 3
              </p>

              <div className="mt-2 flex items-center gap-3">
                <User className="text-[#e5b83b]" />

                <h2 className="text-2xl font-semibold">
                  Organization administrator
                </h2>
              </div>

              <p className="mt-3 text-white/50">
                After approval, this person becomes the organization's
                initial administrator.
              </p>

              <div className="mt-7 space-y-5">
                <Field
                  label="Full name"
                  value={form.adminName}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      adminName: value,
                    })
                  }
                  placeholder="Administrator full name"
                  icon={<User size={18} />}
                  required
                />

                <Field
                  label="Work email"
                  value={form.email}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      email: value,
                    })
                  }
                  placeholder="name@company.com"
                  type="email"
                  icon={<Mail size={18} />}
                  required
                />

                <Field
                  label="Phone number"
                  value={form.phone}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      phone: value,
                    })
                  }
                  placeholder="+254..."
                  type="tel"
                  icon={<Phone size={18} />}
                  required
                />

                <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <ShieldCheck
                    size={21}
                    className="shrink-0 text-[#e5b83b]"
                  />

                  <p className="text-sm leading-6 text-white/50">
                    Email and phone ownership must be verified before
                    Ziya can approve and activate the organization.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="mt-9 flex items-center justify-between">

            {step > 1 ? (
              <button
                type="button"
                onClick={() =>
                  setStep((current) => current - 1)
                }
                className="inline-flex items-center gap-2 text-white/60 transition hover:text-white"
              >
                <ArrowLeft size={18} />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-[#081019]"
              >
                Continue
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-[#081019]"
              >
                Submit application
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/75">
        {label}

        {required && (
          <span className="text-[#e5b83b]">
            {" "}*
          </span>
        )}
      </span>

      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 focus-within:border-white/30">

        {icon && (
          <span className="text-white/40">
            {icon}
          </span>
        )}

        <input
          type={type}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          required={required}
          className="h-14 w-full bg-transparent text-white outline-none placeholder:text-white/25"
        />
      </div>
    </label>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="text-sm text-white/40">
        {label}
      </p>

      <p className="mt-1 font-semibold">
        {value}
      </p>
    </div>
  );
}