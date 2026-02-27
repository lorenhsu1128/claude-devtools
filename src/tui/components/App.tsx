/**
 * Root TUI layout: header + sidebar/main split + status bar.
 */

import { useEffect } from 'react';

import { Box, Text, useStdout } from 'ink';

import { useFileWatcher } from '../hooks/useFileWatcher';
import { useKeymap } from '../hooks/useKeymap';
import { useTuiStore } from '../store';

import { StatusBar } from './common/StatusBar';
import { ChatView } from './ChatView';
import { Sidebar } from './Sidebar';

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

  const selectedProjectId = useTuiStore((s) => s.selectedProjectId);
  const projects = useTuiStore((s) => s.projects);
  const projectName = projects.find((p) => p.id === selectedProjectId)?.name;

  return (
    <Box flexDirection="column" height={termRows}>
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">claude-devtools TUI</Text>
        {projectName ? <Text dimColor>[{projectName}]</Text> : null}
      </Box>

      {/* Main content: sidebar + chat */}
      <Box flexGrow={1}>
        <Sidebar />
        <ChatView />
      </Box>

      {/* Status bar */}
      <StatusBar />
    </Box>
  );
};
