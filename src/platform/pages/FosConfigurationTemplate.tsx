import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  bootstrapFosTemplate,
  getPlatformOrganizations,
  getTemplateStatus,
  publishFosTemplate,
  reconcileFosTenants,
  type Organization,
  type TemplateStatus,
} from "../../services/fosConfigurationTemplate";

export default function FosConfigurationTemplate() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [status, setStatus] = useState<TemplateStatus | null>(null);
  const [selectedDemo, setSelectedDemo] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reconcileResult, setReconcileResult] = useState<{
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
  } | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [orgResponse, statusResponse] = await Promise.all([
        getPlatformOrganizations(),
        getTemplateStatus().catch(() => null),
      ]);

      const orgs = orgResponse.organizations ?? [];
      setOrganizations(orgs);

      const demo = orgs.find(
        (org) => org.name.trim().toLowerCase() === "demo company",
      );

      if (demo) {
        setSelectedDemo(demo.id);
      }

      setStatus(statusResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load FOS configuration status.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const demoOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedDemo),
    [organizations, selectedDemo],
  );

  const templateReady =
    status !== null && status.latestVersion > 0;

  async function handleBootstrap() {
    if (!selectedDemo) {
      setError("Select Demo Company first.");
      return;
    }

    if (
      !window.confirm(
        "Bootstrap Demo Company as the FOS-wide configuration template? This publishes configuration only and does not copy tenant business or financial data.",
      )
    ) {
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    setReconcileResult(null);

    try {
      await bootstrapFosTemplate(selectedDemo);
      setMessage(
        "Demo Company is now the FOS configuration template.",
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bootstrap failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function handlePublish() {
    if (!status?.source?.id) {
      setError("No FOS template source is configured.");
      return;
    }

    if (
      !window.confirm(
        "Publish the current Demo Company configuration as a new FOS template version?",
      )
    ) {
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    setReconcileResult(null);

    try {
      await publishFosTemplate(status.source.id);
      setMessage("New FOS configuration template version published.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Publish failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleReconcile() {
    if (!templateReady) {
      setError("Publish a FOS template before reconciliation.");
      return;
    }

    const pending =
      status?.tenants.filter(
        (tenant) =>
          tenant.status !== "SUSPENDED" &&
          tenant.templateVersion < status.latestVersion,
      ).length ?? 0;

    if (pending === 0) {
      setMessage("All active tenants are already on the latest template.");
      return;
    }

    if (
      !window.confirm(
        `Reconcile ${pending} tenant(s) to FOS template version ${status.latestVersion}? Tenant business and financial data will not be copied or deleted.`,
      )
    ) {
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");
    setReconcileResult(null);

    try {
      const result = await reconcileFosTenants();

      setReconcileResult({
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
      });

      if (result.failed > 0) {
        setMessage(
          "Reconciliation completed with some tenant failures. Review the result below.",
        );
      } else {
        setMessage("All eligible tenants reconciled successfully.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Tenant reconciliation failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-slate-500" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="mb-2 text-sm text-slate-500">
            Platform / System / FOS Configuration
          </div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            FOS Configuration
          </h1>
          <p className="mt-2 text-slate-500">
            Manage the FOS-wide configuration template used across tenants.
          </p>
        </div>

        <button
          onClick={() => void load()}
          disabled={working}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Database className="mb-4 text-[#D4A72C]" size={24} />
          <p className="text-sm text-slate-500">Template Source</p>
          <p className="mt-2 text-lg font-semibold text-[#20243A]">
            {status?.source?.name ?? "Not configured"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ShieldCheck className="mb-4 text-emerald-600" size={24} />
          <p className="text-sm text-slate-500">Template Version</p>
          <p className="mt-2 text-3xl font-bold text-[#20243A]">
            {status?.latestVersion ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Users className="mb-4 text-blue-600" size={24} />
          <p className="text-sm text-slate-500">Active Tenants Pending</p>
          <p className="mt-2 text-3xl font-bold text-[#20243A]">
            {status
              ? status.tenants.filter(
                  (tenant) =>
                    tenant.status !== "SUSPENDED" &&
                    tenant.templateVersion < status.latestVersion,
                ).length
              : 0}
          </p>
        </div>
      </div>

      {!templateReady && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Initialize FOS-wide template
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Select Demo Company and bootstrap its configuration as the
            FOS-wide template. Only approved configuration is published.
            Tenant business and financial records are not copied.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedDemo}
              onChange={(event) => setSelectedDemo(event.target.value)}
              className="min-w-[280px] rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
            >
              <option value="">Select Demo Company</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => void handleBootstrap()}
              disabled={working || !selectedDemo}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4A72C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#BD9120] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <Send size={17} />
              )}
              Bootstrap Demo Template
            </button>
          </div>

          {demoOrganization && (
            <p className="mt-3 text-xs text-amber-700">
              Selected source: {demoOrganization.name}
            </p>
          )}
        </section>
      )}

      {templateReady && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-lg font-semibold text-[#20243A]">
                  Template Release
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Publish the current Demo Company configuration as a new
                  version before synchronizing tenants.
                </p>
              </div>

              <button
                onClick={() => void handlePublish()}
                disabled={working}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4A72C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#BD9120] disabled:opacity-50"
              >
                {working ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Send size={17} />
                )}
                Publish New Version
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-6 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-lg font-semibold text-[#20243A]">
                  Tenant Synchronization
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configuration changes are reconciled without copying tenant
                  business or financial data.
                </p>
              </div>

              <button
                onClick={() => void handleReconcile()}
                disabled={working}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#159A8C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#118477] disabled:opacity-50"
              >
                {working ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <RefreshCw size={17} />
                )}
                Reconcile Tenants
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-4">Tenant</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Version</th>
                    <th className="px-6 py-4">State</th>
                  </tr>
                </thead>
                <tbody>
                  {status?.tenants.map((tenant) => {
                    const current =
                      tenant.templateVersion >= status.latestVersion;

                    return (
                      <tr
                        key={tenant.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {tenant.name}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {tenant.status}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {tenant.templateVersion}
                        </td>
                        <td className="px-6 py-4">
                          {current ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 size={14} />
                              Up to date
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {reconcileResult && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#20243A]">
            Last Reconciliation
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Processed</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {reconcileResult.processed}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Succeeded</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {reconcileResult.succeeded}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Failed</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {reconcileResult.failed}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Skipped</p>
              <p className="mt-1 text-2xl font-bold text-slate-600">
                {reconcileResult.skipped}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
