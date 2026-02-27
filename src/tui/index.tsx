/**
 * TUI entry point for claude-devtools.
 *
 * Initializes ServiceContext (local only), wires it into the Zustand store,
 * and renders the Ink-based terminal UI.
 *
 * Environment variables:
 * - CLAUDE_ROOT: Path to .claude directory (default ~/.claude)
 */

import { render } from 'ink';

import { App } from './components/App';
import { createLocalServiceContext } from './utils/initServiceContext';
import { setServiceContext } from './store';

const serviceContext = createLocalServiceContext();
setServiceContext(serviceContext);

function shutdown(): void {
  serviceContext.dispose();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

render(<App />);
