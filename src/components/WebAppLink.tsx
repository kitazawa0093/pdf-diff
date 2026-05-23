import { getWebAppUrl, showWebAppLink } from "../lib/distribution";

/** デスクトップ版から Web 版への導線 */
export function WebAppLink() {
  if (!showWebAppLink()) return null;

  return (
    <a
      className="toolbar-web-link"
      href={getWebAppUrl()}
      target="_blank"
      rel="noopener noreferrer"
      title="ブラウザで使う（共有・お試し）"
    >
      Web版
    </a>
  );
}
