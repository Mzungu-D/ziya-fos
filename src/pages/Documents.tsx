import {
  Upload,
  Search,
} from "lucide-react";

const documents = [
  {
    id: "DOC-001",
    name: "Invoice_INV-2026-00124.pdf",
    category: "Invoice",
    uploadedBy: "Finance Team",
    uploadedAt: "2026-07-10",
  },
  {
    id: "DOC-002",
    name: "Bank_Statement_June_2026.pdf",
    category: "Bank Statement",
    uploadedBy: "Treasury Team",
    uploadedAt: "2026-07-09",
  },
  {
    id: "DOC-003",
    name: "Payroll_Report_June_2026.xlsx",
    category: "Payroll",
    uploadedBy: "HR Department",
    uploadedAt: "2026-07-08",
  },
  {
    id: "DOC-004",
    name: "Procurement_Request_PR-001.pdf",
    category: "Procurement",
    uploadedBy: "Operations Team",
    uploadedAt: "2026-07-07",
  },
];

export default function Documents() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Documents
          </h1>

          <p className="text-[#666B84] mt-2">
            Store and manage financial and operational documents.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-[#0D9488] hover:bg-[#5a4de0] px-4 py-2 rounded-lg text-[#20243A]">
          <Upload size={18} />
          Upload Document
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Total Documents</p>
          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            124
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Invoices</p>
          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            42
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Bank Statements</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            18
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Payroll Reports</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            12
          </h2>
        </div>

      </div>

      {/* Search */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl p-4">
        <div className="flex items-center bg-white rounded-lg px-3">
          <Search size={18} className="text-[#666B84]" />

          <input
            type="text"
            placeholder="Search documents..."
            className="bg-transparent outline-none px-3 py-3 text-[#20243A] flex-1"
          />
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">Document</th>
              <th className="text-left p-4">Category</th>
              <th className="text-left p-4">Uploaded By</th>
              <th className="text-left p-4">Upload Date</th>
            </tr>
          </thead>

          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-t border-[#ECECF3] hover:bg-white"
              >
                <td className="p-4 text-[#20243A]">
                  {doc.name}
                </td>

                <td className="p-4 text-[#20243A]">
                  {doc.category}
                </td>

                <td className="p-4 text-[#666B84]">
                  {doc.uploadedBy}
                </td>

                <td className="p-4 text-[#666B84]">
                  {doc.uploadedAt}
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>

    </div>
  );
}

