/**
 * Full-width scrollable chat items view.
 *
 * Uses offset-based windowing: renders a slice of chatItems
 * based on terminal height. Ink has no overflow:scroll.
 */

import { useMemo } from 'react';

import { formatDuration } from '@renderer/utils/formatters';
import { truncateLines } from '@tui/utils/textWrap';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

import { useScrollWindow } from '../hooks/useScrollWindow';
import { useTuiStore } from '../store';

import { AIItem } from './chat/AIItem';
import { CompactItem } from './chat/CompactItem';
import { ContextPanel } from './chat/ContextPanel';
import { MAX_OUTPUT_LINES, SystemItem } from './chat/SystemItem';
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
    chatItems,
    chatScrollOffset,
    chatItemLineOffset,
    chatLoading,
    chatError,
    expandedAIGroupIds,
    expandedAIGroupScrollOffsets,
    expandedUserIds,
    expandedSystemIds,
    expandedSystemScrollOffsets,
    selectedSessionId,
    sessionIsOngoing,
    showContextPanel,
    chatSearchActive,
    chatSearchQuery,
    chatSearchMatches,
    currentChatSearchIndex,
    setChatSearchQuery,
    deactivateChatSearch,
  } = useTuiStore();

  const window = useScrollWindow(chatItems, chatScrollOffset);

  // Compute session stats
  const stats = useMemo(() => computeSessionStats(chatItems), [chatItems]);

  if (!selectedSessionId) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text dimColor>Select a session to view</Text>
      </Box>
    );
  }

  if (chatLoading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <LoadingSpinner label="Loading session..." />
      </Box>
    );
  }

  if (chatError) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text color="red">Error: {chatError}</Text>
      </Box>
    );
  }

  // Window slice
  const visibleItems = chatItems.slice(window.startIndex, window.startIndex + window.count);
  const totalItems = chatItems.length;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Stats header */}
      <Box flexDirection="column" paddingX={1} flexShrink={0}>
        <Box>
          <Text dimColor>
            ({chatScrollOffset + 1}/{totalItems})
            {sessionIsOngoing ? ' [LIVE]' : ''}
            {' · '}{stats.turnCount} turns · {formatDuration(stats.totalDurationMs)} ·{' '}
            {stats.totalTokens.toLocaleString()} tokens
          </Text>
        </Box>
        <TokenBar current={stats.totalTokens} max={DEFAULT_CONTEXT_WINDOW} width={16} />
      </Box>

      {/* Chat search bar */}
      {chatSearchActive ? (
        <Box paddingX={1}>
          <Text color="cyan">/ </Text>
          <TextInput
            value={chatSearchQuery}
            onChange={setChatSearchQuery}
            onSubmit={() => {
              if (chatSearchMatches.length > 0) deactivateChatSearch();
            }}
          />
          {chatSearchMatches.length > 0 ? (
            <Text dimColor>
              {' '}{currentChatSearchIndex + 1}/{chatSearchMatches.length}
            </Text>
          ) : chatSearchQuery ? (
            <Text dimColor color="red"> no matches</Text>
          ) : null}
        </Box>
      ) : chatSearchMatches.length > 0 && !chatSearchActive ? (
        <Box paddingX={1}>
          <Text dimColor>
            search: {currentChatSearchIndex + 1}/{chatSearchMatches.length} matches
          </Text>
        </Box>
      ) : null}

      {/* Context panel */}
      {showContextPanel ? (
        (() => {
          const focusedItem = chatItems[chatScrollOffset];
          if (focusedItem?.type === 'ai') {
            // Compute 1-based turn number from AI groups
            let turn = 0;
            for (let i = 0; i <= chatScrollOffset && i < chatItems.length; i++) {
              if (chatItems[i].type === 'ai') turn++;
            }
            return <ContextPanel aiGroupId={focusedItem.group.id} turnNumber={turn} />;
          }
          return (
            <Box paddingX={1}>
              <Text dimColor>Move to an AI turn to view context</Text>
            </Box>
          );
        })()
      ) : null}

      {/* Chat items — overflow="hidden" + marginTop for line-by-line visual scrolling */}
      <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
        <Box flexDirection="column" marginTop={-chatItemLineOffset}>
        {visibleItems.map((item, i) => {
          const actualIndex = window.startIndex + i;
          const isFocusedItem = i === 0;
          const isAIExpanded = item.type === 'ai' && expandedAIGroupIds.has(item.group.id);
          const isUserExpanded = item.type === 'user' && expandedUserIds.has(item.group.id);
          const isSystemExpanded = item.type === 'system' && expandedSystemIds.has(item.group.id);
          const isUserExpandable = item.type === 'user'
            && truncateLines(item.group.content.text ?? item.group.content.rawText ?? '', 15).remaining > 0;
          const isSystemExpandable = item.type === 'system'
            && truncateLines(item.group.commandOutput ?? '', MAX_OUTPUT_LINES).remaining > 0;
          const hasSearchMatch = chatSearchMatches.length > 0
            && currentChatSearchIndex >= 0
            && chatSearchMatches[currentChatSearchIndex]?.itemIndex === actualIndex;
          const cursor = isFocusedItem
            ? item.type === 'ai'
              ? isAIExpanded ? '▾ ' : '▸ '
              : isUserExpandable
                ? isUserExpanded ? '▾ ' : '▸ '
                : isSystemExpandable
                  ? isSystemExpanded ? '▾ ' : '▸ '
                  : '› '
            : hasSearchMatch ? '* ' : '  ';

          let itemNode: JSX.Element | null;
          switch (item.type) {
            case 'user':
              itemNode = <UserItem group={item.group} expanded={isUserExpanded} />;
              break;
            case 'ai':
              itemNode = (
                <AIItem
                  group={item.group}
                  expanded={isAIExpanded}
                  isFocused={isFocusedItem}
                  displayOffset={isAIExpanded ? (expandedAIGroupScrollOffsets.get(item.group.id) ?? 0) : 0}
                  maxDisplayLines={window.availableRows - 2}
                />
              );
              break;
            case 'system':
              itemNode = (
                <SystemItem
                  group={item.group}
                  expanded={isSystemExpanded}
                  lineOffset={isSystemExpanded ? (expandedSystemScrollOffsets.get(item.group.id) ?? 0) : 0}
                  maxLines={window.availableRows - 2}
                />
              );
              break;
            case 'compact':
              itemNode = <CompactItem group={item.group} />;
              break;
            default:
              itemNode = null;
          }

          // When a sub-item inside an expanded AI group has cursor, don't inverse the chat-level cursor
          const subItemHasCursor = isFocusedItem && isAIExpanded
            && (expandedAIGroupScrollOffsets.get(item.group.id) ?? 0) > 0;

          return (
            <Box key={item.group.id} flexDirection="row">
              <Text
                color={isFocusedItem ? 'cyan' : hasSearchMatch ? 'yellow' : undefined}
                inverse={isFocusedItem && !subItemHasCursor}
              >
                {cursor}
              </Text>
              <Box flexDirection="column" flexGrow={1}>
                {itemNode}
              </Box>
            </Box>
          );
        })}
        </Box>
      </Box>

      {/* Help bar */}
      <Box flexDirection="column" flexShrink={0}>
        <Box paddingX={1}>
          <Text dimColor wrap="truncate">{'─'.repeat(60)}</Text>
        </Box>
        <Box paddingX={1}>
          <Text dimColor wrap="truncate">
            ↑↓:nav →:expand ←:back d/u:page c:context r:refresh
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
