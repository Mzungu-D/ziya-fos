import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  ShieldCheck,
  User,
  Globe,
  Monitor,
  Clock,
} from "lucide-react";

interface AuditLog {
  id: number;
  user: string;
  organization: string;
  action: string;
  ip: string;
  device: string;
  browser: string;
  time: string;
  status: "Success" | "Failed";
}

const auditLogs: AuditLog[] = [
  {
    id: 1,
    user: "Dennis Odhiambo",
    organization: "Ziya Bridge",
    action: "Created Organization",
    ip: "102.68.15.45",
    device: "Windows",
    browser: "Chrome",
    time: "2 minutes ago",
    status: "Success",
  },
  {
    id: 2,
    user: "Sarah Kimani",
    organization: "ABC SACCO",
    action: "Updated Subscription",
    ip: "197.248.11.3",
    device: "MacOS",
    browser: "Safari",
    time: "12 minutes ago",
    status: "Success",
  },
  {
    id: 3,
    user: "John Mwangi",
    organization: "Coast Finance",
    action: "Failed Login",
    ip: "105.163.44.8",
    device: "Android",
    browser: "Chrome",
    time: "25 minutes ago",
    status: "Failed",
  },
  {
    id: 4,
    user: "Platform Admin",
    organization: "Ziya Bridge",
    action: "Disabled User",
    ip: "41.90.15.10",
    device: "Windows",
    browser: "Edge",
    time: "1 hour ago",
    status: "Success",
  },
];

export default function AuditLogs() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
          <p className="mt-2 text-slate-400">
            Track every action performed across the platform.
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black hover:bg-amber-400">
          <Download size={18} />
          Export Logs
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />

            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-white focus:border-amber-500 outline-none"
            />
          </div>

          <select className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">
            <option>All Actions</option>
            <option>Login</option>
            <option>Create</option>
            <option>Update</option>
            <option>Delete</option>
          </select>

          <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white hover:bg-slate-700">
            <Filter size={18} />
            More Filters
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-6 py-4 text-left text-slate-300">User</th>
              <th className="px-6 py-4 text-left text-slate-300">
                Organization
              </th>
              <th className="px-6 py-4 text-left text-slate-300">Action</th>
              <th className="px-6 py-4 text-left text-slate-300">IP</th>
              <th className="px-6 py-4 text-left text-slate-300">Device</th>
              <th className="px-6 py-4 text-left text-slate-300">Time</th>
              <th className="px-6 py-4 text-left text-slate-300">Status</th>
            </tr>
          </thead>

          <tbody>
            {auditLogs
              .filter(
                (log) =>
                  log.user.toLowerCase().includes(search.toLowerCase()) ||
                  log.organization
                    .toLowerCase()
                    .includes(search.toLowerCase()) ||
                  log.action.toLowerCase().includes(search.toLowerCase())
              )
              .map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-slate-800 hover:bg-slate-800/50"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <User size={18} className="text-amber-400" />
                      {log.user}
                    </div>
                  </td>

                  <td className="px-6 py-5">{log.organization}</td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        size={18}
                        className="text-emerald-400"
                      />
                      {log.action}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <Globe size={16} />
                      {log.ip}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <Monitor size={16} />
                      {log.device} • {log.browser}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      {log.time}
                    </div>
                  </td>

                  <td className="px-6 py-5">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        log.status === "Success"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {log.status}
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