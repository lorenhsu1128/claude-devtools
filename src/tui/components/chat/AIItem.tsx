/**
 * Renders an AIGroup chat item — collapsed (summary) or expanded (display items).
 *
 * Collapsed:
 *   [AI] 1.2s · 15.2k tokens · Read(2) Edit(1) Bash(1)
 *
 * Expanded (with sub-item cursor and pagination):
 *   [AI] 1.2s · 15.2k tokens                   [claude-sonnet-4-6]
 *   ↑ 3 hidden
 *   ▸ Edit login.ts - 3 -> 5 lines        ← cursor (inverse cyan)
 *   ⚙ Subagent: Explore — find auth files (2.3s)
 *   ────
 *   Fixed the validation logic by adding...
 *   ↓ 2 more
 */

import { formatDuration } from '@renderer/utils/formatters';
import { formatTokensCompact } from '@shared/utils/tokenFormatting';
import { Box, Text } from 'ink';

import { useTuiStore } from '../../store';
import { MarkdownText } from '../common/MarkdownText';

import { ToolItem } from './ToolItem';

import type {
  AIGroup,
  AIGroupDisplayItem,
  AIGroupLastOutput,
  EnhancedAIGroup,
} from '@renderer/types/groups';

interface AIItemProps {
  group: AIGroup;
  expanded: boolean;
  /** Whether this is the focused chat item. */
  isFocused?: boolean;
  /**
   * Cursor position within the expanded group.
   * 0 = header focused, 1..N = sub-item focused (1-based).
   */
  displayOffset?: number;
  /** Maximum number of display lines to show in the viewport. */
  maxDisplayLines?: number;
}

/**
 * Compute scroll window start to keep the cursor visible within
 * a sub-item list, similar to list view scroll.
 */
function computeSubItemScrollStart(
  cursorIndex: number,
  totalItems: number,
  maxVisible: number,
): number {
  if (totalItems <= maxVisible) return 0;
  const margin = Math.min(2, Math.floor(maxVisible / 4));
  let start = cursorIndex - margin;
  start = Math.max(0, Math.min(start, totalItems - maxVisible));
  return start;
}

export const AIItem = ({
  group,
  expanded,
  isFocused = false,
  displayOffset = 0,
  maxDisplayLines = 20,
}: AIItemProps): JSX.Element => {
  const enhanced = group as EnhancedAIGroup;
  const duration = formatDuration(group.durationMs);
  const totalTokens = group.tokens.input + group.tokens.output;
  const tokens = formatTokensCompact(totalTokens);
  const modelLabel = enhanced.mainModel?.name ?? '';

  if (!expanded) {
    const summary = enhanced.itemsSummary ?? '';
    return (
      <Box marginBottom={1}>
        <Text color="blue" bold>
          [AI]{' '}
        </Text>
        <Text dimColor>
          {duration} · {tokens} tokens
        </Text>
        {summary ? <Text dimColor> · {summary}</Text> : null}
      </Box>
    );
  }

  // Build a flat list of renderable entries: display items + last output
  const allEntries: ExpandedEntry[] = [];
  if (enhanced.displayItems) {
    for (const di of enhanced.displayItems) {
      allEntries.push({ kind: 'display', item: di });
    }
  }
  if (enhanced.lastOutput) {
    allEntries.push({ kind: 'output', output: enhanced.lastOutput });
  }

  const total = allEntries.length;

  // displayOffset is cursor position: 0 = header, 1..N = sub-items (1-based)
  // Compute scroll window to keep cursor visible
  const cursorItemIndex = displayOffset > 0 ? displayOffset - 1 : -1; // 0-based index into allEntries
  const scrollStart = cursorItemIndex >= 0
    ? computeSubItemScrollStart(cursorItemIndex, total, maxDisplayLines)
    : 0;
  const visibleEntries = allEntries.slice(scrollStart, scrollStart + maxDisplayLines);
  const hiddenAbove = scrollStart;
  const hiddenBelow = Math.max(0, total - scrollStart - maxDisplayLines);

  // Which visible entry has the cursor?
  const focusedVisibleIndex = cursorItemIndex >= 0 ? cursorItemIndex - scrollStart : -1;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Header */}
      <Box>
        <Text color="blue" bold>
          [AI]{' '}
        </Text>
        <Text dimColor>
          {duration} · {tokens} tokens
        </Text>
        {modelLabel ? <Text dimColor> [{modelLabel}]</Text> : null}
        {group.isOngoing ? <Text color="yellow"> [RUNNING]</Text> : null}
      </Box>

      {/* Hidden-above indicator */}
      {hiddenAbove > 0 ? (
        <Text dimColor>  ↑ {hiddenAbove} hidden</Text>
      ) : null}

      {/* Visible entries with sub-item cursor */}
      {visibleEntries.map((entry, i) => {
        const isSubFocused = isFocused && i === focusedVisibleIndex;
        const entryNode = entry.kind === 'display'
          ? <DisplayItem key={scrollStart + i} item={entry.item} />
          : <LastOutputRenderer key={`output-${scrollStart + i}`} output={entry.output} />;

        return (
          <Box key={`entry-${scrollStart + i}`} flexDirection="row">
            <Text color={isSubFocused ? 'cyan' : undefined} inverse={isSubFocused}>
              {isSubFocused ? '▸ ' : '  '}
            </Text>
            <Box flexDirection="column" flexGrow={1}>
              {entryNode}
            </Box>
          </Box>
        );
      })}

      {/* Hidden-below indicator */}
      {hiddenBelow > 0 ? (
        <Text dimColor>  ↓ {hiddenBelow} more</Text>
      ) : null}
    </Box>
  );
};

