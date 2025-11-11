const AUTH_STORAGE_KEY = 'tms-auth-session';
const LOGIN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

type StoredAuth = {
  username: string;
  timestamp: number;
};

function getStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredAuth;
  } catch (error) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function persistAuth(auth: StoredAuth) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  const auth = getStoredAuth();

  if (!auth) {
    return false;
  }

  const isExpired = Date.now() - auth.timestamp > LOGIN_EXPIRATION_MS;

  if (isExpired) {
    clearAuth();
    return false;
  }

  return true;
}

export function login(username: string, password: string): boolean {
  const isValid = username === 'admin' && password === 'password';

  if (!isValid) {
    return false;
  }

  persistAuth({ username, timestamp: Date.now() });
  return true;
}
