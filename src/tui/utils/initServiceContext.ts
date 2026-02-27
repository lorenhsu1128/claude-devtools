/**
 * ServiceContext factory for TUI mode.
 *
 * Mirrors the standalone.ts initialization pattern but without
 * HTTP server, notification manager, or SSH support.
 */

import { LocalFileSystemProvider, ServiceContext } from '@main/services';
import {
  getProjectsBasePath,
  getTodosBasePath,
  setClaudeBasePathOverride,
} from '@main/utils/pathDecoder';

export function createLocalServiceContext(): ServiceContext {
  const claudeRoot = process.env.CLAUDE_ROOT;
  if (claudeRoot) {
    setClaudeBasePathOverride(claudeRoot);
  }

  const context = new ServiceContext({
    id: 'local',
    type: 'local',
    fsProvider: new LocalFileSystemProvider(),
    projectsDir: getProjectsBasePath(),
    todosDir: getTodosBasePath(),
  });
  context.start();
  return context;
}
