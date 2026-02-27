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

/** Overhead rows: header (3), status bar (1), chat header (3), borders (2), helpbar divider+text (2) */
const CHROME_ROWS = 11;

/**
 * Estimate how many terminal rows a ChatItem will occupy,
 * accounting for expansion state.
 */
function estimateItemRows(
  item: ChatItem,
  columns: number,
  expandedIds: Set<string>,
  scrollOffsets: Map<string, number>,
  availableRows: number,
): number {
  const usable = Math.max(columns - 4, 20); // padding + borders

  switch (item.type) {
    case 'user': {
      const text = item.group.content.text ?? item.group.content.rawText ?? '';
      const textRows = Math.max(1, Math.ceil(text.length / usable));
      return 1 + textRows + 1; // header + text + margin
    }
    case 'ai': {
      if (!expandedIds.has(item.group.id)) {
        return 2; // collapsed: header + margin
      }
      // Expanded: account for visible display items
      const enhanced = item.group as EnhancedAIGroup;
      const totalEntries = (enhanced.displayItems?.length ?? 0) + (enhanced.lastOutput ? 2 : 0);
      const offset = scrollOffsets.get(item.group.id) ?? 0;
      const maxVisible = Math.max(availableRows - 2, 1);
      const visibleEntries = Math.min(totalEntries - offset, maxVisible);
      const hiddenAbove = offset > 0 ? 1 : 0; // "↑ N hidden" indicator
      const hiddenBelow = totalEntries - offset - maxVisible > 0 ? 1 : 0; // "↓ N more" indicator
      return 1 + hiddenAbove + visibleEntries + hiddenBelow + 1; // header + content + margin
    }
    case 'system': {
      const output = item.group.commandOutput ?? '';
      const outputRows = Math.max(1, Math.ceil(Math.min(output.length, 200) / usable));
      return outputRows + 1;
    }
    case 'compact':
      return 2; // label + margin
    default:
      return 2;
  }
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
 * and terminal dimensions.
 */
export function useScrollWindow(
  chatItems: ChatItem[],
  scrollOffset: number,
): ScrollWindow {
  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const termCols = stdout?.columns ?? 80;
  const availableRows = Math.max(termRows - CHROME_ROWS, 5);

  const { expandedAIGroupIds, expandedAIGroupScrollOffsets } = useTuiStore();

  let rowsBudget = availableRows;
  let count = 0;

  for (let i = scrollOffset; i < chatItems.length && rowsBudget > 0; i++) {
    const itemRows = estimateItemRows(
      chatItems[i],
      termCols,
      expandedAIGroupIds,
      expandedAIGroupScrollOffsets,
      availableRows,
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
