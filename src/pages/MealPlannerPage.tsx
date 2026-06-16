import { useState, useEffect, useCallback } from "react";
import { Fragment } from "react";
import { invoke } from "@tauri-apps/api/core";

// Types matching the backend
interface Recipe {
  id: number;
  name: string;
  category: string;
  portions: number;
}

interface MealPlan {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

interface MealPlanEntry {
  id: number;
  meal_plan_id: number;
  recipe_id: number;
  recipe_name: string;
  day_of_week: string;
  meal_type: string;
  portions: number;
  created_at: string;
  updated_at: string;
}

interface MealPlanWithEntries {
  meal_plan: MealPlan;
  entries: MealPlanEntry[];
}

interface MealPlanInput {
  name: string;
  start_date: string;
  end_date: string;
}

interface MealEntryInput {
  recipe_id: number;
  day_of_week: string;
  meal_type: string;
  portions: number;
}

interface ShoppingItem {
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string;
  needed_quantity: number;
  stock_quantity: number;
  to_buy_quantity: number;
  category: string;
  estimated_cost: number;
  purchased: boolean;
}

interface ShoppingList {
  id: number;
  name: string;
  items: ShoppingItem[];
  total_estimated_cost: number;
  created_at: string;
}

interface MealPlanShoppingList {
  shopping_list: ShoppingList;
  total_portions: number;
  recipes_used: number[];
}

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const DAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Segunda", tuesday: "Terça", wednesday: "Quarta",
  thursday: "Quinta", friday: "Sexta", saturday: "Sábado", sunday: "Domingo"
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Pequeno-almoço", lunch: "Almoço", dinner: "Jantar", snack: "Lanche"
};

