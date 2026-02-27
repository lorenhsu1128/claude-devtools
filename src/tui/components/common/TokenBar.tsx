/**
 * ASCII token progress bar: ████░░░░ 72.5k / 100k (72%)
 */

import { formatTokensCompact } from '@shared/utils/tokenFormatting';
import { Text } from 'ink';

interface TokenBarProps {
  current: number;
  max: number;
  width?: number;
}

export const TokenBar = ({ current, max, width = 20 }: TokenBarProps): JSX.Element => {
  const ratio = max > 0 ? Math.min(current / max, 1) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const pct = Math.round(ratio * 100);

  return (
    <Text>
      <Text color="cyan">{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text dimColor>
        {' '}
        {formatTokensCompact(current)} / {formatTokensCompact(max)} ({pct}%)
      </Text>
    </Text>
  );
};
