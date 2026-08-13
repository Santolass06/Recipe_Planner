import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { errKey } from "../lib/errors";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useI18n } from "../i18n";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { UNIT_LABELS_SHORT as UNIT_SHORT } from "../lib/units";
import type { RecipeSuggestion } from "../../crates/core/bindings/RecipeSuggestion";
import type { ExpiringItem } from "../../crates/core/bindings/ExpiringItem";
import type { ProductionResult } from "../../crates/core/bindings/ProductionResult";

/**
 * What to cook now (Sprint S4). Two questions a cook actually asks — what can I
 * make with what is here, and what is about to go off — answered on one page
 * with the action attached rather than a number to go act on somewhere else.
 */
export default function SuggestionsPage() {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [expiring, setExpiring] = useState<ExpiringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingWriteOff, setPendingWriteOff] = useState<ExpiringItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        invoke<RecipeSuggestion[]>("suggest_recipes", { limit: 12 }),
        invoke<ExpiringItem[]>("expiring_items", { withinDays: 7 }),
      ]);
      setSuggestions(s ?? []);
      setExpiring(e ?? []);
    } catch (err) {
      showToast(t(errKey(err, "suggestions.loadError")), "err");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  async function cook(s: RecipeSuggestion) {
    setBusyId(s.recipe_id);
    try {
      const result = await invoke<ProductionResult>("recipe_produce", {
        input: { recipe_id: s.recipe_id, multiplier: 1, yields_product: false, reason: null },
      });
      showToast(
        result.shortfalls.length > 0
          ? t("recipes.cook.doneWithShortfalls", { count: result.shortfalls.length })
          : t("recipes.cook.done", { name: s.recipe_name }),
        result.shortfalls.length > 0 ? "warn" : "ok",
      );
      load();
    } catch (err) {
      showToast(typeof err === "string" && err ? err : t(errKey(err, "recipes.cook.error")), "err");
    } finally {
      setBusyId(null);
    }
  }

  async function writeOff(item: ExpiringItem) {
    setBusyId(item.ingredient_id);
    try {
      await invoke("stock_loss_record", {
        input: {
          ingredient_id: item.ingredient_id,
          recipe_id: null,
          quantity: item.quantity,
          unit: item.unit,
          reason: t("suggestions.expiredReason"),
        },
      });
      showToast(t("stock.loss.done", { name: item.ingredient_name }), "ok");
      load();
    } catch (err) {
      showToast(typeof err === "string" && err ? err : t(errKey(err, "stock.loss.error")), "err");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="content">
      <PageHeader title={t("suggestions.title")} subtitle={t("suggestions.subtitle")} />

      {expiring.length > 0 && (
        <section style={{ marginBottom: "var(--space-5)" }}>
          <h2 className="section-title">{t("suggestions.expiringTitle")}</h2>
          <p className="text-4" style={{ marginBottom: "var(--space-3)" }}>{t("suggestions.expiringDesc")}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {expiring.map(item => (
              <div
                key={item.ingredient_id}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
                }}
              >
                <span className="ms" style={{ fontSize: 18, color: item.days_left < 0 ? "var(--red)" : "var(--amber, var(--ember))" }}>
                  schedule
                </span>
                <div style={{ flex: 1 }}>
                  <strong>{item.ingredient_name}</strong>
                  <div className="text-4 mono">
                    {item.quantity} · {item.days_left < 0
                      ? t("suggestions.expiredAgo", { days: Math.abs(item.days_left) })
                      : t("suggestions.expiresIn", { days: item.days_left })}
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPendingWriteOff(item)}
                  disabled={busyId === item.ingredient_id}
                >
                  {t("suggestions.writeOff")}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">{t("suggestions.canCookTitle")}</h2>
        {loading ? (
          <div className="empty" style={{ minHeight: 160 }}>{t("reports.loadingEllipsis")}</div>
        ) : suggestions.length === 0 ? (
          <EmptyState
            icon={<span className="ms" style={{ fontSize: 40 }}>skillet</span>}
            title={t("suggestions.empty")}
            body={t("suggestions.emptyDesc")}
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {suggestions.map(s => {
              const pct = Math.round(s.coverage * 100);
              return (
                <div
                  key={s.recipe_id}
                  style={{
                    padding: "14px 16px", background: "var(--surface)",
                    border: "1px solid var(--line)", borderRadius: 11,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong>{s.recipe_name}</strong>
                        {s.uses_expiring && (
                          <span className="mono" style={{ fontSize: 10, color: "var(--ember)", background: "var(--ember-soft)", padding: "2px 7px", borderRadius: 6 }}>
                            {t("suggestions.usesExpiring")}
                          </span>
                        )}
                      </div>
                      <div className="text-4 mono">
                        {s.category} · {t("suggestions.coverage", { pct })} · €{s.cost_per_portion.toFixed(2)}/{t("recipes.perPortionAbbrev")}
                      </div>
                    </div>
                    <button
                      className={pct === 100 ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                      onClick={() => cook(s)}
                      disabled={busyId === s.recipe_id}
                    >
                      {t("recipes.cook.action")}
                    </button>
                  </div>

                  <div style={{ height: 4, background: "var(--inset)", borderRadius: 3, marginTop: 10 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--green, var(--ember))" : "var(--ember)", borderRadius: 3 }} />
                  </div>

                  {s.missing.length > 0 && (
                    <div className="text-4 mono" style={{ marginTop: 8 }}>
                      {t("suggestions.missing")}: {s.missing.map(m => m.ingredient_name).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingWriteOff !== null}
        title={t("stock.loss.confirmTitle", { name: pendingWriteOff?.ingredient_name ?? "" })}
        body={t("stock.loss.confirmBody", { name: pendingWriteOff?.ingredient_name ?? "", qty: pendingWriteOff?.quantity ?? 0, unit: UNIT_SHORT[pendingWriteOff?.unit ?? ""] ?? pendingWriteOff?.unit ?? "" })}
        onConfirm={() => {
          if (pendingWriteOff) writeOff(pendingWriteOff);
          setPendingWriteOff(null);
        }}
        onCancel={() => setPendingWriteOff(null)}
        danger
      />
    </div>
  );
}
