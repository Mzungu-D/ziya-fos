export default function PlatformSidebar() {
  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-800 bg-slate-900">

      <div className="border-b border-slate-800 p-6">

        <h1 className="text-2xl font-bold text-amber-400">
          Ziya FOS
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Platform Administration
        </p>

      </div>

      <nav className="flex-1 space-y-2 p-4">

        <button className="w-full rounded-xl bg-slate-800 px-4 py-3 text-left text-white hover:bg-slate-700">
          Dashboard
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          Organizations
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          Platform Users
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          Platform Settings
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          Security Center
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          Audit Logs
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          System Health
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          AI Control Center
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          Integrations
        </button>

        <button className="w-full rounded-xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
          Billing
        </button>

      </nav>

    </aside>
  );
}