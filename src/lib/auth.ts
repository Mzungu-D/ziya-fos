import {
  authenticatedFetch as canonicalAuthenticatedFetch,
  clearSession,
  getSession,
  getToken,
  storeSession,
  type AuthSession,
} from "./auth-session";

/* =========================================================
   TYPES
========================================================= */

export type SessionType =
  | "PLATFORM"
  | "TENANT";

export interface AuthenticatedSession {
  token: string;
  sessionType?: SessionType;
  user?: unknown;
  organization?: unknown;
  organizations?: unknown;
  rememberMe?: boolean;
}

/* =========================================================
   AUTH TOKEN
========================================================= */

export function getAuthToken():
  | string
  | null {
  return getToken();
}

/* =========================================================
   SESSION TYPE
========================================================= */

export function getSessionType():
  | SessionType
  | null {
  const session =
    getSession();

  if (!session) {
    return null;
  }

  if (
    session.sessionType ===
      "PLATFORM" ||
    session.sessionType ===
      "TENANT"
  ) {
    return session.sessionType;
  }

  return null;
}

/* =========================================================
   CLEAR AUTHENTICATED SESSION
========================================================= */

export function clearAuthenticatedSession(): void {
  clearSession();
}

/* =========================================================
   PERSISTENCE
========================================================= */

export function isPersistentSession(): boolean {
  const session =
    getSession();

  return (
    session?.rememberMe === true
  );
}

/* =========================================================
   STORE AUTHENTICATED SESSION
========================================================= */

export function storeAuthenticatedSession(
  session: AuthenticatedSession,
  rememberMe: boolean
): void {
  if (!session.token) {
    throw new Error(
      "The server returned an invalid access session."
    );
  }

  if (
    session.sessionType !==
      "PLATFORM" &&
    session.sessionType !==
      "TENANT"
  ) {
    throw new Error(
      "The server returned an invalid session type."
    );
  }

  /*
   * Prefer the JWT expiry when available.
   * Fall back to one hour if unavailable.
   */
  let expiresAt =
    Date.now() +
    60 * 60 * 1000;

  try {
    const parts =
      session.token.split(".");

    if (parts.length === 3) {
      const payload =
        parts[1];

      if (payload) {
        const base64 =
          payload
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(
              payload.length +
                ((4 -
                  (payload.length %
                    4)) %
                  4),
              "="
            );

        const decoded =
          JSON.parse(
            atob(base64)
          ) as {
            exp?: unknown;
          };

        if (
          typeof decoded.exp ===
          "number"
        ) {
          expiresAt =
            decoded.exp * 1000;
        }
      }
    }
  } catch {
    /*
     * Keep the safe fallback expiry.
     */
  }

  const user =
    session.user &&
    typeof session.user ===
      "object"
      ? (session.user as Record<
          string,
          unknown
        >)
      : {};

  const authSession: AuthSession = {
    token:
      session.token,

    expiresAt,

    rememberMe,

    sessionType:
      session.sessionType,

    user: {
      id:
        typeof user.id ===
        "string"
          ? user.id
          : "",

      email:
        typeof user.email ===
        "string"
          ? user.email
          : "",

      name:
        typeof user.name ===
        "string"
          ? user.name
          : "",

      platformRole:
        typeof user.platformRole ===
        "string"
          ? user.platformRole
          : null,

      organizationId:
        typeof user.organizationId ===
        "string"
          ? user.organizationId
          : null,

      organizationRole:
        typeof user.organizationRole ===
        "string"
          ? user.organizationRole
          : null,
    },
  };

  storeSession(
    authSession
  );
}

/* =========================================================
   UPDATE TENANT SESSION
========================================================= */

/**
 * Update the active tenant context after the
 * organization switch has been authorized by
 * the backend.
 *
 * This preserves the existing authenticated
 * session and changes only the tenant context.
 *
 * IMPORTANT:
 * The server remains responsible for authorizing
 * the organization switch and issuing the new token.
 */
export function updateTenantSession(
  token: string,
  organization: unknown
): void {
  const currentSession =
    getSession();

  if (!currentSession) {
    throw new Error(
      "No authenticated session exists."
    );
  }

  if (!token) {
    throw new Error(
      "The server returned an invalid organization session."
    );
  }

  let organizationId:
    | string
    | null =
    currentSession.user
      .organizationId ??
    null;

  if (
    organization &&
    typeof organization ===
      "object"
  ) {
    const organizationObject =
      organization as Record<
        string,
        unknown
      >;

    if (
      typeof organizationObject.id ===
      "string"
    ) {
      organizationId =
        organizationObject.id;
    }

    if (
      typeof organizationObject.organizationId ===
      "string"
    ) {
      organizationId =
        organizationObject.organizationId;
    }
  }

  const updatedSession: AuthSession = {
    ...currentSession,

    token,

    sessionType:
      "TENANT",

    user: {
      ...currentSession.user,

      organizationId,
    },
  };

  storeSession(
    updatedSession
  );
}

/* =========================================================
   AUTHORIZATION HEADER
========================================================= */

export function getAuthorizationHeader(): Record<
  string,
  string
> {
  const token =
    getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization:
      `Bearer ${token}`,
  };
}

/* =========================================================
   AUTHENTICATED FETCH
========================================================= */

/**
 * All authenticated HTTP requests ultimately
 * use the canonical implementation in
 * auth-session.ts.
 *
 * This preserves the corrected Headers handling
 * implemented there.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  return canonicalAuthenticatedFetch(
    input,
    init
  );
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getAuthToken,
  getSessionType,
  clearAuthenticatedSession,
  isPersistentSession,
  storeAuthenticatedSession,
  updateTenantSession,
  getAuthorizationHeader,
  authenticatedFetch,
};