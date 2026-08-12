import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import {
  authenticatedFetch,
} from "../lib/auth";

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API_BASE = "/api/mpesa";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

type MpesaEnvironment =
  | "sandbox"
  | "production";

type MpesaAccount = {
  id: string;
  name: string;
  accountType?: string | null;
  shortcode: string;
  environment: string;
  initiatorName?: string | null;
  resultUrl?: string | null;
  timeoutUrl?: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type AccountListResponse = {
  success: boolean;
  accounts: MpesaAccount[];
};

type AccountResponse = {
  success: boolean;
  message?: string;
  account: MpesaAccount;
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
};

type FormState = {
  name: string;
  shortcode: string;
  environment: MpesaEnvironment;
  consumerKey: string;
  consumerSecret: string;
  initiatorName: string;
  securityCredential: string;
  isDefault: boolean;
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const initialForm: FormState = {
  name: "",
  shortcode: "",
  environment: "sandbox",
  consumerKey: "",
  consumerSecret: "",
  initiatorName: "",
  securityCredential: "",
  isDefault: true,
};

function getCallbackUrls() {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      resultUrl: "",
      timeoutUrl: "",
    };
  }

  const origin =
    window.location.origin;

  return {
    resultUrl:
      `${origin}/api/mpesa/callback/result`,

    timeoutUrl:
      `${origin}/api/mpesa/callback/timeout`,
  };
}

