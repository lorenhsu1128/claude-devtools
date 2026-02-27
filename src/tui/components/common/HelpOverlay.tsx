/**
 * Full-screen help overlay showing all keybindings by mode.
 *
 * Displayed when the user presses `?`. Closes on `?` or `Esc`.
 */

import { Box, Text } from 'ink';

const SECTIONS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Global',
    keys: [
      ['?', 'Toggle this help'],
    ],
  },
  {
    title: 'Projects',
    keys: [
      ['\u2191/\u2193', 'Move up/down'],
      ['\u2192', 'Select project'],
      ['q', 'Quit'],
    ],
  },
  {
    title: 'Sessions',
    keys: [
      ['\u2191/\u2193', 'Move up/down'],
      ['\u2192', 'Select session'],
      ['\u2190', 'Back to projects'],
      ['/', 'Filter sessions'],
    ],
  },
  {
    title: 'Chat',
    keys: [
      ['\u2191/\u2193', 'Scroll / navigate'],
      ['\u2192', 'Expand / go deeper'],
      ['\u2190', 'Collapse / go back'],
      ['d/u', 'Page down/up'],
      ['/', 'Search in chat'],
      ['n/N', 'Next/prev match'],
      ['c', 'Context panel'],
      ['r', 'Refresh session'],
      ['Esc', 'Back / exit subagent'],
    ],
  },
];

/** Fixed inner width for the help box content. */
const INNER_WIDTH = 36;

export const HelpOverlay = (): JSX.Element => {
  return (
    <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        paddingY={0}
        width={INNER_WIDTH + 4}
      >
        <Text bold color="cyan">{' Help'}</Text>
        <Text> </Text>

        {SECTIONS.map((section, si) => (
          <Box key={section.title} flexDirection="column">
            <Text bold color="yellow">{` ${section.title}`}</Text>
            {section.keys.map(([key, desc]) => (
              <Text key={key}>
                {'   '}
                <Text color="green">{key.padEnd(9)}</Text>
                <Text>{desc}</Text>
              </Text>
            ))}
            {si < SECTIONS.length - 1 ? <Text> </Text> : null}
          </Box>
        ))}

        <Text> </Text>
        <Text dimColor>{' '.repeat(4)}Press ? or Esc to close</Text>
      </Box>
    </Box>
  );
};
