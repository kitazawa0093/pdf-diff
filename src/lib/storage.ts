import type { CompareResult, PageAlignKind } from "./types";
import { cloneArrayBuffer } from "./loadPdf";

const DB_NAME = "pdf-diff";
const DB_VERSION = 1;
const STORE_SESSIONS = "sessions";
const STORE_BOOKMARKS = "bookmarks";
export const MAX_SESSIONS = 50;

export interface CompareSummary {
  totalChanges: number;
  pageCountA: number;
  pageCountB: number;
  rows: {
    id: number;
    label: string;
    kind: PageAlignKind;
    changeCount: number;
  }[];
}

export interface StoredSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  fileNameA: string;
  fileNameB: string;
  pdfA: ArrayBuffer;
  pdfB: ArrayBuffer;
  matchThresholdPercent: number;
  compareSummary: CompareSummary | null;
}

export interface SessionListItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  fileNameA: string;
  fileNameB: string;
  matchThresholdPercent: number;
  compareSummary: CompareSummary | null;
}

export interface StoredBookmark {
  id: string;
  sessionId: string;
  rowId: number;
  rowLabel: string;
  note: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB を開けません"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const sessions = db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
        sessions.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(STORE_BOOKMARKS)) {
        const bookmarks = db.createObjectStore(STORE_BOOKMARKS, { keyPath: "id" });
        bookmarks.createIndex("sessionId", "sessionId");
      }
    };
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB の読み書きに失敗しました"));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const outcome = fn(store);
    const result = outcome instanceof Promise ? await outcome : await runRequest(outcome);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB トランザクションに失敗しました"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("IndexedDB トランザクションが中断されました"));
    });
    return result;
  } finally {
    db.close();
  }
}

function compareSummaryFromResult(result: CompareResult): CompareSummary {
  return {
    totalChanges: result.totalChanges,
    pageCountA: result.pageCountA,
    pageCountB: result.pageCountB,
    rows: result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind,
      changeCount: row.diff.changeCount,
    })),
  };
}

export function summaryFromCompare(result: CompareResult): CompareSummary {
  return compareSummaryFromResult(result);
}

export async function listSessions(): Promise<SessionListItem[]> {
  const all = await withStore<StoredSession[]>(STORE_SESSIONS, "readonly", (store) =>
    store.getAll(),
  );
  return all
    .map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      fileNameA: s.fileNameA,
      fileNameB: s.fileNameB,
      matchThresholdPercent: s.matchThresholdPercent,
      compareSummary: s.compareSummary,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSession(id: string): Promise<StoredSession | null> {
  try {
    return await withStore<StoredSession | undefined>(STORE_SESSIONS, "readonly", (store) =>
      store.get(id),
    ).then((row) => row ?? null);
  } catch {
    return null;
  }
}

async function pruneOldSessions(): Promise<void> {
  const items = await listSessions();
  if (items.length <= MAX_SESSIONS) return;
  for (const item of items.slice(MAX_SESSIONS)) {
    await deleteSession(item.id);
  }
}

export async function upsertSession(input: {
  id?: string;
  fileNameA: string;
  fileNameB: string;
  pdfA: ArrayBuffer;
  pdfB: ArrayBuffer;
  matchThresholdPercent: number;
  compareSummary?: CompareSummary | null;
}): Promise<string> {
  const now = Date.now();
  const existing = input.id ? await getSession(input.id) : null;
  const id = input.id ?? crypto.randomUUID();
  const record: StoredSession = {
    id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    fileNameA: input.fileNameA,
    fileNameB: input.fileNameB,
    pdfA: cloneArrayBuffer(input.pdfA),
    pdfB: cloneArrayBuffer(input.pdfB),
    matchThresholdPercent: input.matchThresholdPercent,
    compareSummary:
      input.compareSummary !== undefined
        ? input.compareSummary
        : (existing?.compareSummary ?? null),
  };
  await withStore(STORE_SESSIONS, "readwrite", (store) => store.put(record));
  await pruneOldSessions();
  return id;
}

export async function deleteSession(id: string): Promise<void> {
  await withStore(STORE_SESSIONS, "readwrite", (store) => store.delete(id));
  const bookmarks = await listBookmarksForSession(id);
  for (const b of bookmarks) {
    await withStore(STORE_BOOKMARKS, "readwrite", (store) => store.delete(b.id));
  }
}

export async function listBookmarksForSession(
  sessionId: string,
): Promise<StoredBookmark[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_BOOKMARKS, "readonly");
    const store = tx.objectStore(STORE_BOOKMARKS);
    const rows = await runRequest(store.index("sessionId").getAll(sessionId));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return rows.sort((a, b) => a.rowId - b.rowId || a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

export async function addBookmark(input: {
  sessionId: string;
  rowId: number;
  rowLabel: string;
  note?: string;
}): Promise<StoredBookmark> {
  const record: StoredBookmark = {
    id: crypto.randomUUID(),
    sessionId: input.sessionId,
    rowId: input.rowId,
    rowLabel: input.rowLabel,
    note: input.note?.trim() ?? "",
    createdAt: Date.now(),
  };
  await withStore(STORE_BOOKMARKS, "readwrite", (store) => store.put(record));
  return record;
}

export async function removeBookmark(id: string): Promise<void> {
  await withStore(STORE_BOOKMARKS, "readwrite", (store) => store.delete(id));
}

export async function findBookmark(
  sessionId: string,
  rowId: number,
): Promise<StoredBookmark | null> {
  const list = await listBookmarksForSession(sessionId);
  return list.find((b) => b.rowId === rowId) ?? null;
}

export function formatSessionDate(ts: number): string {
  return new Date(ts).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
