/**
 * Right panel — scrollable chat items view.
 *
 * Uses offset-based windowing: renders a slice of chatItems
 * based on terminal height. Ink has no overflow:scroll.
 */

import { useMemo } from 'react';

import { formatDuration } from '@renderer/utils/formatters';
import { formatTokensCompact } from '@shared/utils/tokenFormatting';
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
    focusMode,
    chatItems,
    chatScrollOffset,
    chatLoading,
    chatError,
    expandedAIGroupIds,
    expandedAIGroupScrollOffsets,
    expandedUserIds,
    expandedSystemIds,
    expandedSystemScrollOffsets,
    selectedSessionId,
    sessions,
    sessionIsOngoing,
    showContextPanel,
    subagentStack,
    subagentLabel,
    chatSearchActive,
    chatSearchQuery,
    chatSearchMatches,
    currentChatSearchIndex,
    setChatSearchQuery,
    deactivateChatSearch,
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
      {/* Header with breadcrumbs */}
      <Box flexDirection="column" paddingX={1}>
        <Box>
          {subagentStack.length > 0 ? (
            <Text bold wrap="truncate">
              <Text dimColor>{subagentStack[0].label}</Text>
              {subagentStack.slice(1).map((entry, i) => (
                <Text key={i} dimColor> {'>'} {entry.label}</Text>
              ))}
              <Text dimColor> {'>'} </Text>
              <Text color={isFocused ? 'cyan' : 'magenta'}>{subagentLabel}</Text>
            </Text>
          ) : (
            <Text bold color={isFocused ? 'cyan' : 'white'}>
              Session: <Text wrap="truncate">{sessionLabel}</Text>
            </Text>
          )}
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
      {showContextPanel && isFocused ? (
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

      {/* Chat items */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visibleItems.map((item, i) => {
          const actualIndex = window.startIndex + i;
          const isFocusedItem = i === 0 && isFocused;
          const isAIExpanded = item.type === 'ai' && expandedAIGroupIds.has(item.group.id);
          const isUserExpanded = item.type === 'user' && expandedUserIds.has(item.group.id);
          const isSystemExpanded = item.type === 'system' && expandedSystemIds.has(item.group.id);
          // Check if user item has truncated content (matching UserItem's MAX_TEXT_LINES = 15)
          const isUserExpandable = item.type === 'user'
            && truncateLines(item.group.content.text ?? item.group.content.rawText ?? '', 15).remaining > 0;
          const isSystemExpandable = item.type === 'system'
            && truncateLines(item.group.commandOutput ?? '', MAX_OUTPUT_LINES).remaining > 0;
          // Check if current item has a search match
          const hasSearchMatch = chatSearchMatches.length > 0
            && currentChatSearchIndex >= 0
            && chatSearchMatches[currentChatSearchIndex]?.itemIndex === actualIndex;
          // AI/expandable items: ▸/▾ (expandable), others: › (non-expandable)
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

          return (
            <Box key={item.group.id} flexDirection="row">
              <Text color={isFocusedItem ? 'cyan' : hasSearchMatch ? 'yellow' : undefined}>{cursor}</Text>
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
              j/k:nav Enter:expand d/u:page c:context r:refresh Esc:back
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};
