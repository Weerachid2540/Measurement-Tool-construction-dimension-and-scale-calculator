import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { MeasurementSession, SessionFilter, StoredFile } from '@/types';

const DB_NAME = 'measurement-tool';
const DB_VERSION = 1;

interface MeasurementDB extends DBSchema {
  sessions: {
    key: string;
    value: MeasurementSession;
    indexes: { 'by-updatedAt': number; 'by-name': string };
  };
  files: {
    key: string;
    value: StoredFile;
  };
}

let dbPromise: Promise<IDBPDatabase<MeasurementDB>> | null = null;

function getDb(): Promise<IDBPDatabase<MeasurementDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MeasurementDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('by-updatedAt', 'updatedAt');
          store.createIndex('by-name', 'name');
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function putSession(session: MeasurementSession): Promise<void> {
  const db = await getDb();
  await db.put('sessions', session);
}

export async function getSession(id: string): Promise<MeasurementSession | undefined> {
  const db = await getDb();
  return db.get('sessions', id);
}

export async function getAllSessions(): Promise<MeasurementSession[]> {
  const db = await getDb();
  const sessions = await db.getAllFromIndex('sessions', 'by-updatedAt');
  return sessions.reverse();
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  const session = await db.get('sessions', id);
  const tx = db.transaction(['sessions', 'files'], 'readwrite');
  await tx.objectStore('sessions').delete(id);
  if (session?.fileRef) await tx.objectStore('files').delete(session.fileRef);
  await tx.done;
}

export async function clearAllSessions(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'files'], 'readwrite');
  await tx.objectStore('sessions').clear();
  await tx.objectStore('files').clear();
  await tx.done;
}

export async function putFile(file: StoredFile): Promise<void> {
  const db = await getDb();
  await db.put('files', file);
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  const db = await getDb();
  return db.get('files', id);
}

/** Client-side filtering — the history set is small enough that indexes buy nothing. */
export function filterSessions(
  sessions: MeasurementSession[],
  filter: SessionFilter,
): MeasurementSession[] {
  const query = filter.query.trim().toLowerCase();

  const filtered = sessions.filter((session) => {
    if (filter.kind !== 'all' && session.documentKind !== filter.kind) return false;
    if (filter.from !== undefined && session.updatedAt < filter.from) return false;
    if (filter.to !== undefined && session.updatedAt > filter.to) return false;
    if (!query) return true;
    const haystack = [
      session.name,
      session.projectName,
      session.documentName,
      session.notes ?? '',
      session.tags.join(' '),
      `1:${session.scale.ratio}`,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  const direction = filter.sortDir === 'asc' ? 1 : -1;
  return filtered.sort((a, b) => {
    if (filter.sortBy === 'name') return a.name.localeCompare(b.name) * direction;
    return (a[filter.sortBy] - b[filter.sortBy]) * direction;
  });
}

/** JSON backup of the whole history. Blobs are omitted — only measurement data travels. */
export async function exportSessionsJson(): Promise<string> {
  const sessions = await getAllSessions();
  return JSON.stringify(
    { app: 'measurement-tool', version: DB_VERSION, exportedAt: Date.now(), sessions },
    null,
    2,
  );
}

export async function importSessionsJson(json: string): Promise<number> {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { sessions?: unknown }).sessions)
  ) {
    throw new Error('ไฟล์สำรองไม่ถูกต้อง');
  }
  const sessions = (parsed as { sessions: MeasurementSession[] }).sessions;
  const db = await getDb();
  const tx = db.transaction('sessions', 'readwrite');
  // Queue every put before awaiting, otherwise the transaction auto-commits mid-loop.
  // The stale file reference is dropped — a JSON backup carries no blobs.
  await Promise.all([
    ...sessions.map((session) => tx.store.put({ ...session, fileRef: undefined })),
    tx.done,
  ]);
  return sessions.length;
}
