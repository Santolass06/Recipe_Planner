// Accent/case-insensitive substring match for the ingredient combobox.
// Matches against the option's name only, never a unit suffix — typing
// "kg" shouldn't surface every ingredient that happens to share a unit.
//
// Combining diacritical marks (Unicode block 0x0300-0x036F) are dropped
// after NFD decomposition (e.g. "salmão" -> "salmo" + combining marks ->
// "salmao"). Filtered by numeric code-point range rather than a regex
// character class, since embedding those combining characters literally in
// source text is exactly the kind of thing that turns invisible on
// copy/paste or re-encoding.
export function normalizeForSearch(s: string): string {
  return Array.from(s.normalize("NFD"))
    .filter(ch => {
      const code = ch.codePointAt(0)!;
      return code < 0x0300 || code > 0x036f;
    })
    .join("")
    .toLowerCase();
}

export function matchesQuery(name: string, query: string): boolean {
  if (query.trim() === "") return true;
  return normalizeForSearch(name).includes(normalizeForSearch(query));
}
