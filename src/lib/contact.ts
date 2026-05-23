/** 表示文言（未設定時のデフォルト） */
export const COMMISSION_LABEL =
  (import.meta.env.VITE_COMMISSION_LABEL as string | undefined)?.trim() ||
  "開発のご相談を承ります";

const COMMISSION_URL =
  (import.meta.env.VITE_COMMISSION_URL as string | undefined)?.trim() || "";

const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || "";

export function hasCommissionContact(): boolean {
  return Boolean(COMMISSION_URL || CONTACT_EMAIL);
}

export function commissionHref(): string {
  if (COMMISSION_URL) return COMMISSION_URL;
  if (CONTACT_EMAIL) {
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("PDF Diff 開発のご相談")}`;
  }
  return "";
}
