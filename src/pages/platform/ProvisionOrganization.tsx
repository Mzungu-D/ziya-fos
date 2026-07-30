import { useState } from "react";
import { ArrowLeft, Building2, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OrganizationForm {
  organizationName: string;
  legalName: string;
  registrationNumber: string;
  taxPin: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  description: string;
}

export default function ProvisionOrganization() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<OrganizationForm>({
    organizationName: "",
    legalName: "",
    registrationNumber: "",
    taxPin: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    description: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log(formData);

    alert("Organization information saved successfully.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}

      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <h1 className="text-3xl font-bold text-white">
            Provision Organization
          </h1>

          <p className="mt-2 text-slate-400">
            Register a new organization into the Ziya Financial Operating
            System.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8"
      >
        {/* Organization Information */}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Building2 className="text-amber-400" />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-white">
                Organization Information
              </h2>

              <p className="text-sm text-slate-400">
                Enter the basic organization details.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Organization Name
              </label>

              <input
                type="text"
                name="organizationName"
                value={formData.organizationName}
                onChange={handleChange}
                placeholder="Organization Name"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Legal Name
              </label>

              <input
                type="text"
                name="legalName"
                value={formData.legalName}
                onChange={handleChange}
                placeholder="Legal Name"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Registration Number
              </label>

              <input
                type="text"
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={handleChange}
                placeholder="Registration Number"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Tax PIN
              </label>

              <input
                type="text"
                name="taxPin"
                value={formData.taxPin}
                onChange={handleChange}
                placeholder="Tax PIN"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Email Address
              </label>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Phone Number
              </label>

              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Phone Number"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Website
              </label>

              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Industry
              </label>

              <select
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              >
                <option value="">Select Industry</option>
                <option>Financial Services</option>
                <option>Microfinance</option>
                <option>SACCO</option>
                <option>Insurance</option>
                <option>Retail</option>
                <option>Healthcare</option>
                <option>Education</option>
                <option>Government</option>
                <option>NGO</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Description
              </label>

              <textarea
                rows={4}
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black transition hover:bg-amber-400"
          >
            <Save size={18} />
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
{/* Administrator Information */}

<div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

  <h2 className="mb-6 text-xl font-semibold text-white">
    Administrator Information
  </h2>

  <div className="grid gap-6 md:grid-cols-2">

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        First Name
      </label>

      <input
        type="text"
        placeholder="John"
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        Last Name
      </label>

      <input
        type="text"
        placeholder="Doe"
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        Email Address
      </label>

      <input
        type="email"
        placeholder="admin@company.com"
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        Phone Number
      </label>

      <input
        type="text"
        placeholder="+254..."
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-500"
      />
    </div>

  </div>

</div>

{/* Subscription */}

<div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

  <h2 className="mb-6 text-xl font-semibold text-white">
    Subscription Plan
  </h2>

  <div className="grid gap-6 md:grid-cols-3">

    <div>
      <label className="mb-2 block text-sm text-slate-300">
        Plan
      </label>

      <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">
        <option>Starter</option>
        <option>Professional</option>
        <option>Enterprise</option>
      </select>
    </div>

    <div>
      <label className="mb-2 block text-sm text-slate-300">
        Billing Cycle
      </label>

      <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">
        <option>Monthly</option>
        <option>Quarterly</option>
        <option>Yearly</option>
      </select>
    </div>

    <div>
      <label className="mb-2 block text-sm text-slate-300">
        Maximum Users
      </label>

      <input
        type="number"
        defaultValue={50}
        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
      />
    </div>

  </div>

</div>

{/* Localization */}

<div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

  <h2 className="mb-6 text-xl font-semibold text-white">
    Localization
  </h2>

  <div className="grid gap-6 md:grid-cols-2">

    <div>
      <label className="mb-2 block text-sm text-slate-300">
        Country
      </label>

      <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">
        <option>Kenya</option>
        <option>Uganda</option>
        <option>Tanzania</option>
        <option>Rwanda</option>
      </select>
    </div>

    <div>
      <label className="mb-2 block text-sm text-slate-300">
        Currency
      </label>

      <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">
        <option>KES</option>
        <option>UGX</option>
        <option>TZS</option>
        <option>USD</option>
      </select>
    </div>

  </div>

</div>

{/* Modules */}

<div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

  <h2 className="mb-6 text-xl font-semibold text-white">
    Enabled Modules
  </h2>

  <div className="grid gap-4 md:grid-cols-2">

    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" defaultChecked />
      General Ledger
    </label>

    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" defaultChecked />
      Accounts Payable
    </label>

    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" defaultChecked />
      Accounts Receivable
    </label>

    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" defaultChecked />
      Procurement
    </label>

    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" defaultChecked />
      HR Management
    </label>

    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" defaultChecked />
      Payroll
    </label>

    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" defaultChecked />
      Budgeting
    </label>

    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" defaultChecked />
      Analytics
    </label>

  </div>

</div>