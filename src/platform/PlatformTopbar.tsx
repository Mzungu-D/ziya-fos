export default function PlatformTopbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-800 bg-slate-900 px-8">

      <div>

        <h1 className="text-2xl font-bold text-white">
          Platform Administration
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Manage organizations, users, security and the entire Ziya Financial Operating System.
        </p>

      </div>

      <div className="flex items-center gap-4">

        <button className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Notifications
        </button>

        <button className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Profile
        </button>

      </div>

    </header>
  );
}