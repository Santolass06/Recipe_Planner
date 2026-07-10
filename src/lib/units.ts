/** Full label ("symbol — nome") for each `Unit` enum value, for dropdowns. */
export const UNIT_LABELS_FULL: Record<string, string> = {
  gram: "g — Grama", kilogram: "kg — Quilograma", milligram: "mg — Miligrama",
  ounce: "oz — Onça", pound: "lb — Libra",
  milliliter: "ml — Mililitro", liter: "l — Litro", fluid_ounce: "fl oz — Fluid Ounce",
  cup: "cup — Chávena", pint: "pt — Pint", quart: "qt — Quart", gallon: "gal — Galão",
  teaspoon: "tsp — Colher de chá", tablespoon: "tbsp — Colher de sopa",
  piece: "pcs — Peça", dozen: "dz — Dúzia",
  pinch: "pitada — Pitada", bunch: "molho — Molho", clove: "dente — Dente", slice: "fatia — Fatia",
};

/** Short symbol only (the part before " — "), for table cells and badges. */
export const UNIT_LABELS_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(UNIT_LABELS_FULL).map(([k, v]) => [k, v.split(" — ")[0]])
);

/**
 * Mirrors `Unit::to_base_factor`/`group()` in crates/core/src/domain.rs.
 * Base unit is gram for weight, milliliter for volume, piece for count.
 * `null` factor = descriptive unit with no fixed physical size (pinch,
 * bunch, clove, slice) — can't be converted without knowing the ingredient.
 */
const UNIT_GROUP: Record<string, "weight" | "volume" | "count"> = {
  gram: "weight", kilogram: "weight", milligram: "weight", ounce: "weight", pound: "weight",
  pinch: "weight", bunch: "weight", clove: "weight", slice: "weight",
  milliliter: "volume", liter: "volume", fluid_ounce: "volume", cup: "volume",
  pint: "volume", quart: "volume", gallon: "volume", teaspoon: "volume", tablespoon: "volume",
  piece: "count", dozen: "count",
};

const UNIT_BASE_FACTOR: Record<string, number | null> = {
  gram: 1, kilogram: 1000, milligram: 0.001, ounce: 28.3495, pound: 453.592,
  pinch: null, bunch: null, clove: null, slice: null,
  milliliter: 1, liter: 1000, fluid_ounce: 29.5735, cup: 236.588,
  pint: 473.176, quart: 946.353, gallon: 3785.41, teaspoon: 4.92892, tablespoon: 14.7868,
  piece: 1, dozen: 12,
};

/** Converts `quantity` from `from` to `to`. `null` if the units aren't in the same group (or lack a fixed factor) — caller should treat quantity as approximate in that case. */
export function convertUnit(quantity: number, from: string, to: string): number | null {
  if (from === to) return quantity;
  if (UNIT_GROUP[from] !== UNIT_GROUP[to]) return null;
  const fromFactor = UNIT_BASE_FACTOR[from];
  const toFactor = UNIT_BASE_FACTOR[to];
  if (fromFactor == null || toFactor == null) return null;
  return (quantity * fromFactor) / toFactor;
}
