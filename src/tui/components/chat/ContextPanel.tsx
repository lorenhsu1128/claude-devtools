/**
 * Context Injection panel — shows per-turn token usage by category.
 *
 * Enhanced with cursor navigation and expandable category details:
 * - j/k to move cursor between categories
 * - Enter to expand/collapse category details
 * - Expanded view shows individual items within each category
 */

import { formatTokensCompact } from '@shared/utils/tokenFormatting';
import { Box, Text } from 'ink';

import { useTuiStore } from '../../store';

import type { ContextInjection } from '@renderer/types/contextInjection';

/** Default context window size (200k) when model is unknown. */
const DEFAULT_CONTEXT_WINDOW = 200_000;

/** Maximum detail items visible in expanded category. */
const MAX_DETAIL_VISIBLE = 8;

/** Category keys in display order. */
const CATEGORY_KEYS = [
  'claude-md',
  'mentioned-file',
  'tool-output',
  'thinking-text',
  'task-coordination',
  'user-message',
] as const;

interface ContextPanelProps {
  /** The AI group ID to show context for */
  aiGroupId: string;
  /** Turn number for display (1-based) */
  turnNumber: number;
}

export const ContextPanel = ({ aiGroupId, turnNumber }: ContextPanelProps): JSX.Element => {
  const contextStatsMap = useTuiStore((s) => s.contextStatsMap);
  const cursorIndex = useTuiStore((s) => s.contextPanelCursorIndex);
  const expandedCategory = useTuiStore((s) => s.expandedContextCategory);
  const scrollOffset = useTuiStore((s) => s.contextPanelScrollOffset);
  const stats = contextStatsMap.get(aiGroupId);

  if (!stats) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>── Context · Turn {turnNumber} ──</Text>
        <Text dimColor>  No context data available</Text>
      </Box>
    );
  }

  const { tokensByCategory, accumulatedInjections, totalEstimatedTokens } = stats;
  const pct = Math.round((totalEstimatedTokens / DEFAULT_CONTEXT_WINDOW) * 100);

  // Count items per category from accumulated injections
  const claudeMdCount = accumulatedInjections.filter((i) => i.category === 'claude-md').length;
  const mentionedCount = accumulatedInjections.filter((i) => i.category === 'mentioned-file').length;
  const toolCount = accumulatedInjections
    .filter((i) => i.category === 'tool-output')
    .reduce((sum, i) => sum + (i.category === 'tool-output' ? i.toolCount : 0), 0);
  const thinkingCount = accumulatedInjections.filter((i) => i.category === 'thinking-text').length;
  const taskCount = accumulatedInjections.filter((i) => i.category === 'task-coordination').length;
  const userMsgCount = accumulatedInjections.filter((i) => i.category === 'user-message').length;

  // Build progress bar (20 chars wide)
  const barWidth = 20;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = '\u2588'.repeat(Math.min(filled, barWidth)) + '\u2591'.repeat(Math.max(0, barWidth - filled));

  const rows: Array<{ label: string; detail: string; tokens: number; categoryKey: string }> = [
    {
      label: 'CLAUDE.md',
      detail: claudeMdCount > 0 ? `${claudeMdCount} files` : '-',
      tokens: tokensByCategory.claudeMd,
      categoryKey: 'claude-md',
    },
    {
      label: 'Mentioned Files',
      detail: mentionedCount > 0 ? `${mentionedCount} files` : '-',
      tokens: tokensByCategory.mentionedFiles,
      categoryKey: 'mentioned-file',
    },
    {
      label: 'Tool Outputs',
      detail: toolCount > 0 ? `${toolCount} calls` : '-',
      tokens: tokensByCategory.toolOutputs,
      categoryKey: 'tool-output',
    },
    {
      label: 'Thinking/Text',
      detail: thinkingCount > 0 ? `${thinkingCount} turns` : '-',
      tokens: tokensByCategory.thinkingText,
      categoryKey: 'thinking-text',
    },
    {
      label: 'Task Coord.',
      detail: taskCount > 0 ? `${taskCount} items` : '-',
      tokens: tokensByCategory.taskCoordination,
      categoryKey: 'task-coordination',
    },
    {
      label: 'User Messages',
      detail: userMsgCount > 0 ? `${userMsgCount} msgs` : '-',
      tokens: tokensByCategory.userMessages,
      categoryKey: 'user-message',
    },
  ];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text dimColor>── Context · Turn {turnNumber} ──</Text>
      {rows.map((row, ri) => {
        const isCursor = ri === cursorIndex;
        const isExpanded = expandedCategory === row.categoryKey;
        const cursor = isCursor ? (isExpanded ? '▾' : '▸') : ' ';

        return (
          <Box key={row.categoryKey} flexDirection="column">
            <Box>
              <Text color={isCursor ? 'cyan' : undefined}>{cursor} </Text>
              <Text color={isCursor ? 'cyan' : 'white'}>{row.label.padEnd(17)}</Text>
              <Text dimColor>{row.detail.padEnd(10)}</Text>
              <Text color={row.tokens > 0 ? 'yellow' : undefined} dimColor={row.tokens === 0}>
                {formatTokensCompact(row.tokens).padStart(8)}
              </Text>
            </Box>
            {isExpanded ? (
              <CategoryDetail
                injections={accumulatedInjections}
                categoryKey={row.categoryKey}
                scrollOffset={scrollOffset}
              />
            ) : null}
          </Box>
        );
      })}
      <Text dimColor>  {'─'.repeat(38)}</Text>
      <Box>
        <Text dimColor>  Total  </Text>
        <Text color="cyan" bold>
          {formatTokensCompact(totalEstimatedTokens)}
        </Text>
        <Text dimColor>
          {' '}/ {formatTokensCompact(DEFAULT_CONTEXT_WINDOW)} ({pct}%)
        </Text>
      </Box>
      <Text dimColor>  {bar}</Text>
    </Box>
  );
};

