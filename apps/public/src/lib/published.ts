// apps/public/src/lib/published.ts
//
// WHAT THE REGISTER SAYS TODAY, for a page to print.
//
// The film counts its plots from the projection (the read model the CRM
// publishes): so many drawn, so many open, at each table and in total. For a
// long time the pages beside it said the opposite in words — "there is no
// availability counter on this site" — because when they were written there
// was none. A visitor who had just watched the film print 344 of 407 then read
// that the site prints no such thing. The pages read the same register now,
// through this, so the film and the page beside it cannot disagree.
//
// WHAT IS READ, AND WHAT IS NOT. A layout's two totals: plots in it, and plots
// open. Not which plots, and not how many of each size: the register's plot
// numbers are provisional until the client's plot register arrives, and its
// split by size is a placeholder. Those stay the branch's to say.
//
// DEGRADES AS THE FILM'S OWN READ DOES: a failed query is a page without its
// counts, never a failed page. Every caller prints its sentence without the
// figure when this returns nothing.

import { getPublishedProjects } from '@/lib/projection';

export interface PublishedLayout {
  projectId: string;
  slug: string;
  name: string;
  /** Plots open today, or null where the register gives no figure. */
  available: number | null;
  /** Plots in the layout, or null where the register gives no figure. */
  total: number | null;
  soldOut: boolean;
}

export async function publishedLayouts(): Promise<PublishedLayout[]> {
  try {
    const rows: any[] = await getPublishedProjects();
    return (Array.isArray(rows) ? rows : []).map((p) => ({
      projectId: String(p.projectId),
      slug: String(p.slug),
      name: String(p.name),
      available: typeof p.availableUnits === 'number' ? p.availableUnits : null,
      total: typeof p.totalUnits === 'number' ? p.totalUnits : null,
      soldOut: Boolean(p.isSoldOut),
    }));
  } catch (err) {
    console.error('[published] projection read failed; pages are shown without their counts', err);
    return [];
  }
}

export const num = (n: number): string => n.toLocaleString('en-IN');

/** "113 plots, all open" · "181 plots, 118 open" · null with no figures. */
export function countLine(p: Pick<PublishedLayout, 'available' | 'total' | 'soldOut'> | undefined): string | null {
  if (!p || p.total === null) return null;
  if (p.soldOut || p.available === 0) return `${num(p.total)} plots, none open`;
  if (p.available === null) return `${num(p.total)} plots`;
  if (p.available >= p.total) return `${num(p.total)} plots, all open`;
  return `${num(p.total)} plots, ${num(p.available)} open`;
}

/** The whole offer in two numbers, or null where any layout has none. */
export function totals(list: readonly PublishedLayout[]): { total: number; available: number; layouts: number } | null {
  if (list.length === 0) return null;
  let total = 0;
  let available = 0;
  for (const p of list) {
    if (p.total === null || p.available === null) return null;
    total += p.total;
    available += p.available;
  }
  return { total, available, layouts: list.length };
}
