const STORAGE_KEY = "pdf-diff-pro-unlocked";

/** ビルド時に VITE_PRO_PASSWORD で設定（購入者へメールで同じ文言を送る） */
function expectedProPassword(): string {
  const fromEnv = (import.meta.env.VITE_PRO_PASSWORD as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "pdf-diff-dev-pro";
  return "";
}

export function verifyProPassword(input: string): boolean {
  const expected = expectedProPassword();
  if (!expected) return false;
  const actual = input.trim();
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function isProActive(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function tryUnlockPro(
  password: string,
): { ok: true } | { ok: false; error: string } {
  if (!expectedProPassword()) {
    return {
      ok: false,
      error: "Pro 版パスワードが未設定です（配布ビルドに VITE_PRO_PASSWORD が必要です）。",
    };
  }
  if (!password.trim()) {
    return { ok: false, error: "パスワードを入力してください。" };
  }
  if (!verifyProPassword(password)) {
    return { ok: false, error: "パスワードが正しくありません。" };
  }
  localStorage.setItem(STORAGE_KEY, "1");
  return { ok: true };
}

export function clearProUnlock(): void {
  localStorage.removeItem(STORAGE_KEY);
}
