/**
 * Full-width session list view with filter support.
 *
 * Replaces the session portion of the old Sidebar with a full-width layout.
 * Sessions are grouped by date categories (Today, Yesterday, etc.).
 */

import { Box, Text, useStdout } from 'ink';
import TextInput from 'ink-text-input';

import { useTuiStore } from '../store';
import { getNonEmptyCategories, groupByDate } from '../utils/dateGrouping';

import { LoadingSpinner } from './common/LoadingSpinner';

/** Rows reserved for chrome: title(1) + breadcrumb(1) + statusbar border+text(2) = 4 */
const CHROME_ROWS = 4;

function computeScrollStart(
  selectedIndex: number,
  totalItems: number,
  visibleRows: number,
): number {
  if (totalItems <= visibleRows) return 0;
  const margin = Math.min(2, Math.floor(visibleRows / 4));
  let start = selectedIndex - margin;
  start = Math.max(0, Math.min(start, totalItems - visibleRows));
  return start;
}

export const SessionListView = (): JSX.Element => {
  const sessions = useTuiStore((s) => s.sessions);
  const selectedSessionIndex = useTuiStore((s) => s.selectedSessionIndex);
  const sessionsLoading = useTuiStore((s) => s.sessionsLoading);
  const sessionFilterActive = useTuiStore((s) => s.sessionFilterActive);
  const sessionFilter = useTuiStore((s) => s.sessionFilter);
  const setSessionFilter = useTuiStore((s) => s.setSessionFilter);
  const deactivateSessionFilter = useTuiStore((s) => s.deactivateSessionFilter);
  const navigateList = useTuiStore((s) => s.navigateList);

  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const termCols = stdout?.columns ?? 80;
  const baseVisibleRows = Math.max(termRows - CHROME_ROWS, 5);
  const visibleRows = sessionFilterActive ? baseVisibleRows - 1 : baseVisibleRows;

  // Filter sessions when filter is active
  const filteredSessions = sessionFilterActive && sessionFilter
    ? sessions.filter((s) => (s.firstMessage ?? '').toLowerCase().includes(sessionFilter.toLowerCase()))
    : sessions;

  // Handle TextInput submit — select highlighted session
  const handleFilterSubmit = (): void => {
    const session = filteredSessions[selectedSessionIndex];
    if (session) {
      deactivateSessionFilter();
      void useTuiStore.getState().selectSession(session.id);
    }
  };

  if (sessionsLoading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <LoadingSpinner label="Loading sessions..." />
      </Box>
    );
  }

  // Preview width uses full terminal
  const previewWidth = Math.max(termCols - 20, 30);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {/* Session filter input */}
      {sessionFilterActive ? (
        <Box>
          <Text color="cyan">/ </Text>
          <TextInput
            value={sessionFilter}
            onChange={(val) => {
              setSessionFilter(val);
              navigateList('sessions', 0, filteredSessions.length);
            }}
            onSubmit={handleFilterSubmit}
          />
          <Text dimColor> ({filteredSessions.length})</Text>
        </Box>
      ) : null}

      {/* Session list */}
      {filteredSessions.length === 0 ? (
        <Text dimColor>No sessions</Text>
      ) : (
        <SessionItems
          sessions={filteredSessions}
          selectedIndex={selectedSessionIndex}
          visibleRows={visibleRows}
          previewWidth={previewWidth}
        />
      )}
    </Box>
  );
};

// ── Session Items with date grouping ──

type FlatSessionItem =
  | { kind: 'header'; label: string }
  | { kind: 'session'; session: { id: string; firstMessage?: string; createdAt: number }; globalIndex: number };

interface SessionItemsProps {
  sessions: { id: string; firstMessage?: string; createdAt: number }[];
  selectedIndex: number;
  visibleRows: number;
  previewWidth: number;
}

const SessionItems = ({
  sessions,
  selectedIndex,
  visibleRows,
  previewWidth,
}: SessionItemsProps): JSX.Element => {
  // Group sessions by date
  const grouped = groupByDate(sessions);
  const categories = getNonEmptyCategories(grouped);

  // Build flat list with date headers for display
  const flatItems: FlatSessionItem[] = [];
  let globalIndex = 0;
  for (const cat of categories) {
    flatItems.push({ kind: 'header', label: cat });
    for (const session of grouped[cat]) {
      flatItems.push({ kind: 'session', session, globalIndex });
      globalIndex++;
    }
  }

  // Find the flat index of the selected session
  const selectedFlatIndex = flatItems.findIndex(
    (item) => item.kind === 'session' && item.globalIndex === selectedIndex,
  );

  const start = computeScrollStart(
    Math.max(0, selectedFlatIndex),
    flatItems.length,
    visibleRows,
  );
  const visible = flatItems.slice(start, start + visibleRows);
  const showScrollUp = start > 0;
  const showScrollDown = start + visibleRows < flatItems.length;

  return (
    <Box flexDirection="column">
      {showScrollUp ? <Text dimColor>  ↑ more</Text> : null}
      {visible.map((item) => {
        if (item.kind === 'header') {
          return (
            <Text key={`hdr-${item.label}`} dimColor bold>
              {item.label}
            </Text>
          );
        }
        const { session, globalIndex: gi } = item;
        const isSelected = gi === selectedIndex;
        const preview = session.firstMessage
          ? session.firstMessage.slice(0, previewWidth)
          : session.id.slice(0, 8);
        const time = new Date(session.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <Text key={session.id} wrap="truncate" inverse={isSelected}>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {isSelected ? '▸ ' : '  '}
            </Text>
            <Text color={isSelected ? 'cyan' : undefined}>
              {preview}
            </Text>
            <Text dimColor={!isSelected}> {time}</Text>
          </Text>
        );
      })}
      {showScrollDown ? <Text dimColor>  ↓ more</Text> : null}
    </Box>
  );
};
