import { CommissionFooter } from "./CommissionFooter";
import { DownloadPromo } from "./DownloadPromo";
import {
  formatSessionDate,
  MAX_SESSIONS,
  type SessionListItem,
} from "../lib/storage";

interface HomeScreenProps {
  sessions: SessionListItem[];
  loading: boolean;
  restoringId: string | null;
  onNewImport: () => void;
  onOpenSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
}

export function HomeScreen({
  sessions,
  loading,
  restoringId,
  onNewImport,
  onOpenSession,
  onDeleteSession,
}: HomeScreenProps) {
  return (
    <div className="home">
      <header className="home-header">
        <h1>PDF Diff</h1>
        <button
          type="button"
          className="primary"
          onClick={onNewImport}
          disabled={loading}
        >
          ＋ 新規取り込み
        </button>
      </header>

      <main className="home-main">
        <div className="home-main-head">
          <h2>取り込み履歴</h2>
          <p className="home-sub">
            過去に取り込んだ PDF の比較を開くか、新規取り込みで比較を始められます（最大{" "}
            {MAX_SESSIONS} 件）。
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="home-empty">
            <p>まだ取り込み履歴がありません。</p>
            <button type="button" className="primary" onClick={onNewImport} disabled={loading}>
              新規取り込みを始める
            </button>
          </div>
        ) : (
          <ul className="home-history-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={restoringId === s.id ? "active" : ""}
                  onClick={() => onOpenSession(s.id)}
                  disabled={loading}
                >
                  <span className="history-date">{formatSessionDate(s.updatedAt)}</span>
                  <span className="history-files">
                    {s.fileNameA} ↔ {s.fileNameB}
                  </span>
                  <span className="history-meta">
                    {s.compareSummary
                      ? `差分 ${s.compareSummary.totalChanges} 文字 · ${s.compareSummary.rows.length} 組`
                      : "未比較"}
                    {" · "}一致率 {s.matchThresholdPercent}%
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="履歴を削除"
                  onClick={(e) => onDeleteSession(s.id, e)}
                  disabled={loading}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <DownloadPromo />
      <CommissionFooter />
    </div>
  );
}
