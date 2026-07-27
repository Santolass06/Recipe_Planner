/**
 * Pick the message key for a failed backend call.
 *
 * Two things were wrong with `catch (e) { showToast(t("x.error"), "err") }`:
 * the real cause (`e`) was captured and never used, so "database is locked" or
 * a constraint violation vanished without reaching the console; and a delete
 * refused by a foreign key — the database correctly protecting rows that are
 * still referenced — read as a generic failure, telling the user nothing about
 * what to do next.
 */
export function errKey(e: unknown, fallback: string): string {
  console.error(e);
  return String(e).includes("IN_USE") ? "errors.inUse" : fallback;
}
