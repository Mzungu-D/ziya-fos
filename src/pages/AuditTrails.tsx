const auditLogs = [
  {
    id: "AUD-001",
    timestamp: "2026-07-10 09:15",
    user: "Dennis Odhiambo",
    action: "Created Invoice",
    module: "Invoicing",
    details: "Created invoice INV-2026-00124",
  },
  {
    id: "AUD-002",
    timestamp: "2026-07-10 09:32",
    user: "Finance Manager",
    action: "Approved Expense",
    module: "Expenses",
    details: "Approved expense EXP-2026-004",
  },
  {
    id: "AUD-003",
    timestamp: "2026-07-10 10:05",
    user: "HR Officer",
    action: "Processed Payroll",
    module: "Payroll",
    details: "Processed July payroll batch",
  },
  {
    id: "AUD-004",
    timestamp: "2026-07-10 10:20",
    user: "Treasury Officer",
    action: "Connected Bank Account",
    module: "Bank Integration",
    details: "Added Choice Bank Operations Account",
  },
];

export default function AuditTrails() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Audit Trails
        </h1>

        <p className="text-slate-400 mt-2">
          Track every action performed within Ziya FOS.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Today's Activities</p>
          <h2 className="text-3xl font-bold text-white mt-2">
            24
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Active Users</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            8
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Critical Events</p>
          <h2 className="text-3xl font-bold text-red-400 mt-2">
            1
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">System Integrity</p>
          <h2 className="text-2xl font-bold text-green-400 mt-2">
            Healthy
          </h2>
        </div>

      </div>

      {/* Audit Log Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Time</th>
              <th className="text-left p-4">User</th>
              <th className="text-left p-4">Action</th>
              <th className="text-left p-4">Module</th>
              <th className="text-left p-4">Details</th>
            </tr>
          </thead>

          <tbody>
            {auditLogs.map((log) => (
              <tr
                key={log.id}
                className="border-t border-slate-800 hover:bg-slate-900"
              >
                <td className="p-4 text-slate-300">
                  {log.timestamp}
                </td>

                <td className="p-4 text-white">
                  {log.user}
                </td>

                <td className="p-4 text-blue-400">
                  {log.action}
                </td>

                <td className="p-4 text-slate-300">
                  {log.module}
                </td>

                <td className="p-4 text-slate-400">
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>

    </div>
  );
}