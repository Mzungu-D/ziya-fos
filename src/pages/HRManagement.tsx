import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  Briefcase,
} from "lucide-react";

const employees = [
  {
    name: "John Mwangi",
    role: "Finance Manager",
    department: "Finance",
    email: "john@ziya.co.ke",
    phone: "+254700111111",
    status: "Active",
  },
  {
    name: "Mary Wanjiku",
    role: "Operations Officer",
    department: "Operations",
    email: "mary@ziya.co.ke",
    phone: "+254700222222",
    status: "Active",
  },
  {
    name: "Ahmed Hassan",
    role: "Software Engineer",
    department: "Technology",
    email: "ahmed@ziya.co.ke",
    phone: "+254700333333",
    status: "On Leave",
  },
];

export default function HRManagement() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            HR Management
          </h1>

          <p className="text-slate-400 mt-2">
            Manage employees, departments and workforce information.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Plus size={18} />
          Add Employee
        </button>
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

      {/* Employee Cards */}
      <div className="grid grid-cols-2 gap-6">
        {employees.map((employee) => (
          <div
            key={employee.email}
            className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all"
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users size={28} className="text-blue-400" />
              </div>

              <div>
                <h2 className="text-xl text-white font-semibold">
                  {employee.name}
                </h2>

                <p className="text-slate-400">
                  {employee.role}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-slate-400">
                <Briefcase size={16} />
                {employee.department}
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <Mail size={16} />
                {employee.email}
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <Phone size={16} />
                {employee.phone}
              </div>
            </div>

            <div className="mt-5">
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  employee.status === "Active"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {employee.status}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}