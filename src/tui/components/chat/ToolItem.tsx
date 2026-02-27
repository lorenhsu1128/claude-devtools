/**
 * Renders a LinkedToolItem — tool call with human-readable summary.
 *
 * Uses getToolSummary() for readable descriptions like:
 *   ▸ Read login.ts - lines 1-50
 *   ▸ Edit login.ts - 3 -> 5 lines
 *   ▸ Bash: pnpm test
 */

import { formatDuration } from '@renderer/utils/formatters';
import { getToolSummary } from '@renderer/utils/toolRendering/toolSummaryHelpers';
import { formatTokensCompact } from '@shared/utils/tokenFormatting';
import { Box, Text } from 'ink';

import type { LinkedToolItem } from '@renderer/types/groups';

interface ToolItemProps {
  tool: LinkedToolItem;
  expanded?: boolean;
}

export const ToolItem = ({ tool, expanded }: ToolItemProps): JSX.Element => {
  const summary = getToolSummary(tool.name, tool.input);
  const duration = tool.durationMs != null ? formatDuration(tool.durationMs) : '';
  const isError = tool.result?.isError === true;

  if (!expanded) {
    return (
      <Text>
        <Text dimColor>  ▸ </Text>
        <Text color={isError ? 'red' : 'yellow'}>{tool.name}</Text>
        <Text dimColor> {summary}</Text>
        {duration ? <Text dimColor> ({duration})</Text> : null}
        {isError ? <Text color="red"> ✗</Text> : null}
      </Text>
    );
  }

  const output = tool.outputPreview ?? '';
  const resultTokens = tool.result?.tokenCount;

  return (
    <Box flexDirection="column">
      <Text>
        <Text dimColor>  ▾ </Text>
        <Text color={isError ? 'red' : 'yellow'}>{tool.name}</Text>
        <Text dimColor> {summary}</Text>
        {duration ? <Text dimColor> ({duration})</Text> : null}
        {resultTokens ? <Text dimColor> [{formatTokensCompact(resultTokens)}]</Text> : null}
      </Text>
      {output ? (
        <Text dimColor wrap="wrap" color={isError ? 'red' : undefined}>
          {'    '}{truncate(output, 300)}
        </Text>
      ) : null}
      {tool.isOrphaned ? (
        <Text color="red">    (no result received)</Text>
      ) : null}
    </Box>
  );
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}
