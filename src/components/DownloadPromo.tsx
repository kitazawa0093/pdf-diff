import {
  FREE_DOWNLOAD_LABEL,
  freeDownloadHref,
  hasFreeDownloadLink,
  hasPaidDownloadLink,
  PAID_DOWNLOAD_LABEL,
  paidDownloadHref,
  showDownloadPromo,
} from "../lib/distribution";

export function DownloadPromo() {
  if (!showDownloadPromo()) return null;

  return (
    <aside className="download-promo" role="complementary">
      <p className="download-promo-lead">
        いまは<strong>ブラウザ版</strong>（無料・3ページまで）です。PC版はインストール後も同じ
        パスワードで Pro になります。
      </p>
      <p className="download-promo-links">
        {hasPaidDownloadLink() && (
          <a href={paidDownloadHref()} target="_blank" rel="noopener noreferrer">
            {PAID_DOWNLOAD_LABEL} →
          </a>
        )}
        {hasFreeDownloadLink() && (
          <a href={freeDownloadHref()} target="_blank" rel="noopener noreferrer">
            {FREE_DOWNLOAD_LABEL} →
          </a>
        )}
      </p>
    </aside>
  );
}
