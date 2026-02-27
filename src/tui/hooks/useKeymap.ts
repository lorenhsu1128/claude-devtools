/**
 * Central keyboard handler for the TUI.
 *
 * Dispatches key events based on the current focusMode.
 * Must be called from the root App component only (avoids key capture conflicts).
 */

import { useInput, useStdout } from 'ink';

import { useTuiStore } from '../store';

import type { EnhancedAIGroup } from '@renderer/types/groups';

/** Rows reserved for chrome (borders, headers, stats, tokenbar, helpbar divider+text). */
const CHAT_CHROME_ROWS = 13;

/**
 * Count total scrollable "lines" inside an expanded AI group:
 * displayItems + lastOutput (separator + content = 2 lines).
 */
function getExpandedContentCount(group: EnhancedAIGroup): number {
  const displayCount = group.displayItems?.length ?? 0;
  const outputCount = group.lastOutput ? 2 : 0; // separator + output
  return displayCount + outputCount;
}

export function useKeymap(): void {
  const { stdout } = useStdout();
  const isActive = process.stdin.isTTY === true;

  useInput(
    (input, key) => {
      // Always read latest state to avoid stale closure issues.
      const store = useTuiStore.getState();
      const { focusMode, projects, sessions, chatItems } = store;

      // ── Global ──
      if (input === 'q' && focusMode === 'projects') {
        process.exit(0);
      }

      if (key.tab) {
        if (focusMode === 'projects') store.setFocusMode('sessions');
        else if (focusMode === 'sessions') store.setFocusMode('chat');
        else store.setFocusMode('projects');
        return;
      }

      // ── Projects mode ──
      if (focusMode === 'projects') {
        if (input === 'j' || key.downArrow) {
          store.navigateList('projects', 1);
        } else if (input === 'k' || key.upArrow) {
          store.navigateList('projects', -1);
        } else if (key.return) {
          const project = projects[store.selectedProjectIndex];
          if (project) {
            void store.selectProject(project.id);
          }
        }
        return;
      }

      // ── Sessions mode ──
      if (focusMode === 'sessions') {
        if (input === 'j' || key.downArrow) {
          store.navigateList('sessions', 1);
        } else if (input === 'k' || key.upArrow) {
          store.navigateList('sessions', -1);
        } else if (key.return) {
          const session = sessions[store.selectedSessionIndex];
          if (session) {
            void store.selectSession(session.id);
          }
        } else if (key.escape) {
          store.goBackToProjects();
        }
        return;
      }

      // ── Chat mode ──
      if (focusMode === 'chat') {
        const termRows = stdout?.rows ?? 24;
        const maxVisibleLines = Math.max(termRows - CHAT_CHROME_ROWS, 3);

        if (input === 'j' || key.downArrow) {
          scrollChatWithSubItem(store, 1, maxVisibleLines);
        } else if (input === 'k' || key.upArrow) {
          scrollChatWithSubItem(store, -1, maxVisibleLines);
        } else if (input === 'd') {
          // Page down — scroll multiple steps
          for (let i = 0; i < maxVisibleLines; i++) {
            scrollChatWithSubItem(useTuiStore.getState(), 1, maxVisibleLines);
          }
        } else if (input === 'u') {
          // Page up — scroll multiple steps
          for (let i = 0; i < maxVisibleLines; i++) {
            scrollChatWithSubItem(useTuiStore.getState(), -1, maxVisibleLines);
          }
        } else if (key.return) {
          // Toggle expand on the currently focused chat item
          const item = chatItems[store.chatScrollOffset];
          if (item?.type === 'ai') {
            store.toggleAIGroupExpanded(item.group.id);
          }
        } else if (input === 'r') {
          void store.refreshCurrentSession();
        } else if (key.escape) {
          store.goBackToSessions();
        }
      }
    },
    { isActive },
  );
}

/**
 * Scroll within an expanded AI group's display items, or move to the next/prev chat item.
 *
 * When the focused item is an expanded AI group with more content than fits the viewport,
 * j/k first scrolls through the display items. Once at the boundary, it moves to the
 * next/prev chat item.
 */
function scrollChatWithSubItem(
  store: ReturnType<typeof useTuiStore.getState>,
  delta: number,
  maxVisibleLines: number,
): void {
  const {
    chatItems,
    chatScrollOffset,
    expandedAIGroupIds,
    expandedAIGroupScrollOffsets,
  } = store;

  const item = chatItems[chatScrollOffset];

  // Check if the focused item is an expanded AI group with scrollable content
  if (item?.type === 'ai' && expandedAIGroupIds.has(item.group.id)) {
    const enhanced = item.group as EnhancedAIGroup;
    const totalContent = getExpandedContentCount(enhanced);
    const currentOffset = expandedAIGroupScrollOffsets.get(item.group.id) ?? 0;
    // Reserve 2 lines for header + margin inside the AI item
    const maxVisible = Math.max(maxVisibleLines - 2, 1);

    if (delta > 0 && currentOffset + maxVisible < totalContent) {
      // More content below — scroll within
      const nextOffsets = new Map(expandedAIGroupScrollOffsets);
      nextOffsets.set(item.group.id, currentOffset + 1);
      useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets });
      return;
    }

    if (delta < 0 && currentOffset > 0) {
      // More content above — scroll within
      const nextOffsets = new Map(expandedAIGroupScrollOffsets);
      nextOffsets.set(item.group.id, currentOffset - 1);
      useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets });
      return;
    }
  }

  // Fall through: move to next/prev chat item
  store.scrollChat(delta);
}
