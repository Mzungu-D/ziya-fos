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
  // Clean up tokens written by older releases as part of the migration.
  "accessToken",
  "refreshToken",
] as const;

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function getSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function tokenHasExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;

    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: unknown };

    return typeof decoded.exp === "number" && decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function clearAuthenticatedSession() {
  const persistent = getStorage();
  const temporary = getSessionStorage();

  for (const key of SESSION_KEYS) {
    persistent?.removeItem(key);
    temporary?.removeItem(key);
  }
}

export function getAuthToken(): string | null {
  const persistent = getStorage();
  const temporary = getSessionStorage();
  const token = persistent?.getItem("token") ?? temporary?.getItem("token");

  if (!token) return null;

  if (tokenHasExpired(token)) {
    clearAuthenticatedSession();
    return null;
  }

  return token;
}

export function getSessionType(): SessionType | null {
  const persistent = getStorage();
  const temporary = getSessionStorage();
  const type = persistent?.getItem("sessionType") ?? temporary?.getItem("sessionType");

  return type === "PLATFORM" || type === "TENANT" ? type : null;
}

export function isPersistentSession(): boolean {
  return Boolean(getStorage()?.getItem("token"));
}

export function storeAuthenticatedSession(
  session: AuthenticatedSession,
  rememberMe: boolean
) {
  if (!session.token || tokenHasExpired(session.token)) {
    throw new Error("The server returned an invalid access session.");
  }

  clearAuthenticatedSession();

  const storage = rememberMe ? getStorage() : getSessionStorage();
  if (!storage) return;

  storage.setItem("token", session.token);
  if (session.sessionType) storage.setItem("sessionType", session.sessionType);
  if (session.user) storage.setItem("user", JSON.stringify(session.user));
  if (session.organization) storage.setItem("organization", JSON.stringify(session.organization));
  if (session.organizations) storage.setItem("organizations", JSON.stringify(session.organizations));
}

/** Replaces only the tenant context after the server has authorized a switch. */
export function updateTenantSession(
  token: string,
  organization: unknown
) {
  if (!token || tokenHasExpired(token)) {
    throw new Error("The server returned an invalid organization session.");
  }

  const storage = isPersistentSession() ? getStorage() : getSessionStorage();
  if (!storage) return;

  storage.setItem("token", token);
  storage.setItem("sessionType", "TENANT");
  storage.setItem("organization", JSON.stringify(organization));
}

export function getAuthorizationHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Use this for every authenticated browser request. It guarantees that both
 * remembered and browser-session logins attach the same bearer token.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...getAuthorizationHeader(),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401) {
    clearAuthenticatedSession();
    window.dispatchEvent(new Event("ziya:session-expired"));
  }

  return response;
}
