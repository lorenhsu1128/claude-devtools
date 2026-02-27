/**
 * Terminal text wrapping and truncation utilities.
 */

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate multiline text to a maximum number of lines.
 * Returns the truncated text and a count of remaining lines.
 */
export function truncateLines(
  text: string,
  maxLines: number,
): { text: string; remaining: number } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { text, remaining: 0 };
  }
  return {
    text: lines.slice(0, maxLines).join('\n'),
    remaining: lines.length - maxLines,
  };
}

/**
 * Estimate the number of terminal rows a text string will occupy,
 * given the terminal column width.
 */
export function estimateRows(text: string, columns: number): number {
  if (!text || columns <= 0) return 1;
  const lines = text.split('\n');
  let rows = 0;
  for (const line of lines) {
    rows += Math.max(1, Math.ceil(line.length / columns));
  }
  return rows;
}
