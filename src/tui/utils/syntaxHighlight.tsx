/**
 * TUI-only syntax highlighter — tokenizes code lines and renders
 * them as Ink <Text> elements with terminal colors.
 *
 * Independent from the renderer's syntaxHighlighter.ts (which uses
 * CSS custom properties for browser rendering).
 */

import React from 'react';

import { Text } from 'ink';

// =============================================================================
// Types
// =============================================================================

type CodeTokenType = 'keyword' | 'string' | 'comment' | 'number' | 'type' | 'operator' | 'text';

interface CodeToken {
  type: CodeTokenType;
  text: string;
}

// =============================================================================
// Language keyword sets (mirrors renderer's syntaxHighlighter.ts)
// =============================================================================

const KEYWORDS: Record<string, Set<string>> = {
  typescript: new Set([
    'import', 'export', 'from', 'const', 'let', 'var', 'function', 'class',
    'interface', 'type', 'enum', 'return', 'if', 'else', 'for', 'while', 'do',
    'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw',
    'new', 'this', 'super', 'extends', 'implements', 'async', 'await',
    'public', 'private', 'protected', 'static', 'readonly', 'abstract',
    'as', 'typeof', 'instanceof', 'in', 'of', 'keyof', 'void', 'never',
    'unknown', 'any', 'null', 'undefined', 'true', 'false', 'default',
  ]),
  javascript: new Set([
    'import', 'export', 'from', 'const', 'let', 'var', 'function', 'class',
    'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
    'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super',
    'extends', 'async', 'await', 'typeof', 'instanceof', 'in', 'of', 'void',
    'null', 'undefined', 'true', 'false', 'default',
  ]),
  python: new Set([
    'import', 'from', 'as', 'def', 'class', 'return', 'if', 'elif', 'else',
    'for', 'while', 'break', 'continue', 'try', 'except', 'finally', 'raise',
    'with', 'pass', 'lambda', 'yield', 'global', 'nonlocal', 'assert',
    'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None', 'async', 'await',
    'self', 'cls',
  ]),
  rust: new Set([
    'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait',
    'pub', 'mod', 'use', 'crate', 'self', 'super', 'where', 'for', 'loop',
    'while', 'if', 'else', 'match', 'return', 'break', 'continue', 'move',
    'ref', 'as', 'in', 'unsafe', 'async', 'await', 'dyn', 'true', 'false',
    'type', 'extern',
  ]),
  go: new Set([
    'package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface',
    'map', 'chan', 'go', 'defer', 'return', 'if', 'else', 'for', 'range',
    'switch', 'case', 'default', 'break', 'continue', 'fallthrough', 'select',
    'nil', 'true', 'false',
  ]),
  r: new Set([
    'if', 'else', 'for', 'while', 'repeat', 'function', 'return', 'next',
    'break', 'in', 'library', 'require', 'source', 'TRUE', 'FALSE', 'NULL',
    'NA', 'Inf', 'NaN',
  ]),
  ruby: new Set([
    'def', 'class', 'module', 'end', 'do', 'if', 'elsif', 'else', 'unless',
    'while', 'until', 'for', 'in', 'begin', 'rescue', 'ensure', 'raise',
    'return', 'yield', 'require', 'require_relative', 'include', 'extend',
    'self', 'super', 'nil', 'true', 'false', 'and', 'or', 'not', 'then',
    'when', 'case', 'lambda', 'proc', 'puts', 'print',
  ]),
  php: new Set([
    'function', 'class', 'interface', 'trait', 'extends', 'implements',
    'namespace', 'use', 'public', 'private', 'protected', 'static', 'abstract',
    'final', 'const', 'var', 'new', 'return', 'if', 'elseif', 'else', 'for',
    'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default',
    'try', 'catch', 'finally', 'throw', 'as', 'echo', 'print', 'require',
    'require_once', 'include', 'include_once', 'true', 'false', 'null',
    'array', 'isset', 'unset', 'empty', 'self', 'this',
  ]),
  sql: new Set([
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'JOIN',
    'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS', 'ON', 'AND', 'OR',
    'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'AS', 'ORDER',
    'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE',
    'END', 'BEGIN', 'COMMIT', 'ROLLBACK', 'VALUES', 'TRUE', 'FALSE',
  ]),
  bash: new Set([
    'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done',
    'case', 'esac', 'function', 'return', 'exit', 'echo', 'printf',
    'local', 'export', 'readonly', 'declare', 'typeset', 'set', 'unset',
    'source', 'shift', 'eval', 'exec', 'trap', 'cd', 'pwd', 'test',
    'true', 'false', 'in',
  ]),
};

// Aliases
KEYWORDS.tsx = KEYWORDS.typescript;
KEYWORDS.jsx = KEYWORDS.javascript;
KEYWORDS.ts = KEYWORDS.typescript;
KEYWORDS.js = KEYWORDS.javascript;
KEYWORDS.sh = KEYWORDS.bash;
KEYWORDS.shell = KEYWORDS.bash;
KEYWORDS.zsh = KEYWORDS.bash;

