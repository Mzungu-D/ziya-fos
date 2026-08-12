import { useState } from "react";
import { X } from "lucide-react";

import { createOrganization } from "../../services/platformOrganizations";

interface CreateOrganizationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateOrganizationModal({
  open,
  onClose,
  onCreated,
}: CreateOrganizationModalProps) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    legalName: "",
    registrationNumber: "",
    taxNumber: "",
    email: "",
    phoneNumber: "",
    address: "",
    country: "Kenya",
    currency: "KES",

    ownerName: "",
    ownerEmail: "",
    ownerPhoneNumber: "",
    ownerPassword: "",
  });

  if (!open) {
    return null;
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  };

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    try {
      setLoading(true);

      await createOrganization(form);

      onCreated();

      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to create organization.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">

                {/* Header */}

        <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">

          <div>
            <h2 className="text-xl font-bold text-[#20243A]">
              Create Organization
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              Provision a new tenant organization.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition hover:bg-gray-100"
          >
            <X size={20} />
          </button>

        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 p-6"
        >

          <div className="grid grid-cols-2 gap-4">

            <input
              type="text"
              name="name"
              placeholder="Organization Name"
              value={form.name}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
              required
            />

            <input
              type="text"
              name="slug"
              placeholder="Slug"
              value={form.slug}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
              required
            />

            <input
              type="text"
              name="legalName"
              placeholder="Legal Name"
              value={form.legalName}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
            />

            <input
              type="text"
              name="registrationNumber"
              placeholder="Registration Number"
              value={form.registrationNumber}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
            />

            <input
              type="text"
              name="taxNumber"
              placeholder="Tax Number"
              value={form.taxNumber}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
            />

            <input
              type="email"
              name="email"
              placeholder="Organization Email"
              value={form.email}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
            />

            <input
              type="text"
              name="phoneNumber"
              placeholder="Phone Number"
              value={form.phoneNumber}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
            />

            <input
              type="text"
              name="address"
              placeholder="Address"
              value={form.address}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
            />            <input
              type="text"
              name="country"
              placeholder="Country"
              value={form.country}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
            />

            <input
              type="text"
              name="currency"
              placeholder="Currency"
              value={form.currency}
              onChange={handleChange}
              className="rounded-xl border border-[#D0D5DD] p-3"
            />

          </div>

          <div className="border-t border-[#ECECF3] pt-6">

            <h3 className="mb-4 text-lg font-semibold text-[#20243A]">
              Organization Owner
            </h3>

            <div className="grid grid-cols-2 gap-4">

              <input
                type="text"
                name="ownerName"
                placeholder="Owner Name"
                value={form.ownerName}
                onChange={handleChange}
                className="rounded-xl border border-[#D0D5DD] p-3"
                required
              />

              <input
                type="email"
                name="ownerEmail"
                placeholder="Owner Email"
                value={form.ownerEmail}
                onChange={handleChange}
                className="rounded-xl border border-[#D0D5DD] p-3"
                required
              />

              <input
                type="text"
                name="ownerPhoneNumber"
                placeholder="Owner Phone Number"
                value={form.ownerPhoneNumber}
                onChange={handleChange}
                className="rounded-xl border border-[#D0D5DD] p-3"
              />

              <input
                type="password"
                name="ownerPassword"
                placeholder="Temporary Password"
                value={form.ownerPassword}
                onChange={handleChange}
                className="rounded-xl border border-[#D0D5DD] p-3"
                required
                minLength={8}
              />

            </div>

          </div>          <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-6">

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[#D0D5DD] px-5 py-3 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#0D9488] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5A4BE8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating Organization..." : "Create Organization"}
            </button>

          </div>

        </form>

      </div>
    </div>
  );
}

