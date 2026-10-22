const ACCESS_KEY = "laniakea.access";
const REFRESH_KEY = "laniakea.refresh";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getAccess() {
  return storage()?.getItem(ACCESS_KEY) ?? null;
}
export function getRefresh() {
  return storage()?.getItem(REFRESH_KEY) ?? null;
}
export function setTokens(access: string, refresh: string) {
  storage()?.setItem(ACCESS_KEY, access);
  storage()?.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  storage()?.removeItem(ACCESS_KEY);
  storage()?.removeItem(REFRESH_KEY);
}
