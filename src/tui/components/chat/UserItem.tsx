/**
 * Renders a UserGroup chat item.
 *
 * [User] 14:30
 * Fix the login page validation bug
 *   📎 src/auth/login.ts, src/auth/types.ts
 *   🖼 2 images
 */

import { truncateLines } from '@tui/utils/textWrap';
import { Box, Text } from 'ink';

import type { UserGroup } from '@renderer/types/groups';

const MAX_TEXT_LINES = 15;

interface UserItemProps {
  group: UserGroup;
}

export const UserItem = ({ group }: UserItemProps): JSX.Element => {
  const time = new Date(group.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const rawText = group.content.text ?? group.content.rawText ?? '';
  const { text, remaining } = truncateLines(rawText, MAX_TEXT_LINES);

  const fileRefs = group.content.fileReferences;
  const imageCount = group.content.images.length;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="green" bold>
        [User] <Text dimColor>{time}</Text>
      </Text>
      <Text wrap="wrap">{text}</Text>
      {remaining > 0 ? (
        <Text dimColor>  ...{remaining} more lines</Text>
      ) : null}
      {fileRefs.length > 0 ? (
        <Text dimColor>
          {'  '}📎{' '}
          {fileRefs
            .slice(0, 5)
            .map((f) => f.path)
            .join(', ')}
          {fileRefs.length > 5 ? ` +${fileRefs.length - 5} more` : ''}
        </Text>
      ) : null}
      {imageCount > 0 ? (
        <Text dimColor>
          {'  '}🖼 {imageCount} image{imageCount > 1 ? 's' : ''}
        </Text>
      ) : null}
    </Box>
  );
};
