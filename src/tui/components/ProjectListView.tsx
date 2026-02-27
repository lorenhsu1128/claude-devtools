/**
 * Full-width project list view.
 *
 * Replaces the project portion of the old Sidebar with a full-width layout.
 */

import { Box, Text, useStdout } from 'ink';

import { useTuiStore } from '../store';

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

export const ProjectListView = (): JSX.Element => {
  const projects = useTuiStore((s) => s.projects);
  const selectedProjectIndex = useTuiStore((s) => s.selectedProjectIndex);
  const projectsLoading = useTuiStore((s) => s.projectsLoading);
  const projectSessionCounts = useTuiStore((s) => s.projectSessionCounts);

  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;
  const visibleRows = Math.max(termRows - CHROME_ROWS, 5);

  if (projectsLoading) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <LoadingSpinner label="Loading projects..." />
      </Box>
    );
  }

  if (projects.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text dimColor>No projects found</Text>
      </Box>
    );
  }

  const start = computeScrollStart(selectedProjectIndex, projects.length, visibleRows);
  const visible = projects.slice(start, start + visibleRows);
  const showScrollUp = start > 0;
  const showScrollDown = start + visibleRows < projects.length;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {showScrollUp ? <Text dimColor>  ↑ {start} more</Text> : null}
      {visible.map((project, vi) => {
        const i = start + vi;
        const isSelected = i === selectedProjectIndex;
        const sessionCount = projectSessionCounts.get(project.id) ?? 0;
        return (
          <Text key={project.id} wrap="truncate" inverse={isSelected}>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {isSelected ? '▸ ' : '  '}
            </Text>
            <Text color={isSelected ? 'cyan' : undefined}>
              {project.name}
            </Text>
            <Text dimColor={!isSelected}> {sessionCount}</Text>
          </Text>
        );
      })}
      {showScrollDown ? (
        <Text dimColor>  ↓ {projects.length - start - visibleRows} more</Text>
      ) : null}
    </Box>
  );
};
