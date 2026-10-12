/**
 * Backend client. The frontend runs fully WITHOUT a backend — every call has a
 * timeout, try/catch, and a user-facing error. Nothing is fetched on app load.
 */

export const BACKEND_URL_KEY = 'roomvision.backendUrl';
export const DEFAULT_BACKEND_URL = 'https://roomvision-backend.onrender.com';

export function getBackendUrl(): string {
  try {
    return localStorage.getItem(BACKEND_URL_KEY) ?? DEFAULT_BACKEND_URL;
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

export function setBackendUrl(url: string): void {
  try {
    localStorage.setItem(BACKEND_URL_KEY, url.trim().replace(/\/+$/, ''));
  } catch {
    /* storage unavailable — backend calls will use the default */
  }
}

export class BackendError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
  }
}

interface RequestOptions {
  timeoutMs?: number;
  method?: 'GET' | 'POST';
  body?: BodyInit;
  contentType?: string;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15000, method = 'GET', body, contentType } = opts;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getBackendUrl()}${path}`, {
      method,
      body,
      signal: controller.signal,
      headers: contentType ? { 'Content-Type': contentType } : undefined,
    });
    if (!res.ok) {
      throw new BackendError(`Server responded with ${res.status}.`, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof BackendError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new BackendError('The request timed out. Is the backend server running?');
    }
    throw new BackendError(
      'Could not reach the backend server. Check the backend URL in Settings and make sure the server is running.',
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export async function healthCheck(): Promise<{ ok: boolean; version?: string }> {
  try {
    return await request<{ ok: boolean; version?: string }>('/api/health', { timeoutMs: 5000 });
  } catch (err) {
    if (err instanceof BackendError) throw err;
    throw new BackendError('Health check failed.');
  }
}

/* ------------------------------------------------------------------ */
/* Phase 4 stubs — backend sync (project backup, share links).         */
/* These are deliberate seams for a later phase; they are not wired    */
/* to any UI in Phase 1.                                              */
/* ------------------------------------------------------------------ */

/** Phase 4: push a saved project to the backend for cross-device backup. */
export async function syncProjectToBackend(_projectId: string): Promise<void> {
  throw new BackendError('Backend project sync is not implemented yet (Phase 4).');
}

/** Phase 4: fetch the user's backed-up projects from the backend. */
export async function listBackendProjects(): Promise<never[]> {
  throw new BackendError('Backend project listing is not implemented yet (Phase 4).');
}
