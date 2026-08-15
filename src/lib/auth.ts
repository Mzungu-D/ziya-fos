export type SessionType = "PLATFORM" | "TENANT";

export interface AuthenticatedSession {
  token: string;
  sessionType?: SessionType;
  user?: unknown;
  organization?: unknown;
  organizations?: unknown;
  rememberMe?: boolean;
}

const AUTH_STORAGE_KEY = "ziya.auth.session";

const SESSION_KEYS = [
  "token",
  "sessionType",
  "user",
  "organization",
  "organizations",
  "accessToken",
  "refreshToken",
] as const;

function getStorage(): Storage | null {
  return typeof window === "undefined"
    ? null
    : window.localStorage;
}

function getSessionStorage(): Storage | null {
  return typeof window === "undefined"
    ? null
    : window.sessionStorage;
}

/**
 * Read the canonical Ziya authentication session.
 *
 * The application stores the authenticated session under
 * "ziya.auth.session". Depending on Remember Me, that
 * session can live in localStorage or sessionStorage.
 */
function getCanonicalSession(): {
  token?: string;
  sessionType?: SessionType;
  user?: unknown;
  organization?: unknown;
  organizations?: unknown;
  rememberMe?: boolean;
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  const persistent = getStorage();
  const temporary = getSessionStorage();

  const raw =
    persistent?.getItem(AUTH_STORAGE_KEY) ??
    temporary?.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as {
      token?: string;
      sessionType?: SessionType;
      user?: unknown;
      organization?: unknown;
      organizations?: unknown;
      rememberMe?: boolean;
    };
  } catch {
    return null;
  }
}

function decodeJwtPayload(
  token: string
): {
  exp?: unknown;
  sessionType?: unknown;
  organizationId?: unknown;
} | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];

    if (!payload) {
      return null;
    }

    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(
        payload.length +
          ((4 - (payload.length % 4)) % 4),
        "="
      );

    return JSON.parse(atob(base64)) as {
      exp?: unknown;
      sessionType?: unknown;
      organizationId?: unknown;
    };
  } catch {
    return null;
  }
}

function tokenHasExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);

  if (!payload) {
    return true;
  }

  /*
   * If the JWT does not contain an exp claim,
   * allow the server to determine its validity.
   */
  if (typeof payload.exp !== "number") {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
}

