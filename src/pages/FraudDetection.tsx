const alerts = [
  {
    id: "FD-001",
    type: "Duplicate Payment",
    description: "Invoice INV-2026-00124 appears to have been paid twice.",
    severity: "High",
    status: "Open",
  },
  {
    id: "FD-002",
    type: "Unusual Expense",
    description: "Expense amount exceeded department average by 250%.",
    severity: "Medium",
    status: "Investigating",
  },
  {
    id: "FD-003",
    type: "Payroll Anomaly",
    description: "Salary increase above approval threshold detected.",
    severity: "Low",
    status: "Resolved",
  },
];

export default function FraudDetection() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#20243A]">
          Fraud Detection
        </h1>

        <p className="text-[#666B84] mt-2">
          Monitor suspicious activities and financial anomalies.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6">

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Active Alerts</p>
          <h2 className="text-3xl font-bold text-red-400 mt-2">
            2
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Resolved Cases</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            1
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">Risk Score</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            18%
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">System Status</p>
          <h2 className="text-2xl font-bold text-green-400 mt-2">
            Monitoring
          </h2>
        </div>

      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white text-[#666B84]">
            <tr>
              <th className="text-left p-4">Alert ID</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Description</th>
              <th className="text-left p-4">Severity</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {alerts.map((alert) => (
              <tr
                key={alert.id}
                className="border-t border-[#ECECF3] hover:bg-white"
              >
                <td className="p-4 text-[#20243A]">
                  {alert.id}
                </td>

                <td className="p-4 text-[#20243A]">
                  {alert.type}
                </td>

                <td className="p-4 text-[#666B84]">
                  {alert.description}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      alert.severity === "High"
                        ? "bg-red-500/20 text-red-400"
                        : alert.severity === "Medium"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {alert.severity}
                  </span>
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      alert.status === "Resolved"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-[#0D9488]/20 text-[#20243A]"
                    }`}
                  >
                    {alert.status}
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

