/**
 * Right panel — scrollable chat items view.
 *
 * Uses offset-based windowing: renders a slice of chatItems
 * based on terminal height. Ink has no overflow:scroll.
 */

import { useMemo } from 'react';

import { formatDuration } from '@renderer/utils/formatters';
import { formatTokensCompact } from '@shared/utils/tokenFormatting';
import { Box, Text } from 'ink';

import { useScrollWindow } from '../hooks/useScrollWindow';
import { useTuiStore } from '../store';

import { AIItem } from './chat/AIItem';
import { CompactItem } from './chat/CompactItem';
import { SystemItem } from './chat/SystemItem';
import { UserItem } from './chat/UserItem';
import { LoadingSpinner } from './common/LoadingSpinner';
import { TokenBar } from './common/TokenBar';

import type { ChatItem } from '@renderer/types/groups';

/** Default context window size (200k) when model is unknown. */
const DEFAULT_CONTEXT_WINDOW = 200_000;

/** Compute aggregate session stats from chat items. */
function computeSessionStats(items: ChatItem[]): {
  totalTokens: number;
  totalDurationMs: number;
  turnCount: number;
} {
  let totalTokens = 0;
  let totalDurationMs = 0;
  let turnCount = 0;

  for (const item of items) {
    if (item.type === 'ai') {
      totalTokens += item.group.tokens.input + item.group.tokens.output;
      totalDurationMs += item.group.durationMs;
      turnCount++;
    }
  }
  return { totalTokens, totalDurationMs, turnCount };
}

export const ChatView = (): JSX.Element => {
  const {
    focusMode,
    chatItems,
    chatScrollOffset,
    chatLoading,
    chatError,
    expandedAIGroupIds,
    expandedAIGroupScrollOffsets,
    selectedSessionId,
    sessions,
    sessionIsOngoing,
  } = useTuiStore();

  const isFocused = focusMode === 'chat';
  const window = useScrollWindow(chatItems, chatScrollOffset);

  // Find session name for header
  const session = sessions.find((s) => s.id === selectedSessionId);
  const sessionLabel = session?.firstMessage?.slice(0, 50) ?? selectedSessionId ?? 'No session';

  // Compute session stats
  const stats = useMemo(() => computeSessionStats(chatItems), [chatItems]);

  if (!selectedSessionId) {
    return (
      <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>Select a session to view</Text>
      </Box>
    );
  }

  if (chatLoading) {
    return (
      <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <LoadingSpinner label="Loading session..." />
      </Box>
    );
  }

  if (chatError) {
    return (
      <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="red" paddingX={1}>
        <Text color="red">Error: {chatError}</Text>
      </Box>
    );
  }

  // Window slice
  const visibleItems = chatItems.slice(window.startIndex, window.startIndex + window.count);
  const totalItems = chatItems.length;

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : 'gray'}
    >
      {/* Header */}
      <Box flexDirection="column" paddingX={1}>
        <Box>
          <Text bold color={isFocused ? 'cyan' : 'white'}>
            Session: <Text wrap="truncate">{sessionLabel}</Text>
          </Text>
          <Text dimColor>
            {' '}
            ({chatScrollOffset + 1}/{totalItems})
            {sessionIsOngoing ? ' [LIVE]' : ''}
          </Text>
        </Box>
        {/* Stats line with token bar */}
        <Box>
          <Text dimColor>
            {stats.turnCount} turns · {formatDuration(stats.totalDurationMs)} ·{' '}
            {formatTokensCompact(stats.totalTokens)} tokens
          </Text>
        </Box>
        <TokenBar current={stats.totalTokens} max={DEFAULT_CONTEXT_WINDOW} width={16} />
      </Box>

      {/* Chat items */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visibleItems.map((item, i) => {
          const isFocusedItem = i === 0 && isFocused;
          const isExpanded = item.type === 'ai' && expandedAIGroupIds.has(item.group.id);
          // AI items: ▸/▾ (expandable), others: › (non-expandable)
          const cursor = isFocusedItem
            ? item.type === 'ai'
              ? isExpanded ? '▾ ' : '▸ '
              : '› '
            : '  ';

          let itemNode: JSX.Element | null;
          switch (item.type) {
            case 'user':
              itemNode = <UserItem group={item.group} />;
              break;
            case 'ai':
              itemNode = (
                <AIItem
                  group={item.group}
                  expanded={isExpanded}
                  displayOffset={isExpanded ? (expandedAIGroupScrollOffsets.get(item.group.id) ?? 0) : 0}
                  maxDisplayLines={window.availableRows - 2}
                />
              );
              break;
            case 'system':
              itemNode = <SystemItem group={item.group} />;
              break;
            case 'compact':
              itemNode = <CompactItem group={item.group} />;
              break;
            default:
              itemNode = null;
          }

          return (
            <Box key={item.group.id} flexDirection="row">
              <Text color={isFocusedItem ? 'cyan' : undefined}>{cursor}</Text>
              <Box flexDirection="column" flexGrow={1}>
                {itemNode}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Help bar — single line, truncated to prevent wrap overflow */}
      {isFocused ? (
        <Box flexDirection="column">
          <Box paddingX={1}>
            <Text dimColor wrap="truncate">{'─'.repeat(60)}</Text>
          </Box>
          <Box paddingX={1}>
            <Text dimColor wrap="truncate">
              j/k:nav Enter:expand d/u:page r:refresh Esc:back
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};
