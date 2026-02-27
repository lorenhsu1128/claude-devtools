/**
 * Date-based session grouping for the TUI sidebar.
 *
 * Groups sessions by relative date: Today, Yesterday, Previous 7 Days, Older.
 * Works with any object that has a `createdAt` unix timestamp (ms).
 */

import { DATE_CATEGORY_ORDER } from '../types';

import type { DateCategory, DateGroupedSessions } from '../types';

const MS_PER_DAY = 86_400_000;

/** Categorize a timestamp relative to now. */
function categorize(timestampMs: number, todayStart: number): DateCategory {
  if (timestampMs >= todayStart) return 'Today';
  if (timestampMs >= todayStart - MS_PER_DAY) return 'Yesterday';
  if (timestampMs >= todayStart - 7 * MS_PER_DAY) return 'Previous 7 Days';
  return 'Older';
}

/**
 * Group items by date category based on their `createdAt` field (unix ms).
 * Items maintain their original sort order within each category.
 */
export function groupByDate<T extends { createdAt: number }>(
  items: T[],
): DateGroupedSessions<T> {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const groups: DateGroupedSessions<T> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Older: [],
  };

  for (const item of items) {
    const cat = categorize(item.createdAt, todayStart);
    groups[cat].push(item);
  }

  return groups;
}

/**
 * Get non-empty date categories in display order.
 */
export function getNonEmptyCategories<T>(
  grouped: DateGroupedSessions<T>,
): DateCategory[] {
  return DATE_CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0);
}