function formatDate(
  value?: string,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-KE",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function MpesaSettings() {
  const navigate =
    useNavigate();

  const [
    accounts,
    setAccounts,
  ] = useState<MpesaAccount[]>(
    [],
  );

  const [
    form,
    setForm,
  ] = useState<FormState>(
    initialForm,
  );

  const [
    editingAccountId,
    setEditingAccountId,
  ] = useState<
    string | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    testingAccountId,
    setTestingAccountId,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    showConsumerSecret,
    setShowConsumerSecret,
  ] = useState(false);

  const [
    showSecurityCredential,
    setShowSecurityCredential,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Callback URLs
  |--------------------------------------------------------------------------
  */

  const callbackUrls =
    useMemo(
      () => getCallbackUrls(),
      [],
    );

  /*
  |--------------------------------------------------------------------------
  | API request helper
  |--------------------------------------------------------------------------
  */

  async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response =
      await authenticatedFetch(
        `${API_BASE}${path}`,
        {
          ...options,

          headers: {
            "Content-Type":
              "application/json",

            ...(options.headers ??
              {}),
          },
        },
      );

    const data =
      await response
        .json()
        .catch(
          () => ({}),
        ) as ApiErrorResponse &
          T;

    if (!response.ok) {
      if (
        response.status ===
        401
      ) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      if (
        response.status ===
        403
      ) {
        throw new Error(
          data.message ||
            "You do not have permission to configure M-Pesa for this organization.",
        );
      }

      throw new Error(
        data.message ||
          "The M-Pesa request failed.",
      );
    }

    return data as T;
  }

  /*
  |--------------------------------------------------------------------------
  | Load accounts
  |--------------------------------------------------------------------------
  */

  const loadAccounts =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await apiRequest<AccountListResponse>(
            "/accounts",
          );

        setAccounts(
          response.accounts ??
            [],
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load M-Pesa accounts.",
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadAccounts();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Form helpers
  |--------------------------------------------------------------------------
  */

  const updateForm = <
    K extends keyof FormState,
  >(
    field: K,
    value: FormState[K],
  ) => {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  };

  const resetForm =
    () => {
      setForm(
        initialForm,
      );

      setEditingAccountId(
        null,
      );

      setShowConsumerSecret(
        false,
      );

      setShowSecurityCredential(
        false,
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Edit existing account
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  | We intentionally do NOT populate credential fields.
  | Existing secrets are never returned by the backend.
  |
  */

  const startEditing =
    (account: MpesaAccount) => {
      setError("");
      setSuccess("");

      setEditingAccountId(
        account.id,
      );

      setForm({
        name:
          account.name,
        shortcode:
          account.shortcode,
        environment:
          account.environment ===
          "production"
            ? "production"
            : "sandbox",
        consumerKey:
          "",
        consumerSecret:
          "",
        initiatorName:
          account.initiatorName ??
          "",
        securityCredential:
          "",
        isDefault:
          account.isDefault,
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  /*
  |--------------------------------------------------------------------------
  | Validate form
  |--------------------------------------------------------------------------
  */

  const validateForm =
    (): string | null => {
      if (
        !form.name.trim()
      ) {
        return "M-Pesa account name is required.";
      }

      if (
        !form.shortcode.trim()
      ) {
        return "M-Pesa shortcode is required.";
      }

      if (
        !form.initiatorName.trim()
      ) {
        return "Initiator name is required.";
      }

      /*
       * Credentials are required when creating a new account.
       *
       * During editing, they are optional because the backend
       * keeps the existing encrypted credentials if no new
       * credentials are supplied.
       */
      if (
        !editingAccountId
      ) {
        if (
          !form.consumerKey.trim()
        ) {
          return "Consumer Key is required.";
        }

        if (
          !form.consumerSecret.trim()
        ) {
          return "Consumer Secret is required.";
        }

        if (
          !form.securityCredential.trim()
        ) {
          return "Security Credential is required.";
        }
      }

      /*
       * If the user starts replacing credentials, require both
       * Consumer Key and Consumer Secret.
       */
      if (
        editingAccountId &&
        (
          form.consumerKey.trim() ||
          form.consumerSecret.trim()
        )
      ) {
        if (
          !form.consumerKey.trim()
        ) {
          return "Enter both Consumer Key and Consumer Secret when updating credentials.";
        }

        if (
          !form.consumerSecret.trim()
        ) {
          return "Enter both Consumer Key and Consumer Secret when updating credentials.";
        }
      }

      return null;
    };

  /*
  |--------------------------------------------------------------------------
  | Save / connect
  |--------------------------------------------------------------------------
  */

  const saveAccount =
    async () => {
      try {
        setSubmitting(true);
        setError("");
        setSuccess("");

        const validationError =
          validateForm();

        if (
          validationError
        ) {
          throw new Error(
            validationError,
          );
        }

        const payload: Record<
          string,
          unknown
        > = {
          name:
            form.name.trim(),

          accountType:
            "B2C",

          shortcode:
            form.shortcode.trim(),

          environment:
            form.environment,

          initiatorName:
            form.initiatorName.trim(),

          resultUrl:
            callbackUrls.resultUrl,

          timeoutUrl:
            callbackUrls.timeoutUrl,

          isDefault:
            form.isDefault,
        };

        /*
         * Only send credential fields when the tenant is
         * creating the account or explicitly replacing them.
         */
        if (
          form.consumerKey.trim()
        ) {
          payload.consumerKey =
            form.consumerKey.trim();
        }

        if (
          form.consumerSecret.trim()
        ) {
          payload.consumerSecret =
            form.consumerSecret.trim();
        }

        if (
          form.securityCredential.trim()
        ) {
          payload.securityCredential =
            form.securityCredential.trim();
        }

        const response =
          editingAccountId
            ? await apiRequest<AccountResponse>(
                `/accounts/${encodeURIComponent(
                  editingAccountId,
                )}`,
                {
                  method:
                    "PATCH",

                  body:
                    JSON.stringify(
                      payload,
                    ),
                },
              )
            : await apiRequest<AccountResponse>(
                "/accounts",
                {
                  method:
                    "POST",

                  body:
                    JSON.stringify(
                      payload,
                    ),
                },
              );

        setSuccess(
          response.message ||
            (
              editingAccountId
                ? "M-Pesa account updated successfully."
                : "M-Pesa account connected successfully."
            ),
        );

        resetForm();

        await loadAccounts();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to save M-Pesa account.",
        );
      } finally {
        setSubmitting(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Test existing account
  |--------------------------------------------------------------------------
  */

  const testAccount =
    async (
      accountId: string,
    ) => {
      try {
        setTestingAccountId(
          accountId,
        );

        setError("");
        setSuccess("");

        const response =
          await apiRequest<{
            success: boolean;
            message?: string;
          }>(
            `/accounts/${encodeURIComponent(
              accountId,
            )}/test`,
            {
              method:
                "POST",
            },
          );

        setSuccess(
          response.message ||
            "M-Pesa connection is working correctly.",
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "M-Pesa connection test failed.",
        );
      } finally {
        setTestingAccountId(
          null,
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Set default account
  |--------------------------------------------------------------------------
  */

  const setDefaultAccount =
    async (
      accountId: string,
    ) => {
      try {
        setError("");
        setSuccess("");

        await apiRequest(
          `/accounts/${encodeURIComponent(
            accountId,
          )}/default`,
          {
            method:
              "PATCH",
          },
        );

        setSuccess(
          "M-Pesa account set as the default account.",
        );

        await loadAccounts();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to set default M-Pesa account.",
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Activate / deactivate
  |--------------------------------------------------------------------------
  */

  const toggleAccount =
    async (
      account: MpesaAccount,
    ) => {
      try {
        setError("");
        setSuccess("");

        await apiRequest(
          `/accounts/${encodeURIComponent(
            account.id,
          )}/status`,
          {
            method:
              "PATCH",

            body:
              JSON.stringify({
                isActive:
                  !account.isActive,
              }),
          },
        );

        setSuccess(
          account.isActive
            ? "M-Pesa account deactivated."
            : "M-Pesa account activated.",
        );

        await loadAccounts();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to update M-Pesa account status.",
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-6">
      {/* Back */}

      <button
        type="button"
        onClick={() =>
          navigate(
            "/dashboard/mpesa-integration",
          )
        }
        className="inline-flex items-center gap-2 text-sm font-medium text-[#666B84] transition-colors hover:text-[#20243A]"
      >
        <ArrowLeft
          size={18}
        />

        Back to M-Pesa
      </button>

      {/* Header */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EDFF]">
              <Smartphone
                size={23}
                className="text-[#6D5DF6]"
              />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-[#20243A]">
                M-Pesa Configuration
              </h1>

              <p className="mt-1 text-[#666B84]">
                Connect and manage your
                organization's M-Pesa B2C
                account.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadAccounts()
          }
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-60"
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* Security notice */}

      <div className="flex items-start gap-3 rounded-2xl border border-[#E6E2FF] bg-[#F8F7FF] p-5">
        <ShieldCheck
          size={22}
          className="mt-0.5 shrink-0 text-[#6D5DF6]"
        />

        <div>
          <p className="font-semibold text-[#20243A]">
            Your M-Pesa credentials are
            protected
          </p>

          <p className="mt-1 text-sm leading-6 text-[#666B84]">
            Consumer Key, Consumer Secret
            and Security Credential are sent
            securely to the backend and
            encrypted before being stored.
            They are never displayed back in
            this page.
          </p>
        </div>
      </div>

      {/* Alerts */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <WifiOff
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{success}</span>
        </div>
      )}

      {/* Configuration form */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[#20243A]">
            {editingAccountId
              ? "Update M-Pesa Account"
              : "Connect M-Pesa Account"}
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            {editingAccountId
              ? "Update account details or replace the API credentials."
              : "Enter the credentials provided by your M-Pesa/Daraja account administrator."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Account name */}

          <Field
            label="Account Name"
            required
            value={
              form.name
            }
            onChange={(
              value,
            ) =>
              updateForm(
                "name",
                value,
              )
            }
            placeholder="e.g. Ziya Main B2C"
            disabled={
              submitting
            }
          />

          {/* Shortcode */}

          <Field
            label="M-Pesa Shortcode"
            required
            value={
              form.shortcode
            }
            onChange={(
              value,
            ) =>
              updateForm(
                "shortcode",
                value,
              )
            }
            placeholder="e.g. 600000"
            disabled={
              submitting
            }
            inputMode="numeric"
          />

          {/* Environment */}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
              Environment{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <select
              value={
                form.environment
              }
              onChange={(
                event,
              ) =>
                updateForm(
                  "environment",
                  event.target
                    .value as MpesaEnvironment,
                )
              }
              disabled={
                submitting
              }
              className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#6D5DF6] disabled:bg-[#F8F9FC]"
            >
              <option value="sandbox">
                Sandbox
              </option>

              <option value="production">
                Production
              </option>
            </select>
          </div>

          {/* Account type */}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
              Account Type
            </label>

            <div className="flex h-[46px] items-center rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 text-sm font-medium text-[#20243A]">
              B2C
            </div>

            <p className="mt-1.5 text-xs text-[#8A8EA3]">
              This integration is configured
              for organization-to-recipient
              disbursements.
            </p>
          </div>

          {/* Consumer Key */}

          <Field
            label="Consumer Key"
            required={!editingAccountId}
            value={
              form.consumerKey
            }
            onChange={(
              value,
            ) =>
              updateForm(
                "consumerKey",
                value,
              )
            }
            placeholder={
              editingAccountId
                ? "Leave blank to keep existing key"
                : "Paste Consumer Key"
            }
            disabled={
              submitting
            }
            autoComplete="off"
          />

          {/* Consumer Secret */}

          <SecretField
            label="Consumer Secret"
            required={!editingAccountId}
            value={
              form.consumerSecret
            }
            visible={
              showConsumerSecret
            }
            onToggle={() =>
              setShowConsumerSecret(
                (value) =>
                  !value,
              )
            }
            onChange={(
              value,
            ) =>
              updateForm(
                "consumerSecret",
                value,
              )
            }
            placeholder={
              editingAccountId
                ? "Leave blank to keep existing secret"
                : "Paste Consumer Secret"
            }
            disabled={
              submitting
            }
          />

          {/* Initiator */}

          <Field
            label="Initiator Name"
            required
            value={
              form.initiatorName
            }
            onChange={(
              value,
            ) =>
              updateForm(
                "initiatorName",
                value,
              )
            }
            placeholder="Daraja initiator username"
            disabled={
              submitting
            }
            autoComplete="off"
          />

          {/* Security Credential */}

          <SecretField
            label="Security Credential"
            required={!editingAccountId}
            value={
              form.securityCredential
            }
            visible={
              showSecurityCredential
            }
            onToggle={() =>
              setShowSecurityCredential(
                (value) =>
                  !value,
              )
            }
            onChange={(
              value,
            ) =>
              updateForm(
                "securityCredential",
                value,
              )
            }
            placeholder={
              editingAccountId
                ? "Leave blank to keep existing credential"
                : "Paste Security Credential"
            }
            disabled={
              submitting
            }
          />

          {/* Default */}

          <div className="md:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-4">
              <input
                type="checkbox"
                checked={
                  form.isDefault
                }
                onChange={(
                  event,
                ) =>
                  updateForm(
                    "isDefault",
                    event.target
                      .checked,
                  )
                }
                disabled={
                  submitting
                }
                className="mt-1 h-4 w-4 accent-[#6D5DF6]"
              />

              <span>
                <span className="block text-sm font-semibold text-[#20243A]">
                  Make this the default
                  M-Pesa account
                </span>

                <span className="mt-1 block text-xs leading-5 text-[#666B84]">
                  The default account is used
                  when the organization needs
                  its primary B2C account.
                </span>
              </span>
            </label>
          </div>

          {/* Callback URLs */}

          <div className="md:col-span-2">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[#20243A]">
                Callback URLs
              </h3>

              <p className="mt-1 text-xs text-[#666B84]">
                These are generated automatically
                from the current Ziya FOS application
                address.
              </p>
            </div>

            <div className="space-y-3">
              <ReadOnlyField
                label="Result URL"
                value={
                  callbackUrls.resultUrl
                }
              />

              <ReadOnlyField
                label="Timeout URL"
                value={
                  callbackUrls.timeoutUrl
                }
              />
            </div>
          </div>
        </div>

        {/* Form actions */}

        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#ECECF3] pt-6 sm:flex-row sm:justify-end">
          {editingAccountId && (
            <button
              type="button"
              onClick={
                resetForm
              }
              disabled={
                submitting
              }
              className="rounded-xl border border-[#ECECF3] bg-white px-5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
            >
              Cancel Edit
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              void saveAccount()
            }
            disabled={
              submitting
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D5DF6] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5C4DE0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <Wifi
                size={17}
              />
            )}

            {submitting
              ? "Connecting..."
              : editingAccountId
                ? "Update & Connect"
                : "Save & Connect"}
          </button>
        </div>
      </div>

      {/* Existing accounts */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="border-b border-[#ECECF3] p-6">
          <h2 className="text-xl font-semibold text-[#20243A]">
            Connected M-Pesa Accounts
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            Manage the M-Pesa accounts connected
            to this organization.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#666B84]">
            <Loader2
              size={22}
              className="mx-auto mb-3 animate-spin"
            />

            Loading M-Pesa accounts...
          </div>
        ) : accounts.length ===
          0 ? (
          <div className="p-10 text-center">
            <Smartphone
              size={34}
              className="mx-auto text-[#6D5DF6]"
            />

            <p className="mt-3 font-medium text-[#20243A]">
              No M-Pesa account connected
            </p>

            <p className="mt-1 text-sm text-[#666B84]">
              Connect your organization's
              B2C M-Pesa account above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#ECECF3]">
            {accounts.map(
              (account) => (
                <div
                  key={
                    account.id
                  }
                  className="p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0EDFF]">
                        <Smartphone
                          size={21}
                          className="text-[#6D5DF6]"
                        />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#20243A]">
                            {
                              account.name
                            }
                          </h3>

                          {account.isDefault && (
                            <span className="rounded-full bg-[#F0EDFF] px-2.5 py-1 text-xs font-medium text-[#5C4DE0]">
                              Default
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              account.isActive
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {account.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-[#666B84] sm:grid-cols-3">
                          <span>
                            Shortcode:{" "}
                            <strong className="font-medium text-[#20243A]">
                              {
                                account.shortcode
                              }
                            </strong>
                          </span>

                          <span>
                            Type:{" "}
                            <strong className="font-medium text-[#20243A]">
                              {
                                account.accountType ||
                                "B2C"
                              }
                            </strong>
                          </span>

                          <span>
                            Environment:{" "}
                            <strong className="font-medium text-[#20243A]">
                              {
                                account.environment
                              }
                            </strong>
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-[#8A8EA3]">
                          Connected{" "}
                          {formatDate(
                            account.createdAt,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void testAccount(
                            account.id,
                          )
                        }
                        disabled={
                          testingAccountId ===
                            account.id ||
                          !account.isActive
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {testingAccountId ===
                        account.id ? (
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <Wifi
                            size={16}
                          />
                        )}

                        Test
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          startEditing(
                            account,
                          )
                        }
                        className="rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                      >
                        Edit
                      </button>

                      {!account.isDefault && (
                        <button
                          type="button"
                          onClick={() =>
                            void setDefaultAccount(
                              account.id,
                            )
                          }
                          className="rounded-xl bg-[#F0EDFF] px-4 py-2.5 text-sm font-medium text-[#5C4DE0] hover:bg-[#E8E4FF]"
                        >
                          Make Default
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          void toggleAccount(
                            account,
                          )
                        }
                        className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                          account.isActive
                            ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
                            : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                      >
                        {account.isActive
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Text field
|--------------------------------------------------------------------------
*/

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
        {label}{" "}
        {required && (
          <span className="text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type="text"
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        placeholder={
          placeholder
        }
        disabled={
          disabled
        }
        inputMode={
          inputMode
        }
        autoComplete={
          autoComplete
        }
        className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#9A9DAF] focus:border-[#6D5DF6] disabled:bg-[#F8F9FC] disabled:text-[#8A8EA3]"
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Secret field
|--------------------------------------------------------------------------
*/

function SecretField({
  label,
  value,
  visible,
  onToggle,
  onChange,
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#20243A]">
        {label}{" "}
        {required && (
          <span className="text-red-500">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          type={
            visible
              ? "text"
              : "password"
          }
          value={value}
          onChange={(
            event,
          ) =>
            onChange(
              event.target
                .value,
            )
          }
          placeholder={
            placeholder
          }
          disabled={
            disabled
          }
          autoComplete="new-password"
          className="w-full rounded-xl border border-[#ECECF3] bg-white px-4 py-3 pr-12 text-sm text-[#20243A] outline-none transition placeholder:text-[#9A9DAF] focus:border-[#6D5DF6] disabled:bg-[#F8F9FC] disabled:text-[#8A8EA3]"
        />

        <button
          type="button"
          onClick={
            onToggle
          }
          disabled={
            disabled
          }
          aria-label={
            visible
              ? `Hide ${label}`
              : `Show ${label}`
          }
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
        >
          {visible ? (
            <EyeOff
              size={18}
            />
          ) : (
            <Eye
              size={18}
            />
          )}
        </button>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Read-only callback field
|--------------------------------------------------------------------------
*/

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#666B84]">
        {label}
      </label>

      <input
        value={value}
        readOnly
        className="w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-4 py-3 text-xs text-[#666B84] outline-none"
      />
    </div>
  );
}