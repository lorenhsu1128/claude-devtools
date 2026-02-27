/**
 * TUI-specific types.
 */

/** Date category for session grouping in sidebar. */
export type DateCategory = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

/** Order in which date categories are displayed. */
export const DATE_CATEGORY_ORDER: DateCategory[] = [
  'Today',
  'Yesterday',
  'Previous 7 Days',
  'Older',
];

/** Sessions grouped by date category. */
export type DateGroupedSessions<T> = Record<DateCategory, T[]>;
