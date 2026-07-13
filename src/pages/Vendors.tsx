import {
  Plus,
  Building2,
  Search,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

const vendors = [
  {
    name: "Choice Bank",
    category: "Banking",
    contact: "+254700000000",
    email: "support@choicebank.co.ke",
    location: "Nairobi",
    status: "Active",
  },
  {
    name: "Safaricom PLC",
    category: "Telecommunications",
    contact: "+254722000000",
    email: "business@safaricom.co.ke",
    location: "Nairobi",
    status: "Active",
  },
  {
    name: "Kenya Power",
    category: "Utilities",
    contact: "+254711000000",
    email: "support@kplc.co.ke",
    location: "Mombasa",
    status: "Active",
  },
];

export default function Vendors() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Vendors
          </h1>

          <p className="text-slate-400 mt-2">
            Manage suppliers, service providers and business partners.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Plus size={18} />
          Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center bg-slate-900 rounded-lg px-3">
          <Search size={18} className="text-slate-500" />

          <input
            type="text"
            placeholder="Search vendors..."
            className="bg-transparent outline-none px-3 py-3 text-white flex-1"
          />
        </div>
      </div>

      {/* Vendor Cards */}
      <div className="grid grid-cols-2 gap-6">
        {vendors.map((vendor) => (
          <div
            key={vendor.name}
            className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all"
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Building2 size={28} className="text-blue-400" />
              </div>

              <div>
                <h2 className="text-xl text-white font-semibold">
                  {vendor.name}
                </h2>

                <p className="text-slate-400">
                  {vendor.category}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-slate-400">
                <Phone size={16} />
                {vendor.contact}
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <Mail size={16} />
                {vendor.email}
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <MapPin size={16} />
                {vendor.location}
              </div>
            </div>

            <div className="mt-5">
              <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400">
                {vendor.status}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}