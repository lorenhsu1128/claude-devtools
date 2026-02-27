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

import { MarkdownText } from '../common/MarkdownText';

import type { UserGroup } from '@renderer/types/groups';

export const MAX_TEXT_LINES = 15;

interface UserItemProps {
  group: UserGroup;
  expanded?: boolean;
}

export const UserItem = ({ group, expanded = false }: UserItemProps): JSX.Element => {
  const time = new Date(group.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const rawText = group.content.text ?? group.content.rawText ?? '';
  const { text: truncatedText, remaining } = truncateLines(rawText, MAX_TEXT_LINES);

  const displayText = expanded ? rawText : truncatedText;
  const fileRefs = group.content.fileReferences;
  const maxFileRefs = expanded ? fileRefs.length : 5;
  const imageCount = group.content.images.length;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="green" bold>
        [User] <Text dimColor>{time}</Text>
      </Text>
      <MarkdownText text={displayText} />
      {!expanded && remaining > 0 ? (
        <Text dimColor>  ...{remaining} more lines</Text>
      ) : null}
      {fileRefs.length > 0 ? (
        <Text dimColor>
          {'  '}📎{' '}
          {fileRefs
            .slice(0, maxFileRefs)
            .map((f) => f.path)
            .join(', ')}
          {fileRefs.length > maxFileRefs ? ` +${fileRefs.length - maxFileRefs} more` : ''}
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
