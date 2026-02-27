/**
 * Subscribes to ServiceContext.fileWatcher events for live session updates.
 *
 * Handles two scenarios:
 * 1. Current session file changes → refresh chat items
 * 2. Other files in current project change → refresh session list (new sessions)
 *
 * Applies a 500ms debounce to avoid excessive re-renders during
 * rapid file writes (e.g., Claude Code editing files).
 */

import { useEffect, useRef } from 'react';

import { getServiceContext, useTuiStore } from '../store';

import type { FileChangeEvent } from '@main/types/chunks';

/** Debounce interval for TUI-level refresh (ms). */
const REFRESH_DEBOUNCE_MS = 500;

export function useFileWatcher(): void {
  const sessionRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ctx;
    try {
      ctx = getServiceContext();
    } catch {
      return; // ServiceContext not ready yet
    }

    const handler = (event: FileChangeEvent): void => {
      const state = useTuiStore.getState();
      if (!state.selectedProjectId) return;

      // Only react to events in the currently selected project
      if (!event.projectId || state.selectedProjectId !== event.projectId) return;

      if (event.sessionId && state.selectedSessionId === event.sessionId) {
        // Current session changed — debounced refresh
        if (sessionRefreshTimer.current) clearTimeout(sessionRefreshTimer.current);
        sessionRefreshTimer.current = setTimeout(() => {
          void useTuiStore.getState().refreshCurrentSession();
        }, REFRESH_DEBOUNCE_MS);
      } else if (event.type === 'add' || event.type === 'unlink') {
        // New session added or removed — refresh session list
        if (listRefreshTimer.current) clearTimeout(listRefreshTimer.current);
        listRefreshTimer.current = setTimeout(() => {
          void useTuiStore.getState().refreshSessionList();
        }, REFRESH_DEBOUNCE_MS);
      }
    };

    ctx.fileWatcher.on('file-change', handler);

    return () => {
      ctx.fileWatcher.off('file-change', handler);
      if (sessionRefreshTimer.current) clearTimeout(sessionRefreshTimer.current);
      if (listRefreshTimer.current) clearTimeout(listRefreshTimer.current);
    };
  }, []);
}
