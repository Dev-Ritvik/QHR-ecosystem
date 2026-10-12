// apps/public/src/lib/hallOrder.ts
//
// WHICH LAYOUT IS ON WHICH TABLE, said once.
//
// The hall's tables take the published layouts IN ORDER: the first on the
// first table, and so on (InteriorStage; the film's chapters are laid out on
// the same list). A layout's own page stands at "its" table by a second
// account: the station the domain gives its slug (places.ts, layoutPlace).
//
// The two agreed only because the register happened to return its rows in the
// stations' order. The query has no ORDER BY, and a table read without one
// comes back in whatever order its rows lie on disk — which changes when a
// row is rewritten: the first time a layout is republished after a plot is
// sold, its row goes to the end. From that day the film would have opened its
// hall on a different layout, and each layout's page would have stood at
// another layout's model.
//
// So the order is the stations' own, for everything that reads the register:
// a layout the domain knows, by its station (S1, S2, S3); one it does not
// know yet, after those, in the register's order.

import { PROJECTS } from '@estate/domain/leads/branches';

const STATION: ReadonlyMap<string, number> = new Map(
  PROJECTS.map((p) => [p.slug, Number(p.station.slice(1))] as const),
);

export function inHallOrder<T extends { slug: string }>(rows: readonly T[]): T[] {
  return rows
    .map((row, i) => ({ row, i, at: STATION.get(row.slug) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => (a.at === b.at ? a.i - b.i : a.at - b.at))
    .map((x) => x.row);
}
