/**
 * Renders a SystemGroup chat item.
 *
 * Collapsed:
 *   [System] pnpm test
 *     12 tests passed, 0 failed
 *     ...3 more lines
 *
 * Expanded (with line-level pagination when content exceeds viewport):
 *   [System] pnpm test
 *   ↑ 5 hidden
 *     line 6
 *     line 7
 *   ↓ 10 more
 */

import { truncateLines } from '@tui/utils/textWrap';
import { Box, Text } from 'ink';

import { MarkdownText } from '../common/MarkdownText';

import type { SystemGroup } from '@renderer/types/groups';

export const MAX_OUTPUT_LINES = 8;

interface SystemItemProps {
  group: SystemGroup;
  expanded?: boolean;
  /** Number of lines to skip from the top (line-level scroll). */
  lineOffset?: number;
  /** Maximum number of output lines to show in the viewport. */
  maxLines?: number;
}

export const SystemItem = ({ group, expanded, lineOffset = 0, maxLines = 30 }: SystemItemProps): JSX.Element => {
  const output = group.commandOutput ?? '';

  if (expanded) {
    const allLines = output.split('\n');
    const total = allLines.length;
    const visibleLines = allLines.slice(lineOffset, lineOffset + maxLines);
    const hiddenAbove = lineOffset;
    const hiddenBelow = Math.max(0, total - lineOffset - maxLines);

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">
          [System]{group.commandName ? ` ${group.commandName}` : ''}
        </Text>
        {hiddenAbove > 0 ? (
          <Text dimColor>  ↑ {hiddenAbove} hidden</Text>
        ) : null}
        {visibleLines.length > 0 ? (
          <MarkdownText text={visibleLines.join('\n')} />
        ) : null}
        {hiddenBelow > 0 ? (
          <Text dimColor>  ↓ {hiddenBelow} more</Text>
        ) : null}
      </Box>
    );
  }

  const { text: truncatedOutput, remaining } = truncateLines(output, MAX_OUTPUT_LINES);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="gray">
        [System]{group.commandName ? ` ${group.commandName}` : ''}
      </Text>
      {truncatedOutput ? (
        <MarkdownText text={truncatedOutput} />
      ) : null}
      {remaining > 0 ? (
        <Text dimColor>  ...{remaining} more lines</Text>
      ) : null}
    </Box>
  );
};
