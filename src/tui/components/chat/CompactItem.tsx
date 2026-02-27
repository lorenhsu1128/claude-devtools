/**
 * Renders a CompactGroup chat item (compaction boundary).
 */

import { formatTokensCompact } from '@shared/utils/tokenFormatting';
import { Box, Text } from 'ink';

import type { CompactGroup } from '@renderer/types/groups';

interface CompactItemProps {
  group: CompactGroup;
}

export const CompactItem = ({ group }: CompactItemProps): JSX.Element => {
  const delta = group.tokenDelta;
  const label = delta
    ? `Compaction: ${formatTokensCompact(Math.abs(delta.delta))} freed (${formatTokensCompact(delta.preCompactionTokens)} → ${formatTokensCompact(delta.postCompactionTokens)})`
    : 'Compaction';

  return (
    <Box marginBottom={1} justifyContent="center">
      <Text dimColor>── {label} ──</Text>
    </Box>
  );
};
