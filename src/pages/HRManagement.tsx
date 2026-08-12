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
          <h1 className="text-3xl font-bold text-[#20243A]">
            HR Management
          </h1>

          <p className="text-[#666B84] mt-2">
            Manage employees, departments and workforce information.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-[#20243A] hover:bg-[#5a4de0] px-4 py-2 rounded-lg text-[#20243A]">
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl p-4">
        <div className="flex items-center bg-white rounded-lg px-3">
          <Search size={18} className="text-[#666B84]" />

          <input
            type="text"
            placeholder="Search employees..."
            className="bg-transparent outline-none px-3 py-3 text-[#20243A] flex-1"
          />
        </div>
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-2 gap-6">
        {employees.map((employee) => (
          <div
            key={employee.email}
            className="bg-white border border-[#ECECF3] rounded-2xl p-6 hover:border-[#20243A] transition-all"
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl bg-[#20243A]/10 flex items-center justify-center">
                <Users size={28} className="text-[#20243A]" />
              </div>

              <div>
                <h2 className="text-xl text-[#20243A] font-semibold">
                  {employee.name}
                </h2>

                <p className="text-[#666B84]">
                  {employee.role}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[#666B84]">
                <Briefcase size={16} />
                {employee.department}
              </div>

              <div className="flex items-center gap-3 text-[#666B84]">
                <Mail size={16} />
                {employee.email}
              </div>

              <div className="flex items-center gap-3 text-[#666B84]">
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