// =============================================================================
// Tokenizer (pure logic, no React dependency)
// =============================================================================

/**
 * Tokenize a single line of code into typed tokens.
 */
export function tokenizeLine(line: string, language: string): CodeToken[] {
  const keywords = KEYWORDS[language] ?? new Set<string>();
  const isSql = language === 'sql';
  const usesHash = ['python', 'bash', 'sh', 'shell', 'zsh', 'r', 'ruby', 'php'].includes(language);
  const usesDash = language === 'sql';

  const tokens: CodeToken[] = [];
  let pos = 0;
  const len = line.length;

  while (pos < len) {
    const remaining = line.slice(pos);

    // ── String (double quote) ──
    if (remaining[0] === '"') {
      let end = 1;
      while (end < remaining.length) {
        if (remaining[end] === '\\') { end += 2; continue; }
        if (remaining[end] === '"') { end++; break; }
        end++;
      }
      tokens.push({ type: 'string', text: remaining.slice(0, end) });
      pos += end;
      continue;
    }

    // ── String (single quote) ──
    if (remaining[0] === "'") {
      let end = 1;
      while (end < remaining.length) {
        if (remaining[end] === '\\') { end += 2; continue; }
        if (remaining[end] === "'") { end++; break; }
        end++;
      }
      tokens.push({ type: 'string', text: remaining.slice(0, end) });
      pos += end;
      continue;
    }

    // ── String (backtick template literal) ──
    if (remaining[0] === '`') {
      let end = 1;
      while (end < remaining.length) {
        if (remaining[end] === '\\') { end += 2; continue; }
        if (remaining[end] === '`') { end++; break; }
        end++;
      }
      tokens.push({ type: 'string', text: remaining.slice(0, end) });
      pos += end;
      continue;
    }

    // ── Comment (// style) ──
    if (remaining.startsWith('//')) {
      tokens.push({ type: 'comment', text: remaining });
      break;
    }

    // ── Comment (# style) ──
    if (usesHash && remaining[0] === '#') {
      tokens.push({ type: 'comment', text: remaining });
      break;
    }

    // ── Comment (-- style for SQL) ──
    if (usesDash && remaining.startsWith('--')) {
      tokens.push({ type: 'comment', text: remaining });
      break;
    }

    // ── Number ──
    const numMatch = /^(\d+\.?\d*)/.exec(remaining);
    if (numMatch && (pos === 0 || /\W/.test(line[pos - 1]))) {
      tokens.push({ type: 'number', text: numMatch[1] });
      pos += numMatch[1].length;
      continue;
    }

    // ── Word (keyword / type / identifier) ──
    const wordMatch = /^([a-zA-Z_$][a-zA-Z0-9_$?]*)/.exec(remaining);
    if (wordMatch) {
      const word = wordMatch[1];
      const isKeyword = isSql
        ? keywords.has(word.toUpperCase())
        : keywords.has(word);
      if (isKeyword) {
        tokens.push({ type: 'keyword', text: word });
      } else if (word[0] === word[0].toUpperCase() && word.length > 1 && /[a-z]/.test(word)) {
        tokens.push({ type: 'type', text: word });
      } else {
        tokens.push({ type: 'text', text: word });
      }
      pos += word.length;
      continue;
    }

    // ── Operator / punctuation ──
    const opMatch = /^([=<>!+\-*/%&|^~?:;,.{}()[\]@#])/.exec(remaining);
    if (opMatch) {
      tokens.push({ type: 'operator', text: opMatch[1] });
      pos += 1;
      continue;
    }

    // ── Default: plain character ──
    tokens.push({ type: 'text', text: remaining[0] });
    pos += 1;
  }

  return tokens;
}

// =============================================================================
// Ink renderer
// =============================================================================

const TOKEN_COLORS: Record<CodeTokenType, { color?: string; bold?: boolean; dimColor?: boolean }> = {
  keyword: { color: 'blue', bold: true },
  string: { color: 'yellow' },
  comment: { dimColor: true },
  number: { color: 'cyan' },
  type: { color: 'green' },
  operator: {},
  text: {},
};

/**
 * Highlight a single line of code and return an Ink JSX element.
 */
export function highlightCodeLine(line: string, language: string): JSX.Element {
  const tokens = tokenizeLine(line, language);

  return (
    <Text>
      {tokens.map((token, i) => {
        const style = TOKEN_COLORS[token.type];
        if (!style.color && !style.bold && !style.dimColor) {
          return <React.Fragment key={i}>{token.text}</React.Fragment>;
        }
        return (
          <Text key={i} color={style.color} bold={style.bold} dimColor={style.dimColor}>
            {token.text}
          </Text>
        );
      })}
    </Text>
  );
}
