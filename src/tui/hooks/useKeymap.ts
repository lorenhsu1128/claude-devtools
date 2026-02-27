/**
 * Central keyboard handler for the TUI.
 *
 * Dispatches key events based on the current focusMode.
 * Must be called from the root App component only (avoids key capture conflicts).
 *
 * Navigation principle: → always lands on the first expandable item.
 * Arrow keys only — no vim-style j/k/l/h/Enter bindings.
 * ↑/↓ scrolls one terminal line at a time (not one item).
 */

import { useInput, useStdout } from 'ink';

import { useTuiStore } from '../store';

import { getItemHeight } from './useScrollWindow';

import type { EnhancedAIGroup } from '@renderer/types/groups';

/** Rows reserved for chrome (title, breadcrumb, stats, tokenbar, helpbar divider+text, statusbar). */
const CHAT_CHROME_ROWS = 10;

/**
 * Count navigable entries inside an expanded AI group.
 * Must match the allEntries array built in AIItem (1 entry per display item + 1 for output).
 */
function getExpandedContentCount(group: EnhancedAIGroup): number {
  const displayCount = group.displayItems?.length ?? 0;
  const outputCount = group.lastOutput ? 1 : 0;
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

      // ── Projects mode ──
      if (focusMode === 'projects') {
        if (key.downArrow) {
          store.navigateList('projects', 1);
        } else if (key.upArrow) {
          store.navigateList('projects', -1);
        } else if (key.rightArrow) {
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
        } else if (key.downArrow) {
          store.navigateList('sessions', 1);
        } else if (key.upArrow) {
          store.navigateList('sessions', -1);
        } else if (key.rightArrow) {
          const session = sessions[store.selectedSessionIndex];
          if (session) {
            void store.selectSession(session.id);
          }
        } else if (key.leftArrow || key.escape) {
          store.goBackToProjects();
        }
        return;
      }

      // ── Chat mode ──
      if (focusMode === 'chat') {
        const termRows = stdout?.rows ?? 24;
        const termCols = stdout?.columns ?? 80;
        const maxVisibleLines = Math.max(termRows - CHAT_CHROME_ROWS, 3);

        // Context panel intercept — ↑↓/→/←/Esc handled within panel
        if (store.showContextPanel) {
          if (store.expandedContextCategory) {
            // Expanded category: ↑↓ scroll details, ←/Esc collapse
            if (key.downArrow) {
              store.scrollContextPanel(1);
            } else if (key.upArrow) {
              store.scrollContextPanel(-1);
            } else if (key.leftArrow || key.escape) {
              store.toggleContextCategory(store.expandedContextCategory);
            }
          } else {
            // Unexpanded: ↑↓ move cursor, → expand, ←/Esc close panel
            if (key.downArrow) {
              store.navigateContextPanel(1);
            } else if (key.upArrow) {
              store.navigateContextPanel(-1);
            } else if (key.rightArrow) {
              const categories = ['claude-md', 'mentioned-file', 'tool-output', 'thinking-text', 'task-coordination', 'user-message'];
              const cat = categories[store.contextPanelCursorIndex];
              if (cat) store.toggleContextCategory(cat);
            } else if (key.leftArrow || key.escape) {
              store.toggleContextPanel();
            }
          }
          return;
        }

        // ── Sub-item mode: when inside an expanded AI group (offset > 0) ──
        const currentItem = chatItems[store.chatScrollOffset];
        const inSubItemMode = currentItem?.type === 'ai'
          && store.expandedAIGroupIds.has(currentItem.group.id)
          && (store.expandedAIGroupScrollOffsets.get(currentItem.group.id) ?? 0) > 0;

        if (inSubItemMode) {
          const groupId = currentItem.group.id;
          const enhanced = currentItem.group as EnhancedAIGroup;
          const totalContent = getExpandedContentCount(enhanced);
          const currentOffset = store.expandedAIGroupScrollOffsets.get(groupId) ?? 0;

          if (key.downArrow) {
            if (currentOffset < totalContent) {
              // Move to next sub-item
              const nextOffsets = new Map(store.expandedAIGroupScrollOffsets);
              nextOffsets.set(groupId, currentOffset + 1);
              useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets });
            } else {
              // Past last sub-item → exit and move to next chat item
              const nextOffsets = new Map(store.expandedAIGroupScrollOffsets);
              nextOffsets.set(groupId, 0);
              useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets, chatItemLineOffset: 0 });
              store.scrollChat(1);
            }
          } else if (key.upArrow) {
            if (currentOffset > 1) {
              // Move to previous sub-item
              const nextOffsets = new Map(store.expandedAIGroupScrollOffsets);
              nextOffsets.set(groupId, currentOffset - 1);
              useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets });
            } else {
              // At first sub-item → exit sub-item mode (back to header)
              const nextOffsets = new Map(store.expandedAIGroupScrollOffsets);
              nextOffsets.set(groupId, 0);
              useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets });
            }
          } else if (key.rightArrow) {
            handleRightArrowSubItem(store);
          } else if (key.leftArrow) {
            handleLeftArrowSubItem(store);
          } else if (key.escape) {
            const nextOffsets = new Map(store.expandedAIGroupScrollOffsets);
            nextOffsets.set(groupId, 0);
            useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets });
          }
          return;
        }

        // ── Normal chat-level navigation ──
        if (input === '/') {
          store.activateChatSearch();
        } else if (input === 'n' && store.chatSearchMatches.length > 0) {
          store.nextChatSearchMatch();
        } else if (input === 'N' && store.chatSearchMatches.length > 0) {
          store.previousChatSearchMatch();
        } else if (key.downArrow) {
          scrollChatLine(store, 1, maxVisibleLines, termCols);
        } else if (key.upArrow) {
          scrollChatLine(store, -1, maxVisibleLines, termCols);
        } else if (input === 'd') {
          for (let i = 0; i < maxVisibleLines; i++) {
            scrollChatLine(useTuiStore.getState(), 1, maxVisibleLines, termCols);
          }
        } else if (input === 'u') {
          for (let i = 0; i < maxVisibleLines; i++) {
            scrollChatLine(useTuiStore.getState(), -1, maxVisibleLines, termCols);
          }
        } else if (key.rightArrow) {
          // Reset line offset when expanding (item height will change)
          useTuiStore.setState({ chatItemLineOffset: 0 });
          handleRightArrow(store);
        } else if (key.leftArrow) {
          // Reset line offset when collapsing
          useTuiStore.setState({ chatItemLineOffset: 0 });
          handleLeftArrow(store);
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
 * Enter sub-item mode: jump to the first expandable sub-item.
 * If no expandable sub-item exists, do nothing (stay at header).
 */
function enterSubItemMode(store: ReturnType<typeof useTuiStore.getState>): void {
  const { chatItems, chatScrollOffset, expandedAIGroupIds, expandedAIGroupScrollOffsets } = store;
  const item = chatItems[chatScrollOffset];
  if (item?.type !== 'ai' || !expandedAIGroupIds.has(item.group.id)) return;

  const enhanced = item.group as EnhancedAIGroup;
  const allEntries = buildAllEntries(enhanced);
  const targetOffset = findFirstExpandableOffset(allEntries);
  if (targetOffset === 0) return; // Nothing expandable inside

  const nextOffsets = new Map(expandedAIGroupScrollOffsets);
  nextOffsets.set(item.group.id, targetOffset);
  useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets });
}