type ExpandedEntry =
  | { kind: 'display'; item: AIGroupDisplayItem }
  | { kind: 'output'; output: AIGroupLastOutput };

// ── Display item renderer ──

/**
 * Render a display item. Every case returns <Box flexDirection="column">
 * so that sibling entries have a consistent element structure for Ink.
 */
const DisplayItem = ({ item }: { item: AIGroupDisplayItem }): JSX.Element | null => {
  const expandedToolIds = useTuiStore((s) => s.expandedToolIds);

  switch (item.type) {
    case 'thinking':
      return (
        <Box flexDirection="column">
          <Text dimColor>
            💭 Thinking ({formatTokensCompact(item.tokenCount ?? 0)})
          </Text>
        </Box>
      );

    case 'tool':
      return (
        <Box flexDirection="column">
          <ToolItem tool={item.tool} expanded={expandedToolIds.has(item.tool.id)} />
        </Box>
      );

    case 'subagent': {
      const sa = item.subagent;
      const typeLabel = sa.subagentType ?? 'Task';
      const desc = sa.description ? ` — ${truncate(sa.description, 50)}` : '';
      const dur = formatDuration(sa.durationMs);
      const teamLabel =
        sa.team ? ` [${sa.team.memberName}]` : '';
      return (
        <Box flexDirection="column">
          <Text>
            <Text dimColor>⚙ </Text>
            <Text color="magenta">{typeLabel}</Text>
            <Text dimColor>
              {desc} ({dur}){teamLabel} ▸
            </Text>
          </Text>
        </Box>
      );
    }

    case 'slash': {
      const sl = item.slash;
      return (
        <Box flexDirection="column">
          <Text>
            <Text dimColor>/ </Text>
            <Text color="cyan">{sl.name}</Text>
            {sl.args ? <Text dimColor> {truncate(sl.args, 40)}</Text> : null}
          </Text>
        </Box>
      );
    }

    case 'teammate_message': {
      const tm = item.teammateMessage;
      return (
        <Box flexDirection="column">
          <Text>
            <Text dimColor>💬 </Text>
            <Text color="magenta">{tm.teammateId}</Text>
            <Text dimColor> {truncate(tm.summary, 60)}</Text>
          </Text>
        </Box>
      );
    }

    case 'subagent_input':
      return (
        <Box flexDirection="column">
          <Text dimColor wrap="wrap">
            📋 {truncate(item.content, 80)}
          </Text>
        </Box>
      );

    case 'compact_boundary': {
      const td = item.tokenDelta;
      const label = td
        ? `Phase ${item.phaseNumber}: ${formatTokensCompact(Math.abs(td.delta))} freed`
        : `Phase ${item.phaseNumber}`;
      return (
        <Box flexDirection="column">
          <Text dimColor>── {label} ──</Text>
        </Box>
      );
    }

    case 'output':
      return null; // Handled by LastOutputRenderer

    default:
      return null;
  }
};

// ── Last output renderer ──

/**
 * Render last output. Every case returns <Box flexDirection="column">
 * for consistent sibling structure.
 */
const LastOutputRenderer = ({
  output,
}: {
  output: AIGroupLastOutput | null;
}): JSX.Element | null => {
  if (!output) return null;

  switch (output.type) {
    case 'text':
      if (!output.text) return null;
      return (
        <Box flexDirection="column">
          <Text dimColor>────</Text>
          <Box>
            <MarkdownText text={truncate(output.text, 2000)} />
          </Box>
        </Box>
      );

    case 'tool_result':
      return (
        <Box flexDirection="column">
          <Text dimColor>────</Text>
          <Text color={output.isError ? 'red' : undefined} wrap="wrap">
            {output.toolName ? `${output.toolName}: ` : ''}
            {truncate(output.toolResult ?? '', 300)}
          </Text>
        </Box>
      );

    case 'interruption':
      return (
        <Box flexDirection="column">
          <Text color="yellow">
            ⚠ {output.interruptionMessage ?? 'Interrupted'}
          </Text>
        </Box>
      );

    case 'ongoing':
      return (
        <Box flexDirection="column">
          <Text color="yellow">⏳ Still running...</Text>
        </Box>
      );

    case 'plan_exit':
      return (
        <Box flexDirection="column">
          {output.planPreamble ? (
            <Text dimColor wrap="wrap">{truncate(output.planPreamble, 200)}</Text>
          ) : null}
          <Text color="cyan">📋 Plan ready for review</Text>
        </Box>
      );

    default:
      return null;
  }
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}