export function clearAuthenticatedSession(): void {
  const persistent = getStorage();
  const temporary = getSessionStorage();

  /*
   * Clear the legacy/direct authentication values.
   */
  for (const key of SESSION_KEYS) {
    persistent?.removeItem(key);
    temporary?.removeItem(key);
  }

  /*
   * Also clear the canonical Ziya session.
   *
   * This is important because the application can otherwise
   * appear logged in through ziya.auth.session while an API
   * helper has already cleared the legacy token.
   */
  persistent?.removeItem(AUTH_STORAGE_KEY);
  temporary?.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Return the active authentication token.
 *
 * Supports both authentication storage formats:
 *
 * 1. Direct "token" storage
 * 2. Canonical "ziya.auth.session" storage
 *
 * Both localStorage and sessionStorage are supported.
 */
export function getAuthToken(): string | null {
  const persistent = getStorage();
  const temporary = getSessionStorage();

  /*
   * First check the direct/legacy token storage.
   */
  const directToken =
    persistent?.getItem("token") ??
    temporary?.getItem("token");

  if (directToken) {
    if (tokenHasExpired(directToken)) {
      clearAuthenticatedSession();
      return null;
    }

    return directToken;
  }

  /*
   * Fall back to the canonical Ziya session.
   */
  const canonicalSession =
    getCanonicalSession();

  const canonicalToken =
    canonicalSession?.token;

  if (!canonicalToken) {
    return null;
  }

  if (tokenHasExpired(canonicalToken)) {
    clearAuthenticatedSession();
    return null;
  }

  return canonicalToken;
}

export function getSessionType(): SessionType | null {
  const persistent = getStorage();
  const temporary = getSessionStorage();

  /*
   * First check the direct session type.
   */
  const directType =
    persistent?.getItem("sessionType") ??
    temporary?.getItem("sessionType");

  if (
    directType === "PLATFORM" ||
    directType === "TENANT"
  ) {
    return directType;
  }

  /*
   * Fall back to the canonical Ziya session.
   */
  const canonicalSession =
    getCanonicalSession();

  if (
    canonicalSession?.sessionType === "PLATFORM" ||
    canonicalSession?.sessionType === "TENANT"
  ) {
    return canonicalSession.sessionType;
  }

  return null;
}

export function isPersistentSession(): boolean {
  return Boolean(
    getStorage()?.getItem("token") ||
      getStorage()?.getItem(AUTH_STORAGE_KEY)
  );
}

export function storeAuthenticatedSession(
  session: AuthenticatedSession,
  rememberMe: boolean
): void {
  if (
    !session.token ||
    tokenHasExpired(session.token)
  ) {
    throw new Error(
      "The server returned an invalid access session."
    );
  }

  clearAuthenticatedSession();

  const storage = rememberMe
    ? getStorage()
    : getSessionStorage();

  if (!storage) {
    throw new Error(
      "Browser storage is unavailable."
    );
  }

  /*
   * Keep the direct values for compatibility with
   * existing components that still use them.
   */
  storage.setItem(
    "token",
    session.token
  );

  if (session.sessionType) {
    storage.setItem(
      "sessionType",
      session.sessionType
    );
  }

  if (session.user) {
    storage.setItem(
      "user",
      JSON.stringify(session.user)
    );
  }

  if (session.organization) {
    storage.setItem(
      "organization",
      JSON.stringify(session.organization)
    );
  }

  if (session.organizations) {
    storage.setItem(
      "organizations",
      JSON.stringify(session.organizations)
    );
  }

  /*
   * Also maintain the canonical Ziya session so both
   * authentication helpers remain synchronized.
   */
  storage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      token: session.token,
      sessionType: session.sessionType,
      user: session.user,
      organization: session.organization,
      organizations: session.organizations,
      rememberMe,
    })
  );
}

/**
 * Replace only the active tenant context after
 * the server has authorized an organization switch.
 */
export function updateTenantSession(
  token: string,
  organization: unknown
): void {
  if (
    !token ||
    tokenHasExpired(token)
  ) {
    throw new Error(
      "The server returned an invalid organization session."
    );
  }

  const storage =
    isPersistentSession()
      ? getStorage()
      : getSessionStorage();

  if (!storage) {
    throw new Error(
      "Browser storage is unavailable."
    );
  }

  storage.setItem(
    "token",
    token
  );

  storage.setItem(
    "sessionType",
    "TENANT"
  );

  storage.setItem(
    "organization",
    JSON.stringify(organization)
  );

  /*
   * Keep the canonical session synchronized with
   * the newly selected tenant.
   */
  const existingSession =
    getCanonicalSession();

  storage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...(existingSession ?? {}),
      token,
      sessionType: "TENANT",
      organization,
    })
  );
}

export function getAuthorizationHeader(): Record<
  string,
  string
> {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Central authenticated request helper.
 *
 * Supports:
 * - localStorage sessions
 * - sessionStorage sessions
 * - canonical ziya.auth.session sessions
 *
 * The active token is always applied LAST so that a stale
 * Authorization header supplied by an individual component
 * cannot override the current authenticated session.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();

  if (!token) {
    clearAuthenticatedSession();

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new Event("ziya:session-expired")
      );
    }

    throw new Error(
      "Authentication required. Please sign in."
    );
  }

  const headers = new Headers(
    init.headers
  );

  /*
   * Always use the current authenticated session token.
   */
  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  const response = await fetch(
    input,
    {
      ...init,
      headers,
    }
  );

  /*
   * A 401 means the server no longer accepts
   * the current authenticated session.
   */
  if (response.status === 401) {
    clearAuthenticatedSession();

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new Event("ziya:session-expired")
      );
    }
  }

  return response;
}
