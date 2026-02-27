/**
 * Navigation breadcrumb bar showing current location in the hierarchy.
 *
 * Displays: Projects > ProjectName > SessionLabel > SubagentLabel
 * Active segment is cyan, ancestors are dim.
 */

import { Box, Text } from 'ink';

import { useTuiStore } from '../../store';

/** Max characters per breadcrumb segment before truncation. */
const MAX_SEGMENT_LEN = 40;

function truncSeg(text: string): string {
  return text.length > MAX_SEGMENT_LEN ? text.slice(0, MAX_SEGMENT_LEN - 1) + '\u2026' : text;
}

export const BreadcrumbBar = (): JSX.Element => {
  const focusMode = useTuiStore((s) => s.focusMode);
  const projects = useTuiStore((s) => s.projects);
  const selectedProjectId = useTuiStore((s) => s.selectedProjectId);
  const sessions = useTuiStore((s) => s.sessions);
  const selectedSessionId = useTuiStore((s) => s.selectedSessionId);
  const subagentStack = useTuiStore((s) => s.subagentStack);
  const subagentLabel = useTuiStore((s) => s.subagentLabel);

  const projectName = projects.find((p) => p.id === selectedProjectId)?.name;
  const session = sessions.find((s) => s.id === selectedSessionId);
  const sessionLabel = session?.firstMessage?.slice(0, 50) ?? selectedSessionId ?? '';

  const sep = <Text dimColor> {'>'} </Text>;

  if (focusMode === 'projects') {
    return (
      <Box paddingX={1}>
        <Text wrap="truncate">
          <Text color="cyan" bold>Projects</Text>
        </Text>
      </Box>
    );
  }

  if (focusMode === 'sessions') {
    return (
      <Box paddingX={1}>
        <Text wrap="truncate">
          <Text dimColor>Projects</Text>
          {sep}
          <Text color="cyan" bold>{truncSeg(projectName ?? '')}</Text>
        </Text>
      </Box>
    );
  }

  // chat mode
  const segments: JSX.Element[] = [];

  // Projects (dim)
  segments.push(<Text key="projects" dimColor>Projects</Text>);

  // Project name (dim)
  if (projectName) {
    segments.push(<Text key="sep-proj" dimColor> {'>'} </Text>);
    segments.push(<Text key="project" dimColor>{truncSeg(projectName)}</Text>);
  }

  // Subagent stack entries (dim)
  if (subagentStack.length > 0) {
    // Root session label
    segments.push(<Text key="sep-sess" dimColor> {'>'} </Text>);
    segments.push(<Text key="session" dimColor>{truncSeg(subagentStack[0].label)}</Text>);

    // Intermediate subagent entries
    for (let i = 1; i < subagentStack.length; i++) {
      segments.push(<Text key={`sep-sub-${i}`} dimColor> {'>'} </Text>);
      segments.push(<Text key={`sub-${i}`} dimColor>{truncSeg(subagentStack[i].label)}</Text>);
    }

    // Current subagent (active, cyan)
    if (subagentLabel) {
      segments.push(<Text key="sep-cur" dimColor> {'>'} </Text>);
      segments.push(<Text key="current" color="cyan" bold>{truncSeg(subagentLabel)}</Text>);
    }
  } else {
    // No subagent — session label is the active segment
    segments.push(<Text key="sep-sess" dimColor> {'>'} </Text>);
    segments.push(<Text key="session" color="cyan" bold>{truncSeg(sessionLabel)}</Text>);
  }

  return (
    <Box paddingX={1}>
      <Text wrap="truncate">{segments}</Text>
    </Box>
  );
};
