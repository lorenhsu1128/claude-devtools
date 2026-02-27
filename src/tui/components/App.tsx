/**
 * Root TUI layout: header + breadcrumb + single full-width panel + status bar.
 */

import { useEffect } from 'react';

import { Box, Text, useStdout } from 'ink';

import { useFileWatcher } from '../hooks/useFileWatcher';
import { useKeymap } from '../hooks/useKeymap';
import { useTuiStore } from '../store';

import { BreadcrumbBar } from './common/BreadcrumbBar';
import { HelpOverlay } from './common/HelpOverlay';
import { StatusBar } from './common/StatusBar';
import { ChatView } from './ChatView';
import { ProjectListView } from './ProjectListView';
import { SessionListView } from './SessionListView';

export const App = (): JSX.Element => {
  // Register keyboard handler at root level
  useKeymap();

  // Register file watcher for live updates
  useFileWatcher();

  // Load projects on mount
  const loadProjects = useTuiStore((s) => s.loadProjects);
  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 24;

  const focusMode = useTuiStore((s) => s.focusMode);
  const showHelp = useTuiStore((s) => s.showHelp);

  return (
    <Box flexDirection="column" height={termRows}>
      {/* Header */}
      <Box paddingX={1} flexShrink={0}>
        <Text bold color="cyan">claude-devtools TUI</Text>
      </Box>

      {/* Breadcrumb */}
      <Box flexShrink={0}>
        <BreadcrumbBar />
      </Box>

      {/* Main content: full-width single panel (or help overlay) */}
      {showHelp ? (
        <Box flexGrow={1}>
          <HelpOverlay />
        </Box>
      ) : (
        <Box flexGrow={1} flexDirection="column">
          {focusMode === 'projects' && <ProjectListView />}
          {focusMode === 'sessions' && <SessionListView />}
          {focusMode === 'chat' && <ChatView />}
        </Box>
      )}

      {/* Status bar */}
      <Box flexShrink={0}>
        <StatusBar />
      </Box>
    </Box>
  );
};