type ExpandedEntry =
  | { kind: 'display'; item: import('@renderer/types/groups').AIGroupDisplayItem }
  | { kind: 'output' };

function buildAllEntries(enhanced: EnhancedAIGroup): ExpandedEntry[] {
  const entries: ExpandedEntry[] = [];
  if (enhanced.displayItems) {
    for (const di of enhanced.displayItems) {
      entries.push({ kind: 'display', item: di });
    }
  }
  if (enhanced.lastOutput) {
    entries.push({ kind: 'output' });
  }
  return entries;
}

/** An entry is expandable if it can go one level deeper via →. */
function isExpandableEntry(entry: ExpandedEntry): boolean {
  return entry.kind === 'display'
    && (entry.item.type === 'tool' || entry.item.type === 'subagent');
}

/**
 * Find the first expandable entry (1-based offset). Returns 0 if none found.
 */
function findFirstExpandableOffset(entries: ExpandedEntry[]): number {
  for (let i = 0; i < entries.length; i++) {
    if (isExpandableEntry(entries[i])) return i + 1;
  }
  return 0;
}



/**
 * Right arrow at chat level: progressively go deeper.
 * Collapsed → expand. Expanded AI group → enter sub-items.
 */
function handleRightArrow(store: ReturnType<typeof useTuiStore.getState>): void {
  const { chatItems, chatScrollOffset, expandedAIGroupIds, expandedUserIds, expandedSystemIds } = store;
  const item = chatItems[chatScrollOffset];
  if (!item) return;

  if (item.type === 'ai') {
    if (!expandedAIGroupIds.has(item.group.id)) {
      store.toggleAIGroupExpanded(item.group.id);
    } else {
      enterSubItemMode(store);
    }
    return;
  }

  if (item.type === 'user' && !expandedUserIds.has(item.group.id)) {
    store.toggleUserExpanded(item.group.id);
    return;
  }

  if (item.type === 'system' && !expandedSystemIds.has(item.group.id)) {
    store.toggleSystemExpanded(item.group.id);
  }
}