// =============================================================================
// Detail renderers per category
// =============================================================================

interface CategoryDetailProps {
  injections: ContextInjection[];
  categoryKey: string;
  scrollOffset: number;
}

const CategoryDetail = ({ injections, categoryKey, scrollOffset }: CategoryDetailProps): JSX.Element => {
  const items = injections.filter((i) => i.category === categoryKey);
  const detailLines = buildDetailLines(items, categoryKey);

  if (detailLines.length === 0) {
    return <Text dimColor>    (empty)</Text>;
  }

  const total = detailLines.length;
  const safeOffset = Math.min(scrollOffset, Math.max(0, total - MAX_DETAIL_VISIBLE));
  const visible = detailLines.slice(safeOffset, safeOffset + MAX_DETAIL_VISIBLE);
  const hiddenAbove = safeOffset;
  const hiddenBelow = Math.max(0, total - safeOffset - MAX_DETAIL_VISIBLE);

  return (
    <Box flexDirection="column">
      {hiddenAbove > 0 ? (
        <Text dimColor>    ↑ {hiddenAbove} more</Text>
      ) : null}
      {visible.map((line, li) => (
        <Text key={safeOffset + li} dimColor>
          {'    '}{line}
        </Text>
      ))}
      {hiddenBelow > 0 ? (
        <Text dimColor>    ↓ {hiddenBelow} more</Text>
      ) : null}
    </Box>
  );
};

/**
 * Build detail lines for a category's injections.
 */
function buildDetailLines(items: ContextInjection[], categoryKey: string): string[] {
  const lines: string[] = [];

  switch (categoryKey) {
    case 'claude-md':
      for (const item of items) {
        if (item.category !== 'claude-md') continue;
        const source = item.isGlobal ? 'global' : 'project';
        lines.push(`${item.displayName} (${source}) ${formatTokensCompact(item.estimatedTokens)}`);
      }
      break;

    case 'mentioned-file':
      for (const item of items) {
        if (item.category !== 'mentioned-file') continue;
        lines.push(`${item.displayName} ${formatTokensCompact(item.estimatedTokens)}`);
      }
      break;

    case 'tool-output':
      for (const item of items) {
        if (item.category !== 'tool-output') continue;
        for (const tb of item.toolBreakdown) {
          const err = tb.isError ? ' [ERR]' : '';
          lines.push(`${tb.toolName}${err} ${formatTokensCompact(tb.tokenCount)}`);
        }
      }
      break;

    case 'thinking-text':
      for (const item of items) {
        if (item.category !== 'thinking-text') continue;
        for (const bd of item.breakdown) {
          lines.push(`${bd.type} ${formatTokensCompact(bd.tokenCount)}`);
        }
      }
      break;

    case 'task-coordination':
      for (const item of items) {
        if (item.category !== 'task-coordination') continue;
        for (const bd of item.breakdown) {
          lines.push(`${bd.label} ${formatTokensCompact(bd.tokenCount)}`);
        }
      }
      break;

    case 'user-message':
      for (const item of items) {
        if (item.category !== 'user-message') continue;
        const preview = item.textPreview.length > 40
          ? item.textPreview.slice(0, 40) + '...'
          : item.textPreview;
        lines.push(`"${preview}" ${formatTokensCompact(item.estimatedTokens)}`);
      }
      break;
  }

  return lines;
}
