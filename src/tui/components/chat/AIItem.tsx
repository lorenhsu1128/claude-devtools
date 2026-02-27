/**
 * Renders an AIGroup chat item — collapsed (summary) or expanded (display items).
 *
 * Collapsed:
 *   [AI] 1.2s · 15.2k tokens · Read(2) Edit(1) Bash(1)
 *
 * Expanded (with sub-item pagination when content exceeds viewport):
 *   [AI] 1.2s · 15.2k tokens                   [claude-sonnet-4-6]
 *   ↑ 3 hidden
 *   ▸ Edit login.ts - 3 -> 5 lines
 *   ⚙ Subagent: Explore — find auth files (2.3s)
 *   ────
 *   Fixed the validation logic by adding...
 *   ↓ 2 more
 */

import { formatDuration } from '@renderer/utils/formatters';
import { formatTokensCompact } from '@shared/utils/tokenFormatting';
import { Box, Text } from 'ink';

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
  /** Number of display items to skip from the top (sub-item scroll). */
  displayOffset?: number;
  /** Maximum number of display lines to show in the viewport. */
  maxDisplayLines?: number;
}

export const AIItem = ({
  group,
  expanded,
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
  const visibleEntries = allEntries.slice(displayOffset, displayOffset + maxDisplayLines);
  const hiddenAbove = displayOffset;
  const hiddenBelow = Math.max(0, total - displayOffset - maxDisplayLines);

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

      {/* Visible entries */}
      {visibleEntries.map((entry, i) => {
        if (entry.kind === 'display') {
          return <DisplayItem key={displayOffset + i} item={entry.item} />;
        }
        return <LastOutputRenderer key={`output-${displayOffset + i}`} output={entry.output} />;
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

const DisplayItem = ({ item }: { item: AIGroupDisplayItem }): JSX.Element | null => {
  switch (item.type) {
    case 'thinking':
      return (
        <Text dimColor>
          {'  '}💭 Thinking ({formatTokensCompact(item.tokenCount ?? 0)})
        </Text>
      );

    case 'tool':
      return <ToolItem tool={item.tool} />;

    case 'subagent': {
      const sa = item.subagent;
      const typeLabel = sa.subagentType ?? 'Task';
      const desc = sa.description ? ` — ${truncate(sa.description, 50)}` : '';
      const dur = formatDuration(sa.durationMs);
      const teamLabel =
        sa.team ? ` [${sa.team.memberName}]` : '';
      return (
        <Text>
          <Text dimColor>{'  '}⚙ </Text>
          <Text color="magenta">{typeLabel}</Text>
          <Text dimColor>
            {desc} ({dur}){teamLabel}
          </Text>
        </Text>
      );
    }

    case 'slash': {
      const sl = item.slash;
      return (
        <Text>
          <Text dimColor>{'  '}/ </Text>
          <Text color="cyan">{sl.name}</Text>
          {sl.args ? <Text dimColor> {truncate(sl.args, 40)}</Text> : null}
        </Text>
      );
    }

    case 'teammate_message': {
      const tm = item.teammateMessage;
      return (
        <Text>
          <Text dimColor>{'  '}💬 </Text>
          <Text color="magenta">{tm.teammateId}</Text>
          <Text dimColor> {truncate(tm.summary, 60)}</Text>
        </Text>
      );
    }

    case 'subagent_input':
      return (
        <Text dimColor wrap="wrap">
          {'  '}📋 {truncate(item.content, 80)}
        </Text>
      );

    case 'compact_boundary': {
      const td = item.tokenDelta;
      const label = td
        ? `Phase ${item.phaseNumber}: ${formatTokensCompact(Math.abs(td.delta))} freed`
        : `Phase ${item.phaseNumber}`;
      return <Text dimColor>{'  '}── {label} ──</Text>;
    }

    case 'output':
      return null; // Handled by LastOutputRenderer

    default:
      return null;
  }
};

// ── Last output renderer ──

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
        <>
          <Text dimColor>{'  '}────</Text>
          <Text wrap="wrap">{'  '}{truncate(output.text, 500)}</Text>
        </>
      );

    case 'tool_result':
      return (
        <>
          <Text dimColor>{'  '}────</Text>
          <Text color={output.isError ? 'red' : undefined} wrap="wrap">
            {'  '}
            {output.toolName ? `${output.toolName}: ` : ''}
            {truncate(output.toolResult ?? '', 300)}
          </Text>
        </>
      );

    case 'interruption':
      return (
        <Text color="yellow">
          {'  '}⚠ {output.interruptionMessage ?? 'Interrupted'}
        </Text>
      );

    case 'ongoing':
      return <Text color="yellow">{'  '}⏳ Still running...</Text>;

    case 'plan_exit':
      return (
        <>
          {output.planPreamble ? (
            <Text dimColor wrap="wrap">{'  '}{truncate(output.planPreamble, 200)}</Text>
          ) : null}
          <Text color="cyan">{'  '}📋 Plan ready for review</Text>
        </>
      );

    default:
      return null;
  }
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}
