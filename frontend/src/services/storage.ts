/**
 * IndexedDB persistence for saved room designs.
 * Images live in IndexedDB (NOT localStorage) because they are far too large.
 */
import type { EditorState } from '../types';
import { uuid } from '../utils/common';

const DB_NAME = 'roomvision-ai-studio';
const DB_VERSION = 1;
const STORE = 'projects';

export interface SavedProject {
  id: string;
  name: string;
  originalBlob: Blob;
  editState: EditorState;
  thumbnailBlob: Blob;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMeta {
  id: string;
  name: string;
  thumbnailBlob: Blob;
  createdAt: number;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(req.error?.message ?? 'Failed to open local database.'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        let result: T | undefined;
        let failed = false;
        let failureReason = '';
        const req = run(store);
        req.onsuccess = () => {
          result = req.result as T;
        };
        req.onerror = () => {
          failed = true;
          failureReason = req.error?.message ?? 'request failed';
        };
        transaction.oncomplete = () => {
          db.close();
          // "saved" is only reported after the transaction completes.
          if (failed) reject(new Error(failureReason));
          else resolve(result as T);
        };
        transaction.onerror = () => {
          db.close();
          reject(new Error(transaction.error?.message ?? failureReason ?? 'transaction failed'));
        };
        transaction.onabort = () => {
          db.close();
          reject(new Error('Save was aborted.'));
        };
      }),
  );
}

export async function saveProject(input: {
  id?: string;
  name: string;
  originalBlob: Blob;
  editState: EditorState;
  thumbnailBlob: Blob;
}): Promise<SavedProject> {
  const now = Date.now();
  const id = input.id ?? uuid();
  const record: SavedProject = {
    id,
    name: input.name.trim() || 'Untitled Room Design',
    originalBlob: input.originalBlob,
    editState: input.editState,
    thumbnailBlob: input.thumbnailBlob,
    createdAt: now,
    updatedAt: now,
  };
  // Preserve createdAt when overwriting an existing project.
  const existing = await getProject(id).catch(() => undefined);
  if (existing) record.createdAt = existing.createdAt;
  await tx('readwrite', (store) => store.put(record));
  return record;
}

export async function getProject(id: string): Promise<SavedProject | undefined> {
  return tx('readonly', (store) => store.get(id));
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = await tx<SavedProject[]>('readonly', (store) => store.getAll());
  return (all ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      thumbnailBlob: p.thumbnailBlob,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const existing = await getProject(id);
  if (!existing) throw new Error('Project not found.');
  existing.name = name.trim() || 'Untitled Room Design';
  existing.updatedAt = Date.now();
  await tx('readwrite', (store) => store.put(existing));
}

export async function deleteProject(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id));
}

/** Wipes every saved design. Caller must confirm with the user first. */
export async function deleteAllProjects(): Promise<void> {
  await tx('readwrite', (store) => store.clear());
}
