import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { storeAuthenticatedSession } from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

type Invitation = {
  email: string;
  role: string;
  expiresAt: string;
  access?: {
    modules: string[];
    actions: string[];
  };

  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  };
};

type ApiError = {
  message?: string;
  code?: string;
};

type AcceptResponse = {
  success: boolean;
  message?: string;

  token: string;

  sessionType: "TENANT";

  rememberMe?: boolean;

  user: {
    id: string;
    email: string;
    name: string;

    phoneNumber?: string | null;

    organizationId: string;
    organizationRole: string;

    /*
     * These permissions come from the organization
     * membership created from the invitation.
     */
    permissions: string[];
  };

  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  };

  membership?: {
    id: string;
    organizationId: string;
    role: string;
    permissions: string[];
  };
};

/* =========================================================
   HELPERS
========================================================= */

function formatRole(role: string): string {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatExpiry(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Limited time";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Normalize a Kenyan phone number into the format
 * expected by the authentication system.
 *
 * Examples:
 *
 * 0712345678  -> +254712345678
 * 0112345678  -> +254112345678
 * 712345678   -> +254712345678
 * +254712345678 -> +254712345678
 */
function normalizeKenyanPhone(value: string): string {
  const input = value.trim();

  if (!input) {
    return "";
  }

  if (input.startsWith("+254")) {
    return `+254${input.slice(4).replace(/\D/g, "")}`;
  }

  if (input.startsWith("254")) {
    return `+${input.replace(/\D/g, "")}`;
  }

  if (input.startsWith("0")) {
    const localNumber = input.replace(/\D/g, "").slice(1);

    if (localNumber.length === 9) {
      return `+254${localNumber}`;
    }
  }

  const digits = input.replace(/\D/g, "");

  if (digits.length === 9) {
    return `+254${digits}`;
  }

  return input;
}

/**
 * Basic Kenyan mobile number validation.
 *
 * We deliberately keep this validation on the client
 * lightweight. The backend remains authoritative.
 */
function isValidKenyanPhone(value: string): boolean {
  const normalized = normalizeKenyanPhone(value);

  return /^\+254(?:7\d{8}|1\d{8})$/.test(normalized);
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [invitation, setInvitation] =
    useState<Invitation | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  /* =======================================================
     FORM STATE
  ======================================================= */

  const [name, setName] =
    useState("");

  const [phoneNumber, setPhoneNumber] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const passwordMismatch = useMemo(
    () =>
      confirmPassword.length > 0 &&
      password !== confirmPassword,
    [password, confirmPassword]
  );

  /* =========================================================
     LOAD INVITATION
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setError(
          "This invitation link is invalid."
        );

        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/invitations/${encodeURIComponent(token)}`
        );

        const data =
          (await response.json().catch(() => null)) as
            | { invitation: Invitation }
            | ApiError
            | null;

        if (!response.ok) {
          const message =
            data &&
            "message" in data &&
            data.message
              ? data.message
              : "This invitation is no longer available.";

          throw new Error(message);
        }

        if (!cancelled) {
          if (
            !data ||
            !("invitation" in data)
          ) {
            throw new Error(
              "Unable to load this invitation."
            );
          }

          setInvitation(data.invitation);

          setName("");
          setPhoneNumber("");
          setPassword("");
          setConfirmPassword("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this invitation."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* =========================================================
     ACCEPT INVITATION
  ========================================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!token || !invitation) {
      return;
    }

    setError("");

    const trimmedName =
      name.trim();

    const normalizedPhone =
      normalizeKenyanPhone(phoneNumber);

    /* =======================================================
       NAME VALIDATION
    ======================================================= */

    if (trimmedName.length < 2) {
      setError(
        "Please enter your full name."
      );
      return;
    }

    if (trimmedName.length > 120) {
      setError(
        "Your name is too long."
      );
      return;
    }

    /* =======================================================
       PHONE VALIDATION

       Phone is required because invited users must be able
       to use phone-number login after onboarding.
    ======================================================= */

    if (!phoneNumber.trim()) {
      setError(
        "Please enter your phone number."
      );
      return;
    }

    if (!isValidKenyanPhone(phoneNumber)) {
      setError(
        "Please enter a valid Kenyan phone number, for example +254 712 345 678."
      );
      return;
    }

    /* =======================================================
       PASSWORD VALIDATION
    ======================================================= */

    if (password.length < 8) {
      setError(
        "Your password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Your passwords do not match."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/invitations/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            name: trimmedName,

            /*
             * Always send the normalized phone number.
             *
             * This is important because future phone login
             * searches for the canonical phone value.
             */
            phoneNumber:
              normalizedPhone,

            password,
          }),
        }
      );

      const data =
        (await response.json().catch(() => null)) as
          | AcceptResponse
          | ApiError
          | null;

      if (!response.ok) {
        const message =
          data &&
          "message" in data &&
          data.message
            ? data.message
            : "Unable to accept this invitation.";

        throw new Error(message);
      }

      /* =====================================================
         VALIDATE TENANT SESSION
      ===================================================== */

      if (
        !data ||
        !("token" in data) ||
        !data.token ||
        data.sessionType !== "TENANT"
      ) {
        throw new Error(
          "The server returned an invalid tenant session."
        );
      }

      if (
        !("user" in data) ||
        !data.user ||
        !Array.isArray(data.user.permissions)
      ) {
        throw new Error(
          "The server did not return the permissions for this organization."
        );
      }

      /* =====================================================
         STORE AUTHENTICATED TENANT SESSION

         This is critical.

         The sidebar and route guards use the permissions
         stored here to determine which modules the user
         can see and access.
      ===================================================== */

      storeAuthenticatedSession(
        {
          token: data.token,

          sessionType:
            "TENANT",

          user: {
            id: data.user.id,

            email:
              data.user.email,

            name:
              data.user.name,

            phoneNumber:
              data.user.phoneNumber ??
              normalizedPhone,

            organizationId:
              data.user.organizationId,

            organizationRole:
              data.user.organizationRole,

            permissions:
              data.user.permissions,
          },

          organization:
            data.organization,
        },

        data.rememberMe === true
      );

      /* =====================================================
         SUCCESS
      ===================================================== */

      setSuccess(true);

      window.setTimeout(() => {
        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to accept this invitation."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================
     LOADING STATE
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F9FC] flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-[#667085]">
          <Loader2 className="h-5 w-5 animate-spin" />

          Checking your invitation...
        </div>
      </main>
    );
  }

  /* =========================================================
     SUCCESS STATE
  ========================================================= */

  if (success) {
    return (
      <main className="min-h-screen bg-[#F8F9FC] flex items-center justify-center px-6">
        <section className="w-full max-w-md rounded-2xl border border-[#E7E9F0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF3]">
            <CheckCircle2 className="h-7 w-7 text-[#16A34A]" />
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-[#20243A]">
            Welcome to{" "}
            {invitation?.organization.name}
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Your account is ready.
            Taking you to your
            financial workspace...
          </p>
        </section>
      </main>
    );
  }

  /* =========================================================
     ERROR / INVALID INVITATION
  ========================================================= */

  if (error || !invitation) {
    return (
      <main className="min-h-screen bg-[#F8F9FC] flex items-center justify-center px-6">
        <section className="w-full max-w-md rounded-2xl border border-[#E7E9F0] bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF2F2]">
            <ShieldCheck className="h-6 w-6 text-[#DC2626]" />
          </div>

          <h1 className="mt-5 text-center text-2xl font-semibold text-[#20243A]">
            Invitation unavailable
          </h1>

          <p className="mt-2 text-center text-sm leading-6 text-[#667085]">
            {error ||
              "This invitation link is invalid or has expired."}
          </p>

          <Link
            to="/login"
            className="mt-6 flex h-11 items-center justify-center rounded-xl bg-[#20243A] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  /* =========================================================
     INVITATION FORM
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#F8F9FC] px-5 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-3xl border border-[#E7E9F0] bg-white shadow-[0_20px_70px_rgba(32,36,58,0.08)] lg:grid-cols-[0.9fr_1.1fr]">

          {/* =================================================
              DESKTOP BRAND PANEL
          ================================================= */}

          <div className="hidden bg-[#20243A] p-10 text-white lg:block">
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-3">
                {invitation.organization.logoUrl ? (
                  <img
                    src={
                      invitation.organization.logoUrl
                    }
                    alt=""
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}

                <span className="font-semibold">
                  {invitation.organization.name}
                </span>
              </div>

              <div className="mt-auto">
                <p className="text-sm font-medium text-white/60">
                  Ziya FOS
                </p>

                <h2 className="mt-3 text-3xl font-semibold leading-tight">
                  Your financial workspace starts here.
                </h2>

                <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">
                  Join your organization&apos;s
                  secure financial operating
                  system and access the modules
                  assigned to your role.
                </p>
              </div>
            </div>
          </div>

          {/* =================================================
              FORM PANEL
          ================================================= */}

          <div className="p-7 sm:p-10">
            <div className="mx-auto max-w-md">

              {/* Mobile organization header */}

              <div className="lg:hidden">
                <div className="flex items-center gap-3">
                  {invitation.organization.logoUrl ? (
                    <img
                      src={
                        invitation.organization.logoUrl
                      }
                      alt=""
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F8]">
                      <Building2 className="h-5 w-5 text-[#20243A]" />
                    </div>
                  )}

                  <span className="font-semibold text-[#20243A]">
                    {invitation.organization.name}
                  </span>
                </div>
              </div>

              <div className="mt-8 lg:mt-0">
                <p className="text-sm font-medium text-[#A98220]">
                  You&apos;ve been invited
                </p>

                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#20243A]">
                  Set up your account
                </h1>

                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  Complete your details to join{" "}
                  <span className="font-semibold text-[#20243A]">
                    {invitation.organization.name}
                  </span>
                  .
                </p>
              </div>

              {/* =================================================
                  INVITATION DETAILS
              ================================================= */}

              <div className="mt-6 rounded-2xl border border-[#E7E9F0] bg-[#FAFBFD] p-4">

                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-[#667085]" />

                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                      Invited email
                    </p>

                    <p className="mt-1 break-all text-sm font-semibold text-[#20243A]">
                      {invitation.email}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-[#667085]" />

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                      Assigned role
                    </p>

                    <p className="mt-1 text-sm font-semibold text-[#20243A]">
                      {formatRole(
                        invitation.role
                      )}
                    </p>
                  </div>
                </div>

                {invitation.access && (
                  <div className="mt-5 border-t border-[#E7E9F0] pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">
                      Workspace access
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-[#344054]">
                      {invitation.access.modules.map((module) => (
                        <li key={module} className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A98220]" />
                          <span>{module}</span>
                        </li>
                      ))}
                    </ul>
                    {invitation.access.actions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">Assigned actions</p>
                        <ul className="mt-2 space-y-1.5 text-sm text-[#344054]">
                          {invitation.access.actions.map((action) => (
                            <li key={action} className="flex items-start gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#667085]" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="mt-3 text-xs leading-5 text-[#98A2B3]">
                      Your workspace will enforce this access after you accept the invitation.
                    </p>
                  </div>
                )}

                <p className="mt-4 text-xs text-[#98A2B3]">
                  Invitation expires{" "}
                  {formatExpiry(
                    invitation.expiresAt
                  )}
                  .
                </p>
              </div>

              {/* =================================================
                  ERROR
              ================================================= */}

              {error && (
                <div className="mt-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm leading-5 text-[#B91C1C]">
                  {error}
                </div>
              )}

              {/* =================================================
                  FORM
              ================================================= */}

              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-5"
              >

                {/* FULL NAME */}

                <div>
                  <label
                    htmlFor="invite-name"
                    className="mb-2 block text-sm font-medium text-[#344054]"
                  >
                    Full name
                  </label>

                  <input
                    id="invite-name"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    autoComplete="name"
                    required
                    maxLength={120}
                    placeholder="Your full name"
                    className="h-12 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/10"
                  />
                </div>

                {/* PHONE */}

                <div>
                  <label
                    htmlFor="invite-phone"
                    className="mb-2 block text-sm font-medium text-[#344054]"
                  >
                    Phone number
                    <span className="ml-1 font-normal text-[#DC2626]">
                      required
                    </span>
                  </label>

                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />

                    <input
                      id="invite-phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(event) =>
                        setPhoneNumber(
                          event.target.value
                        )
                      }
                      autoComplete="tel"
                      required
                      inputMode="tel"
                      placeholder="+254 712 345 678"
                      className="h-12 w-full rounded-xl border border-[#D0D5DD] bg-white pl-11 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/10"
                    />
                  </div>

                  <p className="mt-2 text-xs leading-5 text-[#98A2B3]">
                    This number will also be used
                    when signing in with your phone
                    number and receiving verification
                    codes.
                  </p>
                </div>

                {/* PASSWORD */}

                <div>
                  <label
                    htmlFor="invite-password"
                    className="mb-2 block text-sm font-medium text-[#344054]"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />

                    <input
                      id="invite-password"
                      type="password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      autoComplete="new-password"
                      minLength={8}
                      required
                      placeholder="Create a secure password"
                      className="h-12 w-full rounded-xl border border-[#D0D5DD] bg-white pl-11 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/10"
                    />
                  </div>

                  <p className="mt-2 text-xs text-[#98A2B3]">
                    Minimum 8 characters.
                  </p>
                </div>

                {/* CONFIRM PASSWORD */}

                <div>
                  <label
                    htmlFor="invite-confirm-password"
                    className="mb-2 block text-sm font-medium text-[#344054]"
                  >
                    Confirm password
                  </label>

                  <input
                    id="invite-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                    placeholder="Repeat your password"
                    className="h-12 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/10"
                  />

                  {passwordMismatch && (
                    <p className="mt-2 text-xs text-[#B91C1C]">
                      Passwords do not match.
                    </p>
                  )}
                </div>

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    passwordMismatch
                  }
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#20243A] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />

                      Creating your workspace
                      access...
                    </>
                  ) : (
                    "Accept invitation"
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs leading-5 text-[#98A2B3]">
                By accepting this invitation,
                you will receive access to the
                organization shown above according
                to your assigned role and
                permissions.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}