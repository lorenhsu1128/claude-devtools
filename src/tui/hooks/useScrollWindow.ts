/**
 * Offset-based scroll windowing for terminal display.
 *
 * Ink has no overflow:scroll, so we compute a visible slice
 * of chat items based on terminal height and estimated row counts.
 */

import { useStdout } from 'ink';

import { useTuiStore } from '../store';

import type { ChatItem } from '@renderer/types/groups';
import type { EnhancedAIGroup } from '@renderer/types/groups';
import type { TuiState } from '../store';

/** Overhead rows: title(1) + breadcrumb(1) + stats(1) + tokenbar(1) + helpbar divider+text(2) + statusbar(2) + margin(1) */
const CHROME_ROWS = 9;

/**
 * Estimate how many terminal rows a ChatItem will occupy,
 * accounting for expansion state.
 */
/** Max lines before truncation (must match UserItem.MAX_TEXT_LINES) */
const USER_MAX_TEXT_LINES = 15;

/** Max output lines for system items (must match SystemItem.MAX_OUTPUT_LINES) */
const SYSTEM_MAX_OUTPUT_LINES = 8;

export function estimateItemRows(
  item: ChatItem,
  columns: number,
  expandedIds: Set<string>,
  scrollOffsets: Map<string, number>,
  availableRows: number,
  expandedToolIds: Set<string>,
  expandedUserIds: Set<string>,
  expandedSystemIds: Set<string>,
  systemScrollOffsets: Map<string, number>,
): number {
  const usable = Math.max(columns - 4, 20); // padding + borders

  switch (item.type) {
    case 'user': {
      const text = item.group.content.text ?? item.group.content.rawText ?? '';
      const lines = text.split('\n');
      const isExpanded = expandedUserIds.has(item.group.id);
      if (isExpanded) {
        // Full text — estimate rows from all lines
        let rows = 0;
        for (const line of lines) {
          rows += Math.max(1, Math.ceil((line.length || 1) / usable));
        }
        return 1 + rows + 1; // header + text + margin
      }
      // Collapsed — cap at MAX_TEXT_LINES
      const cappedLines = lines.slice(0, USER_MAX_TEXT_LINES);
      let rows = 0;
      for (const line of cappedLines) {
        rows += Math.max(1, Math.ceil((line.length || 1) / usable));
      }
      const truncatedIndicator = lines.length > USER_MAX_TEXT_LINES ? 1 : 0;
      return 1 + rows + truncatedIndicator + 1; // header + text + truncation hint + margin
    }
    case 'ai': {
      if (!expandedIds.has(item.group.id)) {
        return 2; // collapsed: header + margin
      }
      // Expanded: account for visible display items
      const enhanced = item.group as EnhancedAIGroup;
      let totalEntries = (enhanced.displayItems?.length ?? 0) + (enhanced.lastOutput ? 2 : 0);
      // Add extra rows for expanded tools
      if (enhanced.displayItems) {
        for (const di of enhanced.displayItems) {
          if (di.type === 'tool' && expandedToolIds.has(di.tool.id)) {
            const preview = di.tool.outputPreview ?? '';
            const extraRows = Math.ceil(Math.min(preview.length, 300) / usable) + 1;
            totalEntries += extraRows;
          }
        }
      }
      // Offset is cursor position: 0 = header, 1..N = sub-items (1-based)
      const cursorOffset = scrollOffsets.get(item.group.id) ?? 0;
      const maxVisible = Math.max(availableRows - 2, 1);
      const cursorItemIndex = cursorOffset > 0 ? cursorOffset - 1 : 0;
      const scrollStart = totalEntries <= maxVisible
        ? 0
        : Math.max(0, Math.min(
            cursorItemIndex - Math.min(2, Math.floor(maxVisible / 4)),
            totalEntries - maxVisible,
          ));
      const visibleEntries = Math.min(totalEntries - scrollStart, maxVisible);
      const hiddenAbove = scrollStart > 0 ? 1 : 0; // "↑ N hidden" indicator
      const hiddenBelow = totalEntries - scrollStart - maxVisible > 0 ? 1 : 0; // "↓ N more" indicator
      return 1 + hiddenAbove + visibleEntries + hiddenBelow + 1; // header + content + margin
    }
    case 'system': {
      const output = item.group.commandOutput ?? '';
      const lines = output.split('\n');
      const isExpanded = expandedSystemIds.has(item.group.id);
      if (isExpanded) {
        // Windowed: show at most (availableRows - 2) lines from the current offset
        const offset = systemScrollOffsets.get(item.group.id) ?? 0;
        const maxVisible = Math.max(availableRows - 2, 1);
        const visibleLines = lines.slice(offset, offset + maxVisible);
        let rows = 0;
        for (const line of visibleLines) {
          rows += Math.max(1, Math.ceil((line.length || 1) / usable));
        }
        const hiddenAbove = offset > 0 ? 1 : 0;
        const hiddenBelow = lines.length - offset - maxVisible > 0 ? 1 : 0;
        return 1 + hiddenAbove + rows + hiddenBelow + 1; // header + indicators + visible lines + margin
      }
      // Collapsed — cap at SYSTEM_MAX_OUTPUT_LINES
      const cappedLines = lines.slice(0, SYSTEM_MAX_OUTPUT_LINES);
      let rows = 0;
      for (const line of cappedLines) {
        rows += Math.max(1, Math.ceil((line.length || 1) / usable));
      }
      const truncatedIndicator = lines.length > SYSTEM_MAX_OUTPUT_LINES ? 1 : 0;
      return 1 + rows + truncatedIndicator + 1; // header + output + truncation hint + margin
    }
    case 'compact':
      return 2; // label + margin
    default:
      return 2;
  }
}

