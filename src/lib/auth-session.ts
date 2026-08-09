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

function getStorage(
  rememberMe: boolean
): Storage {
  return rememberMe
    ? localStorage
    : sessionStorage;
}

export function storeSession(
  session: AuthSession
) {
  const storage =
    getStorage(
      session.rememberMe
    );

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

export function getSession():
  | AuthSession
  | null {
  const local =
    localStorage.getItem(
      AUTH_STORAGE_KEY
    );

  if (local) {
    return JSON.parse(local);
  }

  const session =
    sessionStorage.getItem(
      AUTH_STORAGE_KEY
    );

  if (session) {
    return JSON.parse(session);
  }

  return null;
}

export function getToken():
  | string
  | null {
  return (
    getSession()?.token ??
    null
  );
}
export function isSessionExpired(): boolean {
  const session = getSession();

  if (!session) {
    return true;
  }

  return Date.now() >= session.expiresAt;
}

export function clearSession() {
  localStorage.removeItem(
    AUTH_STORAGE_KEY
  );

  sessionStorage.removeItem(
    AUTH_STORAGE_KEY
  );
}

export function isAuthenticated(): boolean {
  if (isSessionExpired()) {
    clearSession();
    return false;
  }

  return getSession() !== null;
}

export function isPlatformSession(): boolean {
  const session = getSession();

  if (!session) {
    return false;
  }

  return (
    session.sessionType ===
    "PLATFORM"
  );
}

export function isTenantSession(): boolean {
  const session = getSession();

  if (!session) {
    return false;
  }

  return (
    session.sessionType ===
    "TENANT"
  );
}

export function getCurrentUser() {
  return getSession()?.user ?? null;
}

export function getPlatformRole() {
  return (
    getSession()?.user
      .platformRole ?? null
  );
}
export function requireAuthenticatedSession(): AuthSession {
  if (!isAuthenticated()) {
    clearSession();

    window.location.replace("/login");

    throw new Error(
      "Authentication required."
    );
  }

  return getSession()!;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const session =
    requireAuthenticatedSession();

  const response =
    await fetch(input, {
      ...init,

      headers: {
        Authorization: `Bearer ${session.token}`,

        ...(init.headers ?? {}),
      },
    });

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

export function refreshSession(
  session: AuthSession
) {
  storeSession(session);
}

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