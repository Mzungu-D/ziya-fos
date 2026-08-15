export type SessionType = "PLATFORM" | "TENANT";

export interface AuthenticatedSession {
  token: string;
  sessionType?: SessionType;
  user?: unknown;
  organization?: unknown;
  organizations?: unknown;
}

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

function getStoredValue(key: string): string | null {
  const persistent = getStorage();
  const temporary = getSessionStorage();

  return (
    persistent?.getItem(key) ??
    temporary?.getItem(key) ??
    null
  );
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

  for (const key of SESSION_KEYS) {
    persistent?.removeItem(key);
    temporary?.removeItem(key);
  }
}

export function getAuthToken(): string | null {
  const token = getStoredValue("token");

  if (!token) {
    return null;
  }

  if (tokenHasExpired(token)) {
    clearAuthenticatedSession();
    return null;
  }

  return token;
}

export function getSessionType(): SessionType | null {
  const type = getStoredValue("sessionType");

  if (
    type === "PLATFORM" ||
    type === "TENANT"
  ) {
    return type;
  }

  /*
   * Do not infer tenant access from local browser data.
   * The server remains the authority for the active
   * organization and authorization.
   */
  return null;
}

export function isPersistentSession(): boolean {
  return Boolean(
    getStorage()?.getItem("token")
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
 * IMPORTANT:
 * - Reads the active token from localStorage OR sessionStorage.
 * - localStorage is used when "Remember me" is enabled.
 * - sessionStorage is used when "Remember me" is disabled.
 * - Always sends the current token as a Bearer token.
 * - The individual page must NOT read localStorage directly.
 * - The individual page must NOT create its own Authorization header.
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
   * Always use the active authenticated session.
   *
   * This works for both:
   *   localStorage  → Remember me checked
   *   sessionStorage → Remember me unchecked
   *
   * The current token is deliberately applied LAST so
   * an old/stale Authorization header cannot override it.
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
   * A 401 means the server no longer accepts the
   * authenticated session. Clear both storage locations
   * so the application cannot continue using stale
   * credentials.
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