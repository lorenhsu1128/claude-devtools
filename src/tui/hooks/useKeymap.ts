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

      // ── Help overlay ──
      if (store.showHelp) {
        if (input === '?' || key.escape) {
          store.toggleHelp();
        }
        return;
      }

      // ── Session filter active (let TextInput handle all keys except Esc) ──
      if (store.sessionFilterActive) {
        if (key.escape) {
          store.deactivateSessionFilter();
        }
        return;
      }

      // ── Chat search active (let TextInput handle all keys except Esc) ──
      if (store.chatSearchActive) {
        if (key.escape) {
          store.deactivateChatSearch();
        }
        return;
      }

      // ── Global ──
      if (input === '?') {
        store.toggleHelp();
        return;
      }

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
        if (input === '/') {
          store.activateSessionFilter();
        } else if (input === 'j' || key.downArrow) {
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

        // Context panel intercept — j/k/Enter/Esc handled within panel
        if (store.showContextPanel) {
          if (store.expandedContextCategory) {
            // Expanded category: j/k scroll details, Enter/Esc collapse
            if (input === 'j' || key.downArrow) {
              store.scrollContextPanel(1);
            } else if (input === 'k' || key.upArrow) {
              store.scrollContextPanel(-1);
            } else if (key.return || key.escape) {
              store.toggleContextCategory(store.expandedContextCategory);
            }
          } else {
            // Unexpanded: j/k move cursor, Enter expand, c/Esc close panel
            if (input === 'j' || key.downArrow) {
              store.navigateContextPanel(1);
            } else if (input === 'k' || key.upArrow) {
              store.navigateContextPanel(-1);
            } else if (key.return) {
              const categories = ['claude-md', 'mentioned-file', 'tool-output', 'thinking-text', 'task-coordination', 'user-message'];
              const cat = categories[store.contextPanelCursorIndex];
              if (cat) store.toggleContextCategory(cat);
            } else if (input === 'c' || key.escape) {
              store.toggleContextPanel();
            }
          }
          return;
        }

        if (input === '/') {
          store.activateChatSearch();
        } else if (input === 'n' && store.chatSearchMatches.length > 0) {
          store.nextChatSearchMatch();
        } else if (input === 'N' && store.chatSearchMatches.length > 0) {
          store.previousChatSearchMatch();
        } else if (input === 'j' || key.downArrow) {
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
          handleEnterKey(store);
        } else if (input === 'c') {
          store.toggleContextPanel();
        } else if (input === 'r') {
          void store.refreshCurrentSession();
        } else if (key.escape) {
          if (store.subagentStack.length > 0) {
            store.goBackFromSubagent();
          } else {
            store.goBackToSessions();
          }
        }
      }
    },
    { isActive },
  );
}

/**
 * Handle Enter key: toggle AI group expand, or toggle tool expand within an expanded group.
 */
function handleEnterKey(store: ReturnType<typeof useTuiStore.getState>): void {
  const { chatItems, chatScrollOffset, expandedAIGroupIds, expandedAIGroupScrollOffsets } = store;
  const item = chatItems[chatScrollOffset];

  if (item?.type === 'user') {
    store.toggleUserExpanded(item.group.id);
    return;
  }

  if (item?.type === 'system') {
    // If expanded and scrolled into content, first reset scroll to top
    if (store.expandedSystemIds.has(item.group.id)) {
      const offset = store.expandedSystemScrollOffsets.get(item.group.id) ?? 0;
      if (offset > 0) {
        // Reset scroll to top first, next Enter will collapse
        const nextOffsets = new Map(store.expandedSystemScrollOffsets);
        nextOffsets.delete(item.group.id);
        useTuiStore.setState({ expandedSystemScrollOffsets: nextOffsets });
        return;
      }
    }
    store.toggleSystemExpanded(item.group.id);
    return;
  }

  if (item?.type !== 'ai') return;

  const groupId = item.group.id;

  // If the group is not expanded, toggle it
  if (!expandedAIGroupIds.has(groupId)) {
    store.toggleAIGroupExpanded(groupId);
    return;
  }

  // Group is expanded — check if we have a sub-item offset
  const subOffset = expandedAIGroupScrollOffsets.get(groupId) ?? 0;
  if (subOffset === 0) {
    // At the top of the expanded group — collapse it
    store.toggleAIGroupExpanded(groupId);
    return;
  }

  // We're scrolled into the expanded group — find which entry is focused
  const enhanced = item.group as EnhancedAIGroup;
  type ExpandedEntry =
    | { kind: 'display'; item: import('@renderer/types/groups').AIGroupDisplayItem }
    | { kind: 'output' };
  const allEntries: ExpandedEntry[] = [];
  if (enhanced.displayItems) {
    for (const di of enhanced.displayItems) {
      allEntries.push({ kind: 'display', item: di });
    }
  }
  if (enhanced.lastOutput) {
    allEntries.push({ kind: 'output' });
  }

  const focusedEntry = allEntries[subOffset];
  if (focusedEntry?.kind === 'display') {
    if (focusedEntry.item.type === 'tool') {
      store.toggleToolExpanded(focusedEntry.item.tool.id);
    } else if (focusedEntry.item.type === 'subagent') {
      void store.drillDownSubagent(focusedEntry.item.subagent);
    }
  }
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
    expandedSystemIds,
    expandedSystemScrollOffsets,
  } = store;

  const item = chatItems[chatScrollOffset];

  // Check if the focused item is an expanded system group with scrollable content
  if (item?.type === 'system' && expandedSystemIds.has(item.group.id)) {
    const output = item.group.commandOutput ?? '';
    const totalLines = output.split('\n').length;
    const currentOffset = expandedSystemScrollOffsets.get(item.group.id) ?? 0;
    const maxVisible = Math.max(maxVisibleLines - 2, 1); // reserve header + margin

    if (delta > 0 && currentOffset + maxVisible < totalLines) {
      const nextOffsets = new Map(expandedSystemScrollOffsets);
      nextOffsets.set(item.group.id, currentOffset + 1);
      useTuiStore.setState({ expandedSystemScrollOffsets: nextOffsets });
      return;
    }

    if (delta < 0 && currentOffset > 0) {
      const nextOffsets = new Map(expandedSystemScrollOffsets);
      nextOffsets.set(item.group.id, currentOffset - 1);
      useTuiStore.setState({ expandedSystemScrollOffsets: nextOffsets });
      return;
    }
  }

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