/**
 * Left arrow at chat level: progressively go shallower.
 * Expanded → collapse. Nothing to collapse → go back.
 */
function handleLeftArrow(store: ReturnType<typeof useTuiStore.getState>): void {
  const { chatItems, chatScrollOffset, expandedAIGroupIds, expandedUserIds, expandedSystemIds } = store;
  const item = chatItems[chatScrollOffset];

  if (item?.type === 'ai' && expandedAIGroupIds.has(item.group.id)) {
    store.toggleAIGroupExpanded(item.group.id);
    return;
  }

  if (item?.type === 'user' && expandedUserIds.has(item.group.id)) {
    store.toggleUserExpanded(item.group.id);
    return;
  }

  if (item?.type === 'system' && expandedSystemIds.has(item.group.id)) {
    // Reset scroll offset and collapse
    const nextOffsets = new Map(store.expandedSystemScrollOffsets);
    nextOffsets.delete(item.group.id);
    useTuiStore.setState({ expandedSystemScrollOffsets: nextOffsets });
    store.toggleSystemExpanded(item.group.id);
    return;
  }

  // Nothing expanded → go back
  if (store.subagentStack.length > 0) {
    store.goBackFromSubagent();
  } else {
    store.goBackToSessions();
  }
}

/**
 * Right arrow in sub-item mode: expand tool or drill into subagent.
 */
function handleRightArrowSubItem(store: ReturnType<typeof useTuiStore.getState>): void {
  const { chatItems, chatScrollOffset, expandedAIGroupScrollOffsets } = store;
  const item = chatItems[chatScrollOffset];
  if (item?.type !== 'ai') return;

  const groupId = item.group.id;
  const subOffset = expandedAIGroupScrollOffsets.get(groupId) ?? 0;
  if (subOffset === 0) return;

  const enhanced = item.group as EnhancedAIGroup;
  const allEntries = buildAllEntries(enhanced);
  const focusedEntry = allEntries[subOffset - 1];

  if (focusedEntry?.kind === 'display') {
    if (focusedEntry.item.type === 'tool' && !store.expandedToolIds.has(focusedEntry.item.tool.id)) {
      store.toggleToolExpanded(focusedEntry.item.tool.id);
    } else if (focusedEntry.item.type === 'subagent') {
      void store.drillDownSubagent(focusedEntry.item.subagent);
    }
  }
}