export default function MealPlannerPage() {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MealPlanWithEntries | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | "view" | "entry" | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" | "info" } | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [planForm, setPlanForm] = useState<MealPlanInput>({
    name: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0],
  });

  const [entryForm, setEntryForm] = useState<MealEntryInput>({
    recipe_id: 0,
    day_of_week: "monday",
    meal_type: "lunch",
    portions: 1,
  });

  const showToast = useCallback((msg: string, type: "ok" | "err" | "warn" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadMealPlans = useCallback(async () => {
    try {
      const plans = await invoke<MealPlan[]>("meal_plans_list");
      setMealPlans(plans);
    } catch (e) {
      showToast("Erro ao carregar planos", "err");
    }
  }, [showToast]);

  const loadRecipes = useCallback(async () => {
    try {
      const recipesData = await invoke<Recipe[]>("recipes_list");
      setRecipes(recipesData);
    } catch (e) {
      showToast("Erro ao carregar receitas", "err");
    }
  }, [showToast]);

  const loadPlan = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const plan = await invoke<MealPlanWithEntries>("meal_plan_get", { id });
      setSelectedPlan(plan);
    } catch (e) {
      showToast("Erro ao carregar plano", "err");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMealPlans();
    loadRecipes();
  }, [loadMealPlans, loadRecipes]);

  // Meal plan CRUD
  async function handlePlanCreate() {
    if (!planForm.name.trim()) return;
    setLoading(true);
    try {
      await invoke("meal_plan_create", {
        name: planForm.name.trim(),
        start_date: planForm.start_date,
        end_date: planForm.end_date,
      });
      showToast("Plano criado", "ok");
      setModal(null);
      setPlanForm({ name: "", start_date: new Date().toISOString().split("T")[0], end_date: new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0] });
      await loadMealPlans();
    } catch (e) {
      showToast("Erro ao criar plano", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlanUpdate() {
    if (!selectedPlan || !planForm.name.trim()) return;
    setLoading(true);
    try {
      await invoke("meal_plan_update", {
        id: selectedPlan.meal_plan.id,
        name: planForm.name.trim(),
        start_date: planForm.start_date,
        end_date: planForm.end_date,
      });
      showToast("Plano actualizado", "ok");
      setModal(null);
      await loadPlan(selectedPlan.meal_plan.id);
      await loadMealPlans();
    } catch (e) {
      showToast("Erro ao actualizar plano", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlanDelete(id: number) {
    try {
      await invoke("meal_plan_delete", { id });
      setConfirmDelete(null);
      showToast("Plano eliminado", "ok");
      if (selectedPlan?.meal_plan.id === id) setSelectedPlan(null);
      await loadMealPlans();
    } catch (e) {
      showToast("Erro ao eliminar plano", "err");
    }
  }

  // Entry CRUD
  async function handleEntryAdd() {
    if (!selectedPlan || entryForm.recipe_id === 0) {
      showToast("Seleciona uma receita", "warn");
      return;
    }
    setLoading(true);
    try {
      await invoke("meal_entry_add", {
        meal_plan_id: selectedPlan.meal_plan.id,
        recipe_id: entryForm.recipe_id,
        day_of_week: entryForm.day_of_week,
        meal_type: entryForm.meal_type,
        portions: entryForm.portions,
      });
      showToast("Entrada adicionada", "ok");
      setEntryForm({ recipe_id: 0, day_of_week: "monday", meal_type: "lunch", portions: 1 });
      setModal(null);
      await loadPlan(selectedPlan.meal_plan.id);
    } catch (e) {
      showToast("Erro ao adicionar entrada", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleEntryUpdate() {
    if (!editingEntry) return;
    setLoading(true);
    try {
      await invoke("meal_entry_update", {
        id: editingEntry.id,
        recipe_id: entryForm.recipe_id,
        day_of_week: entryForm.day_of_week,
        meal_type: entryForm.meal_type,
        portions: entryForm.portions,
      });
      showToast("Entrada actualizada", "ok");
      setEntryForm({ recipe_id: 0, day_of_week: "monday", meal_type: "lunch", portions: 1 });
      setEditingEntry(null);
      setModal(null);
      if (selectedPlan) await loadPlan(selectedPlan.meal_plan.id);
    } catch (e) {
      showToast("Erro ao actualizar entrada", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleEntryDelete(id: number) {
    try {
      await invoke("meal_entry_delete", { id });
      showToast("Entrada eliminada", "ok");
      if (selectedPlan) await loadPlan(selectedPlan.meal_plan.id);
    } catch (e) {
      showToast("Erro ao eliminar entrada", "err");
    }
  }

  // Generate shopping list
  async function handleGenerateShoppingList() {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      const result = await invoke<MealPlanShoppingList>("meal_plan_generate_shopping_list", {
        plan_id: selectedPlan.meal_plan.id,
        portions_multiplier: 1,
      });
      showToast(`Lista de compras gerada: ${result.shopping_list.name}`, "ok");
      // TODO: Navigate to shopping list page or show modal with result
    } catch (e) {
      showToast("Erro ao gerar lista de compras", "err");
    } finally {
      setLoading(false);
    }
  }

  // Grid helpers
  const getEntry = useCallback((day: DayOfWeek, meal: MealType): MealPlanEntry | undefined => {
    if (!selectedPlan) return undefined;
    return selectedPlan.entries.find(e => e.day_of_week === day && e.meal_type === meal);
  }, [selectedPlan]);

  const openEntryModal = (day: DayOfWeek, meal: MealType, entry?: MealPlanEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setEntryForm({
        recipe_id: entry.recipe_id,
        day_of_week: entry.day_of_week as DayOfWeek,
        meal_type: entry.meal_type as MealType,
        portions: entry.portions,
      });
      setModal("entry");
    } else if (selectedPlan) {
      setEditingEntry(null);
      setEntryForm({
        recipe_id: 0,
        day_of_week: day,
        meal_type: meal,
        portions: 1,
      });
      setModal("entry");
    }
  };

  const openPlanModal = (type: "create" | "edit", plan?: MealPlanWithEntries) => {
    if (type === "edit" && plan) {
      setPlanForm({
        name: plan.meal_plan.name,
        start_date: plan.meal_plan.start_date.split("T")[0],
        end_date: plan.meal_plan.end_date.split("T")[0],
      });
    } else {
      setPlanForm({ name: "", start_date: new Date().toISOString().split("T")[0], end_date: new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0] });
    }
    setModal(type);
  };

  const closeModal = () => {
    setModal(null);
    setEditingEntry(null);
  };

  // Render
  return (
    <div className="content">
      {/* Header */}
      <div className="content-header">
        <div>
          <h1 className="content-title">Planeamento Semanal</h1>
          <p className="content-sub mono">Organiza as tuas refeições da semana</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn-secondary" onClick={() => openPlanModal("create")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Plano
          </button>
        </div>
      </div>

      {/* Plan Selector / List */}
      {!selectedPlan && (
        <div className="card" style={{ padding: "var(--space-5)", maxWidth: 800, margin: "0 auto" }}>
          <h2 className="text-2" style={{ marginBottom: "var(--space-4)" }}>Os Teus Planos</h2>
          {mealPlans.length === 0 ? (
            <div className="empty" style={{ minHeight: 200 }}>
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <p className="empty-title">Nenhum plano ainda</p>
              <p className="empty-desc">Cria o teu primeiro plano de refeições semanal</p>
              <button className="btn btn-primary" onClick={() => openPlanModal("create")}>
                Criar Plano
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
              {mealPlans.map(plan => (
                <div key={plan.id} className="card" style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 className="text-2" style={{ fontSize: "16px" }}>{plan.name}</h3>
                      <p className="text-3 mono" style={{ fontSize: "12px" }}>
                        {new Date(plan.start_date).toLocaleDateString("pt-PT")} - {new Date(plan.end_date).toLocaleDateString("pt-PT")}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => loadPlan(plan.id)}>
                      Abrir
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => openPlanModal("edit", { meal_plan: plan, entries: [] })}>
                      Editar
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(plan.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weekly Grid View */}
      {selectedPlan && (
        <>
          {/* Plan Header */}
          <div className="card" style={{ marginBottom: "var(--space-4)", padding: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
              <div>
                <h2 className="content-title" style={{ fontSize: "20px" }}>{selectedPlan.meal_plan.name}</h2>
                <p className="content-sub mono">
                  {new Date(selectedPlan.meal_plan.start_date).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })} -
                  {new Date(selectedPlan.meal_plan.end_date).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button className="btn btn-primary" onClick={handleGenerateShoppingList} disabled={loading}>
                  {loading ? "A gerar…" : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2.5l2.5 11.5L8 21l8-1.5V5.5L4.55 3.5H3.55"/></svg>
                      Gerar Lista de Compras
                    </>
                  )}
                </button>
                <button className="btn btn-secondary" onClick={() => openPlanModal("edit", selectedPlan)}>
                  Editar Plano
                </button>
                <button className="btn btn-secondary" onClick={() => setSelectedPlan(null)}>
                  Voltar
                </button>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="card" style={{ overflow: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px repeat(7, minmax(120px, 1fr))" }}>
              {/* Time column header */}
              <div className="field-row" style={{ padding: "var(--space-2)", background: "var(--elevated)", borderRight: "1px solid var(--border)", fontWeight: 600, fontSize: "12px" }}>
                Refeição
              </div>
              {/* Day headers */}
              {DAYS.map(day => (
                <div key={day} className="field-row" style={{ padding: "var(--space-2)", background: "var(--elevated)", borderRight: "1px solid var(--border)", textAlign: "center", fontWeight: 600, fontSize: "13px" }}>
                  <div>{DAY_LABELS[day]}</div>
                  <div className="mono text-4" style={{ fontSize: "11px" }}>
                    {new Date(selectedPlan.meal_plan.start_date).getTime() + DAYS.indexOf(day) * 86400000 > 0 &&
                      new Date(new Date(selectedPlan.meal_plan.start_date).getTime() + DAYS.indexOf(day) * 86400000).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}
                  </div>
                </div>
              ))}
              {/* Meal rows */}
              {MEAL_TYPES.map(meal => (
                <Fragment key={meal}>
                  <div className="field-row" style={{ padding: "var(--space-2)", background: "var(--surface)", borderRight: "1px solid var(--border)", fontWeight: 500, fontSize: "12px", color: "var(--brand)" }}>
                    {MEAL_LABELS[meal]}
                  </div>
                  {DAYS.map(day => {
                    const entry = getEntry(day, meal);
                    return (
                      <div
                        key={`${day}-${meal}`}
                        style={{
                          minHeight: 100,
                          borderRight: "1px solid var(--border)",
                          borderBottom: "1px solid var(--border)",
                          background: entry ? "var(--brand-muted)" : "transparent",
                          padding: "var(--space-2)",
                          cursor: "pointer",
                          transition: "background var(--fast)",
                        }}
                        onClick={() => openEntryModal(day, meal, entry)}
                        onMouseEnter={e => { if (!entry) e.currentTarget.style.background = "var(--surface)"; }}
                        onMouseLeave={e => { if (!entry) e.currentTarget.style.background = "transparent"; }}
                      >
                        {entry ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <span className="text-2" style={{ fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {entry.recipe_name}
                              </span>
                              <span className="mono text-4" style={{ fontSize: "10px", color: "var(--brand)" }}>
                                {entry.portions}x
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-1)" }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "2px 6px", fontSize: "10px", height: "22px", flex: 1 }}
                                onClick={e => { e.stopPropagation(); openEntryModal(day, meal, entry); }}
                              >
                                Editar
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ padding: "2px 6px", fontSize: "10px", height: "22px" }}
                                onClick={e => { e.stopPropagation(); handleEntryDelete(entry.id); }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-4)", fontSize: "12px" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Legend / Stats */}
          <div className="card" style={{ marginTop: "var(--space-4)", padding: "var(--space-4)" }}>
            <h3 className="text-2" style={{ marginBottom: "var(--space-3)" }}>Resumo</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", fontSize: "13px" }}>
              <span className="mono"><strong>{selectedPlan.entries.length}</strong> refeições planeadas</span>
              <span className="mono"><strong>{[...new Set(selectedPlan.entries.map(e => e.recipe_id))].length}</strong> receitas diferentes</span>
              <span className="mono"><strong>{selectedPlan.entries.reduce((sum, e) => sum + e.portions, 0)}</strong> porções no total</span>
            </div>
          </div>
        </>
      )}

      {/* Modals */}

      {/* Plan Create/Edit Modal */}
      {(modal === "create" || modal === "edit") && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modal === "create" ? "Novo Plano" : "Editar Plano"}</h3>
              <button className="modal-close" onClick={closeModal}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label" htmlFor="plan-name">Nome do Plano</label>
                <input
                  id="plan-name"
                  type="text"
                  className="input"
                  value={planForm.name}
                  onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Semana de 15 a 21 Janeiro"
                  autoFocus
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label className="field-label" htmlFor="plan-start">Data Início</label>
                  <input
                    id="plan-start"
                    type="date"
                    className="input"
                    value={planForm.start_date}
                    onChange={e => setPlanForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="plan-end">Data Fim</label>
                  <input
                    id="plan-end"
                    type="date"
                    className="input"
                    value={planForm.end_date}
                    onChange={e => setPlanForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={modal === "create" ? handlePlanCreate : handlePlanUpdate} disabled={loading || !planForm.name.trim()}>
                {loading ? "A guardar…" : modal === "create" ? "Criar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Create/Edit Modal */}
      {(modal === "entry") && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingEntry ? "Editar Entrada" : "Adicionar Refeição"}</h3>
              <button className="modal-close" onClick={closeModal}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label" htmlFor="entry-recipe">Receita</label>
                <select
                  id="entry-recipe"
                  className="select"
                  value={entryForm.recipe_id}
                  onChange={e => setEntryForm(f => ({ ...f, recipe_id: parseInt(e.target.value) || 0 }))}
                >
                  <option value="0">Seleciona uma receita…</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.portions} porções)
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label className="field-label" htmlFor="entry-day">Dia da Semana</label>
                  <select
                    id="entry-day"
                    className="select"
                    value={entryForm.day_of_week}
                    onChange={e => setEntryForm(f => ({ ...f, day_of_week: e.target.value as DayOfWeek }))}
                  >
                    {DAYS.map(d => (
                      <option key={d} value={d}>{DAY_LABELS[d]}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="entry-meal">Tipo de Refeição</label>
                  <select
                    id="entry-meal"
                    className="select"
                    value={entryForm.meal_type}
                    onChange={e => setEntryForm(f => ({ ...f, meal_type: e.target.value as MealType }))}
                  >
                    {MEAL_TYPES.map(m => (
                      <option key={m} value={m}>{MEAL_LABELS[m]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="entry-portions">Porções</label>
                <input
                  id="entry-portions"
                  type="number"
                  className="input input-num"
                  min="1"
                  max="100"
                  value={entryForm.portions}
                  onChange={e => setEntryForm(f => ({ ...f, portions: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={editingEntry ? handleEntryUpdate : handleEntryAdd} disabled={loading || entryForm.recipe_id === 0}>
                {loading ? "A guardar…" : editingEntry ? "Guardar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Toast overlay */}
      {confirmDelete !== null && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)} style={{ zIndex: "var(--z-toast)" }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="1.5" style={{ marginBottom: "var(--space-3)" }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-2" style={{ marginBottom: "var(--space-2)" }}>Eliminar plano?</p>
              <p className="text-3" style={{ marginBottom: "var(--space-5)" }}>Esta acção não pode ser desfeita. As entradas associadas também serão eliminadas.</p>
              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={() => handlePlanDelete(confirmDelete)}>Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`} role="alert" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {toast.type === "ok" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>}
          {toast.type === "err" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          {toast.type === "warn" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          {toast.type === "info" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}