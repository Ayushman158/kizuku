/**
 * How the journal turns stored entries into pages, with no React in it so it
 * can be reasoned about — and tested — without rendering anything.
 */

import type { Entry } from "./storage";

export type JournalPage = { date: string; entries: Entry[] };

/**
 * Entries (oldest first, as stored) into pages (newest first, as read), one
 * page per day.
 *
 * A page is a day, not an entry. Nothing stops someone facing a second hard
 * thing before bed — growth follows actions, never days — and when they did,
 * the journal used to print two pages under the same date. Entries within a day
 * keep the order they happened in.
 *
 * Undated entries (migrated from v1, which stored no dates) group together
 * rather than each claiming a page of their own.
 */
export function journalPages(entries: readonly Entry[]): JournalPage[] {
  const days: JournalPage[] = [];
  entries.forEach((entry) => {
    const open = days[days.length - 1];
    if (open && open.date === entry.date) open.entries.push(entry);
    else days.push({ date: entry.date, entries: [entry] });
  });
  return days.reverse();
}
