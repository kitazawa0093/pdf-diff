/** Tauri デスクトップビルドか（Web 公開時は未設定） */
export function isTauriApp(): boolean {
  return Boolean(import.meta.env.TAURI_ENV_PLATFORM);
}

export const PAID_DOWNLOAD_LABEL =
  (import.meta.env.VITE_PAID_DOWNLOAD_LABEL as string | undefined)?.trim() ||
  "有料PC版はこちら（全ページ・BOOTH）";

const PAID_DOWNLOAD_URL =
  (import.meta.env.VITE_PAID_DOWNLOAD_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BOOTH_URL as string | undefined)?.trim() ||
  "";

export const FREE_DOWNLOAD_LABEL =
  (import.meta.env.VITE_FREE_DOWNLOAD_LABEL as string | undefined)?.trim() ||
  "無料PC版をダウンロード（3ページまで）";

const FREE_DOWNLOAD_URL =
  (import.meta.env.VITE_FREE_DOWNLOAD_URL as string | undefined)?.trim() || "";

export function paidDownloadHref(): string {
  return PAID_DOWNLOAD_URL;
}

export function freeDownloadHref(): string {
  return FREE_DOWNLOAD_URL;
}

/** Web 版に「ダウンロード版はこちら」を出す */
export function showDownloadPromo(): boolean {
  return !isTauriApp() && Boolean(PAID_DOWNLOAD_URL || FREE_DOWNLOAD_URL);
}

export function hasPaidDownloadLink(): boolean {
  return !isTauriApp() && Boolean(PAID_DOWNLOAD_URL);
}

export function hasFreeDownloadLink(): boolean {
  return !isTauriApp() && Boolean(FREE_DOWNLOAD_URL);
}

/** BOOTH / 有料ダウンロード（同一 URL） */
export function getBoothStoreUrl(): string {
  return PAID_DOWNLOAD_URL;
}

const WEB_APP_URL =
  (import.meta.env.VITE_WEB_APP_URL as string | undefined)?.trim() || "";

export function getWebAppUrl(): string {
  return WEB_APP_URL;
}

export function showWebAppLink(): boolean {
  return isTauriApp() && Boolean(WEB_APP_URL);
}
