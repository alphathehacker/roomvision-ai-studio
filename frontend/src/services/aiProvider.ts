/**
 * AI provider seam — server-side room segmentation.
 *
 * Talks to the configured backend (`/api/health` capability probe, then
 * `POST /api/segment-room`). The backend returns per-category regions with
 * bounding boxes (measured on the original image); this module converts
 * them to normalized polygon rectangles the editor can refine.
 *
 * It must NEVER report success without real data: every failure path
 * resolves { available: false } with an honest, user-facing message.
 */
import { getBackendUrl } from './api';
import type { NormPoint } from '../types';

export interface AiSegmentationUnavailable {
  available: false;
  message: string;
}

export interface AiSegmentationSuccess {
  available: true;
  /** detected regions as editable polygons, in normalized coordinates */
  masks: { category: 'wall' | 'ceiling' | 'floor'; label: string; points: NormPoint[] }[];
}

export type AiSegmentationResult = AiSegmentationUnavailable | AiSegmentationSuccess;

const UNAVAILABLE_MESSAGE =
  "AI segmentation isn't enabled on the server yet. Use manual polygon selection for now.";
const SEGMENT_TIMEOUT_MS = 120000; // Render cold start + model inference can be slow
const HEALTH_TIMEOUT_MS = 10000;

interface Region {
  label?: string;
  bbox?: [number, number, number, number];
  coverage?: number;
  score?: number | null;
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => window.clearTimeout(timer) };
}

async function checkBackend(): Promise<{ reachable: boolean; aiConfigured: boolean }> {
  const { signal, done } = withTimeout(HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${getBackendUrl()}/api/health`, { signal });
    if (!res.ok) return { reachable: false, aiConfigured: false };
    const data = (await res.json()) as { ai_configured?: boolean };
    return { reachable: true, aiConfigured: data.ai_configured === true };
  } catch {
    return { reachable: false, aiConfigured: false };
  } finally {
    done();
  }
}

function bboxToPolygon(bbox: [number, number, number, number], imgW: number, imgH: number): NormPoint[] {
  const [x, y, w, h] = bbox;
  const x0 = Math.min(Math.max(x / imgW, 0), 1);
  const y0 = Math.min(Math.max(y / imgH, 0), 1);
  const x1 = Math.min(Math.max((x + w) / imgW, 0), 1);
  const y1 = Math.min(Math.max((y + h) / imgH, 0), 1);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

async function readErrorMessage(res: Response): Promise<string | null> {
  try {
    const data = (await res.json()) as { error?: string; detail?: string };
    const msg = data.error || data.detail || null;
    return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Attempt server-side room segmentation. Resolves { available: false } unless
 * the backend genuinely returns usable region data. Every failure path is
 * user-facing.
 */
export async function tryAiSegmentation(imageBlob: Blob): Promise<AiSegmentationResult> {
  const backendUrl = getBackendUrl();

  // 1. Capability probe — distinguishes "server down" from "AI not enabled".
  const health = await checkBackend();
  if (!health.reachable) {
    return {
      available: false,
      message:
        `Could not reach the backend server at ${backendUrl}. ` +
        'The free hosting tier sleeps when idle — try again in a minute, or check the backend URL in Settings.',
    };
  }
  if (!health.aiConfigured) {
    return { available: false, message: UNAVAILABLE_MESSAGE };
  }

  // 2. Real segmentation request.
  const { signal, done } = withTimeout(SEGMENT_TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append('image', imageBlob, 'room.jpg');
    const res = await fetch(`${backendUrl}/api/segment-room`, {
      method: 'POST',
      body: form,
      signal,
    });

    if (res.status === 503) {
      const msg = await readErrorMessage(res);
      return {
        available: false,
        message: msg && /not configured/i.test(msg)
          ? UNAVAILABLE_MESSAGE
          : msg ?? 'The segmentation service is unavailable right now. Try again shortly.',
      };
    }
    if (res.status === 502 || res.status === 504 || res.status === 429) {
      const msg = await readErrorMessage(res);
      return {
        available: false,
        message:
          msg ??
          `Segmentation failed (server responded ${res.status}). Try again in a minute, or use manual polygon selection.`,
      };
    }
    if (!res.ok) {
      const msg = await readErrorMessage(res);
      return {
        available: false,
        message:
          msg ??
          `AI segmentation failed (server responded ${res.status}). Use manual polygon selection for now.`,
      };
    }

    const data = (await res.json()) as {
      regions?: Region[];
      image_size?: [number, number];
    };
    const regions = Array.isArray(data.regions) ? data.regions : [];
    const [imgW, imgH] = Array.isArray(data.image_size) ? data.image_size : [0, 0];
    if (!imgW || !imgH) {
      return {
        available: false,
        message: 'The server returned an unreadable segmentation result. Use manual polygon selection for now.',
      };
    }

    const counts: Record<string, number> = {};
    const masks: AiSegmentationSuccess['masks'] = [];
    for (const r of regions) {
      const label = (r.label ?? '').toLowerCase();
      if (label !== 'wall' && label !== 'ceiling' && label !== 'floor') continue;
      if (!Array.isArray(r.bbox) || r.bbox.length !== 4) continue;
      if (typeof r.coverage === 'number' && r.coverage < 0.01) continue; // noise
      const points = bboxToPolygon(r.bbox, imgW, imgH);
      counts[label] = (counts[label] ?? 0) + 1;
      const n = counts[label];
      masks.push({
        category: label,
        label: `AI ${label}${n > 1 ? ` ${n}` : ''}`,
        points,
      });
    }

    if (masks.length === 0) {
      return {
        available: false,
        message:
          'The AI found no clear wall, ceiling, or floor regions in this photo. Use manual polygon selection for now.',
      };
    }
    return { available: true, masks };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        available: false,
        message:
          'The segmentation request timed out (the server may have been waking up). Try again in a minute, or use manual polygon selection.',
      };
    }
    return {
      available: false,
      message:
        'Could not reach the AI segmentation server. Check the backend URL in Settings, or use manual polygon selection for now.',
    };
  } finally {
    done();
  }
}
