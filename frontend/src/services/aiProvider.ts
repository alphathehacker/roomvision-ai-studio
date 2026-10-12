/**
 * AI provider seam (Phase 3).
 * In Phase 1 there is no server-side segmentation provider, so
 * `tryAiSegmentation` always resolves honestly: available = false.
 * It must NEVER report success without real data.
 */
import { BackendError } from './api';
import { getBackendUrl } from './api';
import type { NormPoint } from '../types';

export interface AiSegmentationUnavailable {
  available: false;
  message: string;
}

export interface AiSegmentationSuccess {
  available: true;
  /** masks produced by the server, in normalized coordinates */
  masks: { category: 'wall' | 'ceiling' | 'floor'; label: string; points: NormPoint[] }[];
}

export type AiSegmentationResult = AiSegmentationUnavailable | AiSegmentationSuccess;

const UNAVAILABLE_MESSAGE =
  "AI segmentation isn't configured on the server yet. Use manual polygon selection for now.";

/**
 * Attempt server-side room segmentation. Resolves { available: false } unless
 * the backend genuinely returns mask data. Every failure path is user-facing.
 */
export async function tryAiSegmentation(_imageBlob: Blob): Promise<AiSegmentationResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);
  try {
    const form = new FormData();
    form.append('image', _imageBlob, 'room.jpg');
    const res = await fetch(`${getBackendUrl()}/api/segment-room`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (res.status === 503) {
      return { available: false, message: UNAVAILABLE_MESSAGE };
    }
    if (!res.ok) {
      return {
        available: false,
        message: `AI segmentation failed (server responded ${res.status}). Use manual polygon selection for now.`,
      };
    }
    const data = (await res.json()) as {
      masks?: { category?: string; label?: string; points?: NormPoint[] }[];
    };
    if (!Array.isArray(data.masks) || data.masks.length === 0) {
      return {
        available: false,
        message: 'The server returned no usable masks. Use manual polygon selection for now.',
      };
    }
    const masks: AiSegmentationSuccess['masks'] = [];
    for (const m of data.masks) {
      if (
        (m.category === 'wall' || m.category === 'ceiling' || m.category === 'floor') &&
        Array.isArray(m.points) &&
        m.points.length >= 3 &&
        m.points.every((p) => typeof p.x === 'number' && typeof p.y === 'number')
      ) {
        masks.push({ category: m.category, label: m.label ?? m.category, points: m.points });
      }
    }
    if (masks.length === 0) {
      return {
        available: false,
        message: 'The server returned no usable masks. Use manual polygon selection for now.',
      };
    }
    return { available: true, masks };
  } catch (err) {
    if (err instanceof BackendError) {
      return { available: false, message: UNAVAILABLE_MESSAGE };
    }
    return {
      available: false,
      message:
        'Could not reach the AI segmentation server. Check the backend URL in Settings, or use manual polygon selection for now.',
    };
  } finally {
    window.clearTimeout(timer);
  }
}
