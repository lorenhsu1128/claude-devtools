/**
 * Left sidebar — shows project list or session list depending on navigation state.
 *
 * Implements viewport-based scrolling for long lists: keeps the selected
 * item visible by adjusting a scroll window within the available rows.
 */

import { Box, Text, useStdout } from 'ink';

import { useTuiStore } from '../store';
import { getNonEmptyCategories,groupByDate } from '../utils/dateGrouping';

import { LoadingSpinner } from './common/LoadingSpinner';

const SIDEBAR_WIDTH = 32;

/** Rows reserved for sidebar chrome (border, header, padding). */
const SIDEBAR_CHROME_ROWS = 4;

export const Sidebar = (): JSX.Element => {
  const {
    focusMode,
    projects,
    selectedProjectIndex,
    selectedProjectId,
    projectsLoading,
    projectSessionCounts,
    sessions,
    selectedSessionIndex,
    sessionsLoading,
  } = useTuiStore();

  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const visibleRows = Math.max(termRows - SIDEBAR_CHROME_ROWS, 5);

  const isSidebarFocused = focusMode === 'projects' || focusMode === 'sessions';
  const showSessions = selectedProjectId !== null;

  return (
    <Box
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      borderStyle="single"
      borderColor={isSidebarFocused ? 'cyan' : 'gray'}
    >
      {/* Header */}
      <Box paddingX={1}>
        <Text bold color={isSidebarFocused ? 'cyan' : 'white'}>
          {showSessions ? 'Sessions' : 'Projects'}
        </Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {showSessions ? (
          <SessionList
            sessions={sessions}
            selectedIndex={selectedSessionIndex}
            loading={sessionsLoading}
            focused={focusMode === 'sessions'}
            visibleRows={visibleRows}
          />
        ) : (
          <ProjectList
            projects={projects}
            selectedIndex={selectedProjectIndex}
            loading={projectsLoading}
            focused={focusMode === 'projects'}
            visibleRows={visibleRows}
            sessionCounts={projectSessionCounts}
          />
        )}
      </Box>
    </Box>
  );
};

// ── Viewport scrolling ──

/**
 * Compute the start index of the visible window so that
 * selectedIndex is always within the viewport.
 */
function computeScrollStart(
  selectedIndex: number,
  totalItems: number,
  visibleRows: number,
): number {
  if (totalItems <= visibleRows) return 0;
  // Keep selection at least 2 rows from the edge when possible
  const margin = Math.min(2, Math.floor(visibleRows / 4));
  let start = selectedIndex - margin;
  start = Math.max(0, Math.min(start, totalItems - visibleRows));
  return start;
}

// ── Project List ──

interface ProjectListProps {
  projects: { id: string; name: string; sessions?: unknown[] }[];
  selectedIndex: number;
  loading: boolean;
  focused: boolean;
  visibleRows: number;
  sessionCounts: Map<string, number>;
}

const ProjectList = ({
  projects,
  selectedIndex,
  loading,
  focused,
  visibleRows,
  sessionCounts,
}: ProjectListProps): JSX.Element => {
  if (loading) return <LoadingSpinner label="Loading..." />;
  if (projects.length === 0) return <Text dimColor>No projects found</Text>;

  const start = computeScrollStart(selectedIndex, projects.length, visibleRows);
  const visible = projects.slice(start, start + visibleRows);
  const showScrollUp = start > 0;
  const showScrollDown = start + visibleRows < projects.length;

  return (
    <Box flexDirection="column">
      {showScrollUp ? <Text dimColor>  ↑ {start} more</Text> : null}
      {visible.map((project, vi) => {
        const i = start + vi;
        const isSelected = i === selectedIndex;
        const sessionCount = sessionCounts.get(project.id) ?? 0;
        return (
          <Text key={project.id} wrap="truncate">
            <Text color={isSelected && focused ? 'cyan' : undefined} bold={isSelected}>
              {isSelected ? '▸ ' : '  '}
            </Text>
            <Text color={isSelected && focused ? 'cyan' : undefined}>
              {project.name}
            </Text>
            <Text dimColor> {sessionCount}</Text>
          </Text>
        );
      })}
      {showScrollDown ? (
        <Text dimColor>  ↓ {projects.length - start - visibleRows} more</Text>
      ) : null}
    </Box>
  );
};

// ── Session List ──

interface SessionListProps {
  sessions: { id: string; firstMessage?: string; createdAt: number }[];
  selectedIndex: number;
  loading: boolean;
  focused: boolean;
  visibleRows: number;
}

const SessionList = ({
  sessions,
  selectedIndex,
  loading,
  focused,
  visibleRows,
}: SessionListProps): JSX.Element => {
  if (loading) return <LoadingSpinner label="Loading..." />;
  if (sessions.length === 0) return <Text dimColor>No sessions</Text>;

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
          ? session.firstMessage.slice(0, SIDEBAR_WIDTH - 6)
          : session.id.slice(0, 8);
        const time = new Date(session.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <Text key={session.id} wrap="truncate">
            <Text color={isSelected && focused ? 'cyan' : undefined} bold={isSelected}>
              {isSelected ? '▸ ' : '  '}
            </Text>
            <Text color={isSelected && focused ? 'cyan' : undefined}>
              {preview}
            </Text>
            <Text dimColor> {time}</Text>
          </Text>
        );
      })}
      {showScrollDown ? <Text dimColor>  ↓ more</Text> : null}
    </Box>
  );
};

type FlatSessionItem =
  | { kind: 'header'; label: string }
  | { kind: 'session'; session: { id: string; firstMessage?: string; createdAt: number }; globalIndex: number };

export { SIDEBAR_WIDTH as SIDEBAR_WIDTH_VALUE };
