import {
  authenticatedFetch as canonicalAuthenticatedFetch,
  clearSession,
  getSession,
  getToken,
  storeSession,
  type AuthSession,
} from "./auth-session";

export type SessionType = "PLATFORM" | "TENANT";

export interface AuthenticatedSession {
  token: string;
  sessionType?: SessionType;
  user?: unknown;
  organization?: unknown;
  organizations?: unknown;
  rememberMe?: boolean;
}

/**
 * Return the active authenticated token.
 *
 * The canonical authentication system is auth-session.ts.
 * It handles both localStorage and sessionStorage and is
 * therefore the single source of truth for authentication.
 */
export function getAuthToken(): string | null {
  return getToken();
}

/**
 * Return the current session type.
 */
export function getSessionType(): SessionType | null {
  const session = getSession();

  if (!session) {
    return null;
  }

  if (
    session.sessionType === "PLATFORM" ||
    session.sessionType === "TENANT"
  ) {
    return session.sessionType;
  }

  return null;
}

/**
 * Clear the complete authenticated session.
 *
 * This delegates to the canonical authentication system so
 * localStorage and sessionStorage are cleared consistently.
 */
export function clearAuthenticatedSession(): void {
  clearSession();
}

/**
 * Determine whether the active session is persistent.
 *
 * Remember Me sessions are stored in localStorage.
 */
export function isPersistentSession(): boolean {
  const session = getSession();

  return session?.rememberMe === true;
}

/**
 * Store an authenticated session using the canonical
 * Ziya authentication session.
 */
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
    session.sessionType !== "PLATFORM" &&
    session.sessionType !== "TENANT"
  ) {
    throw new Error(
      "The server returned an invalid session type."
    );
  }

  /*
   * The canonical session requires an expiry timestamp.
   *
   * Prefer the JWT expiry when available. If the token does
   * not expose an expiry, use a one-hour session fallback.
   */
  let expiresAt =
    Date.now() + 60 * 60 * 1000;

  try {
    const parts =
      session.token.split(".");

    if (parts.length === 3) {
      const payload = parts[1];

      if (payload) {
        const base64 =
          payload
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(
              payload.length +
                ((4 -
                  (payload.length % 4)) %
                  4),
              "="
            );

        const decoded = JSON.parse(
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
    typeof session.user === "object"
      ? (session.user as Record<
          string,
          unknown
        >)
      : {};

  const authSession: AuthSession = {
    token: session.token,

    expiresAt,

    rememberMe,

    sessionType:
      session.sessionType,

    user: {
      id:
        typeof user.id === "string"
          ? user.id
          : "",

      email:
        typeof user.email === "string"
          ? user.email
          : "",

      name:
        typeof user.name === "string"
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

  storeSession(authSession);
}

/**
 * Replace the active tenant context after the server has
 * authorized an organization switch.
 *
 * The existing authenticated session is preserved and only
 * the tenant context is changed.
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

    sessionType: "TENANT",

    user: {
      ...currentSession.user,

      organizationId,
    },
  };

  storeSession(updatedSession);
}

/**
 * Return the Authorization header for the current
 * authenticated session.
 */
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

/**
 * Central authenticated request helper.
 *
 * IMPORTANT:
 * This deliberately delegates to auth-session.ts.
 *
 * There is now ONE authentication implementation for the
 * entire application instead of two competing implementations.
 *
 * Therefore:
 *
 * Remember Me ON
 *     -> localStorage
 *
 * Remember Me OFF
 *     -> sessionStorage
 *
 * Both use:
 *
 * ziya.auth.session
 *     -> session.token
 *     -> Authorization: Bearer <token>
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