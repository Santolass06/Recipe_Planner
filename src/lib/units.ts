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
