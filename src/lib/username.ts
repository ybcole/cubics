export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_RULES = `${USERNAME_MIN}-${USERNAME_MAX} characters. Letters, numbers, dots and underscores.`;

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._]*$/;

export function normalizeUsername(raw: string): string {
  return raw.trim();
}

/** Case-insensitive key used for the global uniqueness check. */
export function usernameKey(username: string): string {
  return normalizeUsername(username).toLowerCase();
}

/** Format rules only (safe for the client). Returns an error message or null. */
export function validateUsernameFormat(raw: unknown): string | null {
  if (typeof raw !== "string") return "Enter a username";
  const name = normalizeUsername(raw);
  if (name.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters`;
  if (name.length > USERNAME_MAX) return `Use at most ${USERNAME_MAX} characters`;
  if (!USERNAME_RE.test(name)) return "Use letters, numbers, dots and underscores only";
  if (/[._]{2,}/.test(name) || /[._]$/.test(name)) return "No repeated or trailing dots and underscores";
  return null;
}
