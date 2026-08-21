export const AUTH_STORAGE_KEY =
  "ziya.auth.session";

export type SessionType =
  | "PLATFORM"
  | "TENANT";

export interface AuthSession {
  token: string;

  expiresAt: number;

  rememberMe: boolean;

  sessionType: SessionType;

  user: {
    id: string;
    email: string;
    name: string;

    platformRole?: string | null;

    organizationId?: string | null;

    organizationRole?: string | null;
  };
}

/* =========================================================
   STORAGE
========================================================= */

function getStorage(
  rememberMe: boolean
): Storage {
  return rememberMe
    ? localStorage
    : sessionStorage;
}

/* =========================================================
   STORE SESSION
========================================================= */

export function storeSession(
  session: AuthSession
) {
  const storage =
    getStorage(
      session.rememberMe
    );

  /*
   * Never allow both storage locations
   * to contain an active Ziya session.
   */
  localStorage.removeItem(
    AUTH_STORAGE_KEY
  );

  sessionStorage.removeItem(
    AUTH_STORAGE_KEY
  );

  storage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(session)
  );
}

/* =========================================================
   GET SESSION
========================================================= */

export function getSession():
  | AuthSession
  | null {
  const local =
    localStorage.getItem(
      AUTH_STORAGE_KEY
    );

  if (local) {
    try {
      return JSON.parse(
        local
      ) as AuthSession;
    } catch {
      localStorage.removeItem(
        AUTH_STORAGE_KEY
      );
    }
  }

  const session =
    sessionStorage.getItem(
      AUTH_STORAGE_KEY
    );

  if (session) {
    try {
      return JSON.parse(
        session
      ) as AuthSession;
    } catch {
      sessionStorage.removeItem(
        AUTH_STORAGE_KEY
      );
    }
  }

  return null;
}

/* =========================================================
   TOKEN
========================================================= */

export function getToken():
  | string
  | null {
  return (
    getSession()?.token ??
    null
  );
}

/* =========================================================
   SESSION EXPIRY
========================================================= */

export function isSessionExpired(): boolean {
  const session =
    getSession();

  if (!session) {
    return true;
  }

  return (
    Date.now() >=
    session.expiresAt
  );
}

/* =========================================================
   CLEAR SESSION
========================================================= */

export function clearSession() {
  localStorage.removeItem(
    AUTH_STORAGE_KEY
  );

  sessionStorage.removeItem(
    AUTH_STORAGE_KEY
  );
}

/* =========================================================
   AUTHENTICATION STATE
========================================================= */

export function isAuthenticated(): boolean {
  if (isSessionExpired()) {
    clearSession();

    return false;
  }

  return (
    getSession() !== null
  );
}

/* =========================================================
   SESSION TYPE HELPERS
========================================================= */

export function isPlatformSession(): boolean {
  const session =
    getSession();

  if (!session) {
    return false;
  }

  return (
    session.sessionType ===
    "PLATFORM"
  );
}

export function isTenantSession(): boolean {
  const session =
    getSession();

  if (!session) {
    return false;
  }

  return (
    session.sessionType ===
    "TENANT"
  );
}

/* =========================================================
   CURRENT USER
========================================================= */

export function getCurrentUser() {
  return (
    getSession()?.user ??
    null
  );
}

/* =========================================================
   PLATFORM ROLE
========================================================= */

export function getPlatformRole() {
  return (
    getSession()?.user
      .platformRole ??
    null
  );
}

/* =========================================================
   REQUIRE AUTHENTICATED SESSION
========================================================= */

export function requireAuthenticatedSession(): AuthSession {
  if (!isAuthenticated()) {
    clearSession();

    window.location.replace(
      "/login"
    );

    throw new Error(
      "Authentication required."
    );
  }

  return getSession()!;
}

/* =========================================================
   AUTHENTICATED FETCH
========================================================= */

/*
 * This is the critical request wrapper.
 *
 * RequestInit.headers can be:
 *
 * - Headers
 * - Record<string, string>
 * - [string, string][]
 *
 * Therefore we MUST NOT spread init.headers
 * directly into a normal object.
 *
 * We normalize everything through the native
 * Headers class first.
 *
 * This preserves:
 *
 * - Content-Type
 * - Accept
 * - Authorization
 * - custom headers
 * - JSON request bodies
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const session =
    requireAuthenticatedSession();

  /*
   * Normalize all incoming headers.
   */
  const headers =
    new Headers(
      init.headers
    );

  /*
   * Always use the authenticated
   * session token.
   */
  headers.set(
    "Authorization",
    `Bearer ${session.token}`
  );

  const response =
    await fetch(
      input,
      {
        ...init,
        headers,
      }
    );

  /*
   * A 401 means the server rejected
   * the current authentication session.
   */
  if (
    response.status === 401
  ) {
    clearSession();

    window.location.replace(
      "/login"
    );

    throw new Error(
      "Session expired."
    );
  }

  return response;
}

/* =========================================================
   ORGANIZATION HELPERS
========================================================= */

export function getOrganizationId():
  | string
  | null {
  return (
    getSession()?.user
      .organizationId ??
    null
  );
}

export function getOrganizationRole():
  | string
  | null {
  return (
    getSession()?.user
      .organizationRole ??
    null
  );
}

/* =========================================================
   PLATFORM SESSION
========================================================= */

export function requirePlatformSession(): AuthSession {
  const session =
    requireAuthenticatedSession();

  if (
    session.sessionType !==
    "PLATFORM"
  ) {
    throw new Error(
      "Platform session required."
    );
  }

  return session;
}

/* =========================================================
   TENANT SESSION
========================================================= */

export function requireTenantSession(): AuthSession {
  const session =
    requireAuthenticatedSession();

  if (
    session.sessionType !==
    "TENANT"
  ) {
    throw new Error(
      "Tenant session required."
    );
  }

  return session;
}

/* =========================================================
   PLATFORM ROLE CHECK
========================================================= */

export function hasPlatformRole(
  role = "PLATFORM_ADMIN"
): boolean {
  const session =
    getSession();

  if (!session) {
    return false;
  }

  return (
    session.sessionType ===
      "PLATFORM" &&
    session.user.platformRole ===
      role
  );
}

/* =========================================================
   REFRESH SESSION
========================================================= */

export function refreshSession(
  session: AuthSession
) {
  storeSession(
    session
  );
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  storeSession,
  getSession,
  getToken,
  clearSession,
  isAuthenticated,
  isSessionExpired,
  authenticatedFetch,
  requireAuthenticatedSession,
  requirePlatformSession,
  requireTenantSession,
  hasPlatformRole,
  getCurrentUser,
  getPlatformRole,
  getOrganizationId,
  getOrganizationRole,
  refreshSession,
};