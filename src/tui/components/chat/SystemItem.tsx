/**
 * Renders a SystemGroup chat item.
 *
 * [System] pnpm test
 *   12 tests passed, 0 failed
 *   ...3 more lines
 */

import { truncateLines } from '@tui/utils/textWrap';
import { Box, Text } from 'ink';

import type { SystemGroup } from '@renderer/types/groups';

const MAX_OUTPUT_LINES = 8;

interface SystemItemProps {
  group: SystemGroup;
}

export const SystemItem = ({ group }: SystemItemProps): JSX.Element => {
  const output = group.commandOutput ?? '';
  const { text: truncatedOutput, remaining } = truncateLines(output, MAX_OUTPUT_LINES);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="gray">
        [System]{group.commandName ? ` ${group.commandName}` : ''}
      </Text>
      {truncatedOutput ? (
        <Text dimColor wrap="wrap">
          {truncatedOutput}
        </Text>
      ) : null}
      {remaining > 0 ? (
        <Text dimColor>  ...{remaining} more lines</Text>
      ) : null}
    </Box>
  );
};
