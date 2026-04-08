const TOKEN_KEY = "action_pages_admin_token";

export function getToken(): string {
  try {
    return typeof window !== "undefined" ? (localStorage.getItem(TOKEN_KEY) ?? "") : "";
  } catch {
    return "";
  }
}

export function setToken(value: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, value);
  } catch {
    // Private browsing or storage disabled — token won't persist
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
