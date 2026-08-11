import {
  Plus,
  Search,
} from "lucide-react";

const assets = [
  {
    assetId: "AST-001",
    asset: "HP EliteBook X",
    category: "Laptop",
    value: "KES 280,000",
    status: "Assigned",
  },
  {
    assetId: "AST-002",
    asset: "Toyota Hilux",
    category: "Vehicle",
    value: "KES 4,500,000",
    status: "Active",
  },
  {
    assetId: "AST-003",
    asset: "Office Printer",
    category: "Equipment",
    value: "KES 85,000",
    status: "Active",
  },
];

export default function Assets() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Assets Management
          </h1>

          <p className="text-[#666B84] mt-2">
            Manage company assets, depreciation and assignments.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-[#20243A]">
          <Plus size={18} />
          Add Asset
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-6">

        <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Total Assets</p>
          <h2 className="text-3xl font-bold text-[#20243A] mt-2">3</h2>
        </div>

        <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Asset Value</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            KES 4,865,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Assigned Assets</p>
          <h2 className="text-3xl font-bold text-blue-400 mt-2">1</h2>
        </div>

        <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Depreciation Due</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">0</h2>
        </div>

      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-4">
        <div className="flex items-center bg-white rounded-lg px-3">
          <Search size={18} className="text-[#666B84]" />

          <input
            type="text"
            placeholder="Search assets..."
            className="bg-transparent outline-none px-3 py-3 text-[#20243A] flex-1"
          />
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">Asset ID</th>
              <th className="text-left p-4">Asset</th>
              <th className="text-left p-4">Category</th>
              <th className="text-right p-4">Value</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.assetId}
                className="border-t border-[#ECECF3] hover:bg-white"
              >
                <td className="p-4 text-blue-400">
                  {asset.assetId}
                </td>

                <td className="p-4 text-[#20243A]">
                  {asset.asset}
                </td>

                <td className="p-4 text-[#666B84]">
                  {asset.category}
                </td>

                <td className="p-4 text-right text-[#20243A]">
                  {asset.value}
                </td>

                <td className="p-4">
                  <span className="px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400">
                    {asset.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>

    </div>
  );
}