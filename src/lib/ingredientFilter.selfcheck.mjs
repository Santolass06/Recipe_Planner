// Runnable check for normalizeForSearch()/matchesQuery() in
// ingredientFilter.ts. Plain JS, not TS — this repo has no TS loader/test
// runner, so it mirrors the logic inline instead of importing it. Keep in
// sync with ingredientFilter.ts by hand.
// Run: node src/lib/ingredientFilter.selfcheck.mjs
import assert from "node:assert/strict";

function normalizeForSearch(s) {
  return Array.from(s.normalize("NFD"))
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("")
    .toLowerCase();
}

function matchesQuery(name, query) {
  if (query.trim() === "") return true;
  return normalizeForSearch(name).includes(normalizeForSearch(query));
}

// The request this component exists for: "salm" among Sal/Soja/Salmão.
assert.equal(matchesQuery("Salmão", "salm"), true, "Salmão should match 'salm'");
assert.equal(matchesQuery("Sal", "salm"), false, "Sal should not match 'salm'");
assert.equal(matchesQuery("Soja", "salm"), false, "Soja should not match 'salm'");

// Accent-insensitive.
assert.equal(matchesQuery("Alho Francês", "frances"), true, "accent-insensitive match");
assert.equal(matchesQuery("Salmão", "salmao"), true, "typing without the accent still matches");

// Case-insensitive.
assert.equal(matchesQuery("Farinha T55", "FARINHA"), true, "case-insensitive match");

// Substring, not just prefix.
assert.equal(matchesQuery("Queijo ralado", "rala"), true, "mid-word substring match");

// Empty query matches everything.
assert.equal(matchesQuery("Qualquer coisa", ""), true, "empty query matches everything");
assert.equal(matchesQuery("Qualquer coisa", "   "), true, "whitespace-only query matches everything");

// No match.
assert.equal(matchesQuery("Farinha T55", "xyz"), false, "no match for unrelated text");

console.log("ingredientFilter.selfcheck: ok (10 assertions)");
