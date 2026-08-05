export default function PlatformDashboard() {
  return (
    <div className="space-y-8">

      <div>

        <h1 className="text-3xl font-bold text-white">
          Platform Dashboard
        </h1>

        <p className="mt-2 text-slate-400">
          Welcome to the Ziya Financial Operating System Platform Administration.
        </p>

      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-slate-400">Organizations</p>
          <h2 className="mt-4 text-4xl font-bold text-white">125</h2>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-slate-400">Platform Users</p>
          <h2 className="mt-4 text-4xl font-bold text-white">1,284</h2>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-slate-400">Monthly Revenue</p>
          <h2 className="mt-4 text-4xl font-bold text-white">
            KES 3.8M
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-slate-400">System Health</p>
          <h2 className="mt-4 text-4xl font-bold text-green-400">
            Healthy
          </h2>
        </div>

      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h2 className="text-xl font-semibold text-white">
            Recent Platform Activity
          </h2>

          <div className="mt-6 space-y-4">

            <div className="rounded-lg bg-slate-800 p-4 text-slate-300">
              New organization registered.
            </div>

            <div className="rounded-lg bg-slate-800 p-4 text-slate-300">
              Platform backup completed successfully.
            </div>

            <div className="rounded-lg bg-slate-800 p-4 text-slate-300">
              Security scan completed.
            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h2 className="text-xl font-semibold text-white">
            Platform Status
          </h2>

          <div className="mt-6 space-y-4">

            <div className="flex justify-between">
              <span className="text-slate-400">Railway</span>
              <span className="text-green-400">Online</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Database</span>
              <span className="text-green-400">Connected</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">API</span>
              <span className="text-green-400">Healthy</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Storage</span>
              <span className="text-green-400">Healthy</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}