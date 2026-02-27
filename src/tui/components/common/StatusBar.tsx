/**
 * Bottom status bar showing context-sensitive key hints.
 */

import { useTuiStore } from '@tui/store';
import { Box, Text } from 'ink';

import type { FocusMode } from '@tui/store';

const KEY_HINTS: Record<FocusMode, string> = {
  projects: '↑↓ Navigate  → Select  q Quit',
  sessions: '↑↓ Navigate  → Select  ← Back  / Filter',
  chat: '↑↓ Scroll  → Expand  ← Collapse/Back  d/u Page  / Search  c Context  r Refresh',
};

export const StatusBar = (): JSX.Element => {
  const focusMode = useTuiStore((s) => s.focusMode);

  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text dimColor>{KEY_HINTS[focusMode]}</Text>
    </Box>
  );
};
