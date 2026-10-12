/** Immutable undo/redo history for editor state snapshots. */
import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY = 60;

export interface HistoryApi<T> {
  state: T;
  /** Push a new snapshot (no-op if deep-equal to the current state, unless forced). */
  push: (next: T, force?: boolean) => void;
  /** Replace current state without adding a history entry. */
  replace: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (next: T) => void;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface Stacks<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initial: T): HistoryApi<T> {
  const [stacks, setStacks] = useState<Stacks<T>>({ past: [], present: initial, future: [] });
  const presentRef = useRef(initial);
  presentRef.current = stacks.present;

  const push = useCallback((next: T, force = false) => {
    if (!force && deepEqual(presentRef.current, next)) return;
    setStacks((h) => ({
      past: [...h.past.slice(-(MAX_HISTORY - 1)), h.present],
      present: next,
      future: [],
    }));
  }, []);

  const replace = useCallback((next: T) => {
    setStacks((h) => ({ ...h, present: next }));
  }, []);

  const undo = useCallback(() => {
    setStacks((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: prev,
        future: [h.present, ...h.future].slice(0, MAX_HISTORY),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setStacks((h) => {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return {
        past: [...h.past.slice(-(MAX_HISTORY - 1)), h.present],
        present: next,
        future: rest,
      };
    });
  }, []);

  const reset = useCallback((next: T) => {
    setStacks({ past: [], present: next, future: [] });
  }, []);

  return {
    state: stacks.present,
    push,
    replace,
    undo,
    redo,
    canUndo: stacks.past.length > 0,
    canRedo: stacks.future.length > 0,
    reset,
  };
}
