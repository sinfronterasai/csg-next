import { getSpread, type Spread } from "@/lib/tarot/spreads";

export interface PositionLayout {
  index: number;
  col: number;
  row: number;
  label: string;
}

export interface SpreadLayout {
  columns: number;
  rows: number;
  positions: PositionLayout[];
}

// Explicit grids per MVP spread. Col/row are 1-based for CSS grid placement.
const GRIDS: Record<string, { columns: number; rows: number; coords: [number, number][] }> = {
  one_card: { columns: 1, rows: 1, coords: [[1, 1]] },
  past_present_future: { columns: 3, rows: 1, coords: [[1, 1], [2, 1], [3, 1]] },
  // Celtic Cross: center cross (1-6) + right column (7-10)
  celtic_cross: {
    columns: 4,
    rows: 4,
    coords: [
      [2, 2], // 1 present (center)
      [2, 1], // 2 challenge (above)
      [3, 2], // 3 crown (right of center)
      [2, 3], // 4 past (below)
      [1, 2], // 5 passing (left)
      [2, 2], // 6 future (overlays center) - placed at center for layout simplicity
      [4, 1], // 7 self
      [4, 2], // 8 environment
      [4, 3], // 9 hopes/fears
      [4, 4], // 10 outcome
    ],
  },
  relationship_dynamics: {
    columns: 3,
    rows: 2,
    coords: [[1, 1], [3, 1], [2, 1], [1, 2], [3, 2], [2, 2]],
  },
  career_crossroads: {
    columns: 3,
    rows: 2,
    coords: [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2]],
  },
};

export function layoutForSpread(spreadId: string): SpreadLayout {
  const spread: Spread | undefined = getSpread(spreadId);
  if (!spread) throw new Error(`Unknown spread: ${spreadId}`);
  const grid = GRIDS[spreadId];
  if (!grid) throw new Error(`No layout defined for spread: ${spreadId}`);
  const positions: PositionLayout[] = spread.positions.map((p, i) => ({
    index: i,
    col: grid.coords[i][0],
    row: grid.coords[i][1],
    label: p.label,
  }));
  return { columns: grid.columns, rows: grid.rows, positions };
}
