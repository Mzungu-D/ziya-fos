import {
  Plus,
  Search,
  DollarSign,
  Building2,
  CheckCircle,
} from "lucide-react";

const payroll = [
  {
    employee: "John Mwangi",
    department: "Finance",
    grossSalary: "KES 120,000",
    deductions: "KES 18,500",
    netSalary: "KES 101,500",
    status: "Processed",
  },
  {
    employee: "Mary Wanjiku",
    department: "Operations",
    grossSalary: "KES 95,000",
    deductions: "KES 14,250",
    netSalary: "KES 80,750",
    status: "Pending",
  },
  {
    employee: "Ahmed Hassan",
    department: "Technology",
    grossSalary: "KES 140,000",
    deductions: "KES 22,100",
    netSalary: "KES 117,900",
    status: "Processed",
  },
];

export default function Payroll() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Payroll
          </h1>

          <p className="text-slate-400 mt-2">
            Manage salaries, deductions and payroll processing.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Plus size={18} />
          Run Payroll
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Employees</p>
          <h2 className="text-3xl font-bold text-white mt-2">3</h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Gross Payroll</p>
          <h2 className="text-3xl font-bold text-white mt-2">
            KES 355,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Deductions</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            KES 54,850
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Net Payroll</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            KES 300,150
          </h2>
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center bg-slate-900 rounded-lg px-3">
          <Search size={18} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search employees..."
            className="bg-transparent outline-none px-3 py-3 text-white flex-1"
          />
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Employee</th>
              <th className="text-left p-4">Department</th>
              <th className="text-right p-4">Gross</th>
              <th className="text-right p-4">Deductions</th>
              <th className="text-right p-4">Net</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {payroll.map((employee) => (
              <tr
                key={employee.employee}
                className="border-t border-slate-800 hover:bg-slate-900"
              >
                <td className="p-4 text-white">
                  {employee.employee}
                </td>

                <td className="p-4 text-slate-300">
                  {employee.department}
                </td>

                <td className="p-4 text-right text-white">
                  {employee.grossSalary}
                </td>

                <td className="p-4 text-right text-yellow-400">
                  {employee.deductions}
                </td>

                <td className="p-4 text-right text-green-400 font-semibold">
                  {employee.netSalary}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      employee.status === "Processed"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {employee.status}
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