/**
 * Left arrow in sub-item mode: collapse tool or exit sub-items.
 */
function handleLeftArrowSubItem(store: ReturnType<typeof useTuiStore.getState>): void {
  const { chatItems, chatScrollOffset, expandedAIGroupScrollOffsets } = store;
  const item = chatItems[chatScrollOffset];
  if (item?.type !== 'ai') return;

  const groupId = item.group.id;
  const subOffset = expandedAIGroupScrollOffsets.get(groupId) ?? 0;
  if (subOffset === 0) return;

  const enhanced = item.group as EnhancedAIGroup;
  const allEntries = buildAllEntries(enhanced);
  const focusedEntry = allEntries[subOffset - 1];

  // If focused tool is expanded, collapse it first
  if (focusedEntry?.kind === 'display' && focusedEntry.item.type === 'tool'
      && store.expandedToolIds.has(focusedEntry.item.tool.id)) {
    store.toggleToolExpanded(focusedEntry.item.tool.id);
    return;
  }

  // Otherwise exit sub-item mode
  const nextOffsets = new Map(expandedAIGroupScrollOffsets);
  nextOffsets.set(groupId, 0);
  useTuiStore.setState({ expandedAIGroupScrollOffsets: nextOffsets });
}

/**
 * Line-by-line scroll: each call advances by exactly 1 terminal line.
 *
 * Uses chatItemLineOffset to track position within the current item.
 * When the offset reaches the item's estimated height, advance to the next item.
 * Expanded system groups use their own internal line scrolling first.
 */
function scrollChatLine(
  store: ReturnType<typeof useTuiStore.getState>,
  delta: number,
  maxVisibleLines: number,
  termCols: number,
): void {
  const {
    chatItems,
    chatScrollOffset,
    chatItemLineOffset,
    expandedSystemIds,
    expandedSystemScrollOffsets,
  } = store;

  const item = chatItems[chatScrollOffset];
  if (!item) return;

  // Expanded system group: viewport scrolling (content overflow only)
  // This already provides line-by-line scrolling within the system output.
  if (item.type === 'system' && expandedSystemIds.has(item.group.id)) {
    const output = item.group.commandOutput ?? '';
    const totalLines = output.split('\n').length;
    const currentOffset = expandedSystemScrollOffsets.get(item.group.id) ?? 0;
    const maxVisible = Math.max(maxVisibleLines - 2, 1);

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
    // Fall through to line-based item movement when system scroll reaches boundary
  }

  // Line-by-line item movement
  const itemHeight = getItemHeight(item, termCols, store, maxVisibleLines);

  if (delta > 0) {
    if (chatItemLineOffset + 1 < itemHeight) {
      // Still within current item
      useTuiStore.setState({ chatItemLineOffset: chatItemLineOffset + 1 });
    } else {
      // Past this item → move to next item
      const maxOffset = Math.max(0, chatItems.length - 1);
      if (chatScrollOffset < maxOffset) {
        useTuiStore.setState({ chatItemLineOffset: 0 });
        store.scrollChat(1);
      }
    }
  } else {
    if (chatItemLineOffset > 0) {
      // Still within current item
      useTuiStore.setState({ chatItemLineOffset: chatItemLineOffset - 1 });
    } else {
      // Before this item → move to prev item, position at its last line
      if (chatScrollOffset > 0) {
        const prevItem = chatItems[chatScrollOffset - 1];
        const prevHeight = getItemHeight(prevItem, termCols, store, maxVisibleLines);
        store.scrollChat(-1);
        useTuiStore.setState({ chatItemLineOffset: Math.max(0, prevHeight - 1) });
      }
    }
  }
}
