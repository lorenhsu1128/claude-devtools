/**
 * TUI Markdown renderer — simple regex-based parser that converts
 * markdown text into Ink <Text> elements for the terminal.
 *
 * Does NOT use unified/remark to avoid ESM bundling issues.
 * Handles: headings, code blocks (with syntax highlighting), inline code,
 * bold, italic, links, lists, blockquotes, horizontal rules.
 */

import React, { useMemo } from 'react';

import { Box, Text } from 'ink';

import { highlightCodeLine } from '../../utils/syntaxHighlight';

// =============================================================================
// Props
// =============================================================================

interface MarkdownTextProps {
  text: string;
  maxLines?: number;
}

// =============================================================================
// Block-level parsing
// =============================================================================

type Block =
  | { type: 'heading'; depth: number; content: string }
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'blockquote'; content: string }
  | { type: 'list-item'; bullet: string; content: string }
  | { type: 'hr' }
  | { type: 'paragraph'; content: string };

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ──
    const codeMatch = /^```(\w*)/.exec(line);
    if (codeMatch) {
      const lang = codeMatch[1] ?? '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({ type: 'code', lang, lines: codeLines });
      continue;
    }

    // ── Heading ──
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      blocks.push({ type: 'heading', depth: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // ── Blockquote ──
    if (line.startsWith('> ') || line === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // ── Unordered list item ──
    const ulMatch = /^(\s*[-*+])\s+(.+)$/.exec(line);
    if (ulMatch) {
      blocks.push({ type: 'list-item', bullet: '- ', content: ulMatch[2] });
      i++;
      continue;
    }

    // ── Ordered list item ──
    const olMatch = /^(\s*\d+[.)]\s+)(.+)$/.exec(line);
    if (olMatch) {
      blocks.push({ type: 'list-item', bullet: olMatch[1], content: olMatch[2] });
      i++;
      continue;
    }

    // ── Empty line ──
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Paragraph (collect consecutive non-empty lines) ──
    const paraLines: string[] = [];
    while (
      i < lines.length
      && lines[i].trim() !== ''
      && !/^```/.test(lines[i])
      && !/^#{1,6}\s/.test(lines[i])
      && !/^(\s*[-*_]\s*){3,}$/.test(lines[i])
      && !/^>\s/.test(lines[i])
      && !/^\s*[-*+]\s/.test(lines[i])
      && !/^\s*\d+[.)]\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
    }
  }

  return blocks;
}

// =============================================================================
// Inline content renderer
// =============================================================================

function renderInline(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match: **bold**, *italic*, `inline code`, [link](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+?)`|\[([^\]]+?)\]\(([^)]+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    // Plain text before the match
    if (match.index > lastIndex) {
      nodes.push(<React.Fragment key={key++}>{content.slice(lastIndex, match.index)}</React.Fragment>);
    }

    if (match[2]) {
      // **bold** — white + bold for emphasis
      nodes.push(<Text key={key++} bold color="white">{match[2]}</Text>);
    } else if (match[3]) {
      // *italic*
      nodes.push(<Text key={key++} dimColor>{match[3]}</Text>);
    } else if (match[4]) {
      // `inline code`
      nodes.push(<Text key={key++} color="yellow">{match[4]}</Text>);
    } else if (match[5] && match[6]) {
      // [link](url)
      nodes.push(<Text key={key++} underline color="blue">{match[5]}</Text>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing text
  if (lastIndex < content.length) {
    nodes.push(<React.Fragment key={key++}>{content.slice(lastIndex)}</React.Fragment>);
  }

  return nodes.length > 0 ? nodes : [<React.Fragment key={0}>{content}</React.Fragment>];
}

// =============================================================================
// Block renderer
// =============================================================================

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case 'heading':
      return (
        <Text key={key} bold color="cyan">
          {'#'.repeat(block.depth)} {renderInline(block.content)}
        </Text>
      );

    case 'code':
      return (
        <Box key={key} flexDirection="column">
          <Text dimColor>{`\`\`\`${block.lang}`}</Text>
          {block.lines.map((line, li) => (
            <Box key={li} paddingLeft={1}>
              {block.lang ? highlightCodeLine(line, block.lang) : <Text>{line}</Text>}
            </Box>
          ))}
          <Text dimColor>{'```'}</Text>
        </Box>
      );

    case 'blockquote':
      return (
        <Text key={key} color="gray" wrap="wrap">
          {'│ '}{renderInline(block.content)}
        </Text>
      );

    case 'list-item':
      return (
        <Text key={key} wrap="wrap">
          {'  '}<Text color="cyan">{block.bullet}</Text>{renderInline(block.content)}
        </Text>
      );

    case 'hr':
      return <Text key={key} dimColor>{'─'.repeat(40)}</Text>;

    case 'paragraph':
      return (
        <Text key={key} wrap="wrap">
          {renderInline(block.content)}
        </Text>
      );
  }
}

// =============================================================================
// Main component
// =============================================================================

export const MarkdownText = ({ text, maxLines }: MarkdownTextProps): JSX.Element => {
  const elements = useMemo(() => {
    const blocks = parseBlocks(text);
    const rendered = blocks.map((block, i) => renderBlock(block, i));
    if (maxLines != null && maxLines > 0) {
      return rendered.slice(0, maxLines);
    }
    return rendered;
  }, [text, maxLines]);

  return (
    <Box flexDirection="column">
      {elements}
    </Box>
  );
};