/**
 * Convenience wrapper to compute item height from store state.
 * Useful in useKeymap where we don't want to pass 8 params.
 */
export function getItemHeight(
  item: ChatItem,
  termCols: number,
  store: Pick<TuiState, 'expandedAIGroupIds' | 'expandedAIGroupScrollOffsets' | 'expandedToolIds' | 'expandedUserIds' | 'expandedSystemIds' | 'expandedSystemScrollOffsets'>,
  availableRows: number,
): number {
  return estimateItemRows(
    item,
    termCols,
    store.expandedAIGroupIds,
    store.expandedAIGroupScrollOffsets,
    availableRows,
    store.expandedToolIds,
    store.expandedUserIds,
    store.expandedSystemIds,
    store.expandedSystemScrollOffsets,
  );
}

export interface ScrollWindow {
  /** Start index in the chatItems array */
  startIndex: number;
  /** Number of items to render */
  count: number;
  /** Available rows for chat content */
  availableRows: number;
}

/**
 * Compute the visible window of chat items based on scroll offset
 * and terminal dimensions. Accounts for chatItemLineOffset to show
 * extra items when the first item is partially scrolled.
 */
export function useScrollWindow(
  chatItems: ChatItem[],
  scrollOffset: number,
): ScrollWindow {
  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const termCols = stdout?.columns ?? 80;
  const availableRows = Math.max(termRows - CHROME_ROWS, 5);

  const {
    expandedAIGroupIds, expandedAIGroupScrollOffsets, expandedToolIds,
    expandedUserIds, expandedSystemIds, expandedSystemScrollOffsets,
    chatItemLineOffset,
  } = useTuiStore();

  // Add extra rows budget from the partially-scrolled first item
  let rowsBudget = availableRows + chatItemLineOffset;
  let count = 0;

  for (let i = scrollOffset; i < chatItems.length && rowsBudget > 0; i++) {
    const itemRows = estimateItemRows(
      chatItems[i],
      termCols,
      expandedAIGroupIds,
      expandedAIGroupScrollOffsets,
      availableRows,
      expandedToolIds,
      expandedUserIds,
      expandedSystemIds,
      expandedSystemScrollOffsets,
    );
    rowsBudget -= itemRows;
    count++;
  }

  // Always show at least 1 item
  if (count === 0 && chatItems.length > 0) count = 1;

  return {
    startIndex: scrollOffset,
    count,
    availableRows,
  };
}
