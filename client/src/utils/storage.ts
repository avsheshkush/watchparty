const CLIENT_ID_KEY = "watchparty_client_id";
const USERNAME_KEY = "watchparty_username";

/**
 * Returns a stable unique client ID stored in localStorage.
 * Generated once per browser/device.
 */
export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = "c_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getSavedUsername(): string {
  return localStorage.getItem(USERNAME_KEY) || "";
}

export function saveUsername(username: string): void {
  if (username && username.trim()) {
    localStorage.setItem(USERNAME_KEY, username.trim());
  }
}
