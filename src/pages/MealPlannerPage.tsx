import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { useI18n } from "../i18n";

type T = (key: string, params?: Record<string, string | number>) => string;

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

const getDayLabels = (t: T): Record<DayOfWeek, string> => ({
  monday: t("mealPlanner.daysFull.monday"), tuesday: t("mealPlanner.daysFull.tuesday"), wednesday: t("mealPlanner.daysFull.wednesday"),
  thursday: t("mealPlanner.daysFull.thursday"), friday: t("mealPlanner.daysFull.friday"), saturday: t("mealPlanner.daysFull.saturday"), sunday: t("mealPlanner.daysFull.sunday"),
});

const getMealLabels = (t: T): Record<MealType, string> => ({
  breakfast: t("calendar.meals.breakfast"), lunch: t("calendar.meals.lunch"), dinner: t("calendar.meals.dinner"), snack: t("calendar.meals.snack"),
});

const getDayLabelsShort = (t: T): Record<DayOfWeek, string> => ({
  monday: t("calendar.days.mon"), tuesday: t("calendar.days.tue"), wednesday: t("calendar.days.wed"),
  thursday: t("calendar.days.thu"), friday: t("calendar.days.fri"), saturday: t("calendar.days.sat"), sunday: t("calendar.days.sun"),
});

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "var(--amber)", lunch: "var(--green)", dinner: "var(--ember)", snack: "var(--approx)"
};

export default function MealPlannerPage() {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MealPlanWithEntries | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | "view" | "entry" | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const { showToast } = useToast();
  const { t } = useI18n();
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

  const loadMealPlans = useCallback(async () => {
    try {
      const plans = await invoke<MealPlan[]>("meal_plans_list");
      setMealPlans(plans);
    } catch (e) {
      showToast(t("mealPlanner.loadPlansError"), "err");
    }
  }, [showToast, t]);

  const loadRecipes = useCallback(async () => {
    try {
      const recipesData = await invoke<Recipe[]>("recipes_list");
      setRecipes(recipesData);
    } catch (e) {
      showToast(t("mealPlanner.loadRecipesError"), "err");
    }
  }, [showToast, t]);

  const loadPlan = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const plan = await invoke<MealPlanWithEntries>("meal_plan_get", { id });
      setSelectedPlan(plan);
    } catch (e) {
      showToast(t("mealPlanner.loadPlanError"), "err");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

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
        input: {
          name: planForm.name.trim(),
          start_date: planForm.start_date + "T00:00:00Z",
          end_date: planForm.end_date + "T00:00:00Z",
        },
      });
      showToast(t("mealPlanner.planCreated"), "ok");
      setModal(null);
      setPlanForm({ name: "", start_date: new Date().toISOString().split("T")[0], end_date: new Date(Date.now() + 6 * 86400000).toISOString().split("T")[0] });
      await loadMealPlans();
    } catch (e) {
      showToast(t("mealPlanner.planCreateError"), "err");
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
        input: {
          name: planForm.name.trim(),
          start_date: planForm.start_date + "T00:00:00Z",
          end_date: planForm.end_date + "T00:00:00Z",
        },
      });
      showToast(t("mealPlanner.planUpdated"), "ok");
      setModal(null);
      await loadPlan(selectedPlan.meal_plan.id);
      await loadMealPlans();
    } catch (e) {
      showToast(t("mealPlanner.planUpdateError"), "err");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlanDelete(id: number) {
    try {
      await invoke("meal_plan_delete", { id });
      setConfirmDelete(null);
      showToast(t("mealPlanner.planDeleted"), "ok");
      if (selectedPlan?.meal_plan.id === id) setSelectedPlan(null);
      await loadMealPlans();
    } catch (e) {
      showToast(t("mealPlanner.planDeleteError"), "err");
    }
  }

  // Entry CRUD
  async function handleEntryAdd() {
    if (!selectedPlan || entryForm.recipe_id === 0) {
      showToast(t("mealPlanner.selectRecipeWarn"), "warn");
      return;
    }
    setLoading(true);
    try {
      await invoke("meal_entry_add", {
        mealPlanId: selectedPlan.meal_plan.id,
        input: {
          recipe_id: entryForm.recipe_id,
          day_of_week: entryForm.day_of_week,
          meal_type: entryForm.meal_type,
          portions: entryForm.portions,
        },
      });
      showToast(t("mealPlanner.entryAdded"), "ok");
      setEntryForm({ recipe_id: 0, day_of_week: "monday", meal_type: "lunch", portions: 1 });
      setModal(null);
      await loadPlan(selectedPlan.meal_plan.id);
    } catch (e) {
      showToast(t("mealPlanner.entryAddError"), "err");
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
        input: {
          recipe_id: entryForm.recipe_id,
          day_of_week: entryForm.day_of_week,
          meal_type: entryForm.meal_type,
          portions: entryForm.portions,
        },
      });
      showToast(t("mealPlanner.entryUpdated"), "ok");
      setEntryForm({ recipe_id: 0, day_of_week: "monday", meal_type: "lunch", portions: 1 });
      setEditingEntry(null);
      setModal(null);
      if (selectedPlan) await loadPlan(selectedPlan.meal_plan.id);
    } catch (e) {
      showToast(t("mealPlanner.entryUpdateError"), "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleEntryDelete(id: number) {
    try {
      await invoke("meal_entry_delete", { id });
      showToast(t("mealPlanner.entryDeleted"), "ok");
      if (selectedPlan) await loadPlan(selectedPlan.meal_plan.id);
    } catch (e) {
      showToast(t("mealPlanner.entryDeleteError"), "err");
    }
  }

  // Generate shopping list
  async function handleGenerateShoppingList() {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      const result = await invoke<MealPlanShoppingList>("meal_plan_generate_shopping_list", {
        planId: selectedPlan.meal_plan.id,
        portionsMultiplier: 1,
      });
      showToast(t("mealPlanner.shoppingListGenerated", { name: result.shopping_list.name }), "ok");
    } catch (e) {
      showToast(t("mealPlanner.shoppingListError"), "err");
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="content">
      <PageHeader
        title={t("mealPlanner.title")}
        subtitle={t("mealPlanner.subtitle")}
        actions={
          <button className="btn-primary" onClick={() => openPlanModal("create")}>
            <span className="ms" style={{ fontSize: 16 }}>add</span>
            {t("mealPlanner.newPlan")}
          </button>
        }
      />

      {!selectedPlan ? (
        <PlanList
          mealPlans={mealPlans}
          openPlanModal={openPlanModal}
          loadPlan={loadPlan}
          setConfirmDelete={setConfirmDelete}
          t={t}
        />
      ) : (
        <WeeklyGrid
          selectedPlan={selectedPlan}
          loading={loading}
          handleGenerateShoppingList={handleGenerateShoppingList}
          openPlanModal={openPlanModal}
          setSelectedPlan={setSelectedPlan}
          getEntry={getEntry}
          openEntryModal={openEntryModal}
          handleEntryDelete={handleEntryDelete}
          t={t}
        />
      )}

      {/* Plan Modal */}
      <Modal
        open={modal === "create" || modal === "edit"}
        onClose={closeModal}
        title={modal === "create" ? t("mealPlanner.modal.newPlanTitle") : t("mealPlanner.modal.editPlanTitle")}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={modal === "create" ? handlePlanCreate : handlePlanUpdate} disabled={loading || !planForm.name.trim()}>
              {loading ? t("mealPlanner.modal.saving") : modal === "create" ? t("mealPlanner.modal.create") : t("common.save")}
            </button>
          </>
        }
      >
        <div className="modal-body">
          <div className="field">
            <label className="field-label" htmlFor="plan-name">{t("mealPlanner.modal.planNameLabel")}</label>
            <input
              id="plan-name"
              type="text"
              className="input"
              value={planForm.name}
              onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
              placeholder={t("mealPlanner.modal.planNamePlaceholder")}
              autoFocus
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div className="field">
              <label className="field-label" htmlFor="plan-start">{t("mealPlanner.modal.startDate")}</label>
              <input
                id="plan-start"
                type="date"
                className="input"
                value={planForm.start_date}
                onChange={e => setPlanForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="plan-end">{t("mealPlanner.modal.endDate")}</label>
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
      </Modal>

      {/* Entry Modal */}
      <Modal
        open={modal === "entry"}
        onClose={closeModal}
        title={editingEntry ? t("mealPlanner.entryModal.editTitle") : t("mealPlanner.entryModal.addTitle")}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={editingEntry ? handleEntryUpdate : handleEntryAdd} disabled={loading || entryForm.recipe_id === 0}>
              {loading ? t("mealPlanner.modal.saving") : editingEntry ? t("common.save") : t("mealPlanner.entryModal.add")}
            </button>
          </>
        }
      >
        <div className="modal-body">
          <div className="field">
            <label className="field-label" htmlFor="entry-recipe">{t("mealPlanner.entryModal.recipeLabel")}</label>
            <select
              id="entry-recipe"
              className="select"
              value={entryForm.recipe_id}
              onChange={e => setEntryForm(f => ({ ...f, recipe_id: parseInt(e.target.value) || 0 }))}
            >
              <option value="0">{t("mealPlanner.entryModal.selectRecipe")}</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.portions} {t("mealPlanner.entryModal.portionsSuffix")})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div className="field">
              <label className="field-label" htmlFor="entry-day">{t("mealPlanner.entryModal.dayLabel")}</label>
              <select
                id="entry-day"
                className="select"
                value={entryForm.day_of_week}
                onChange={e => setEntryForm(f => ({ ...f, day_of_week: e.target.value as DayOfWeek }))}
              >
                {DAYS.map(d => (
                  <option key={d} value={d}>{getDayLabels(t)[d]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="entry-meal">{t("mealPlanner.entryModal.mealLabel")}</label>
              <select
                id="entry-meal"
                className="select"
                value={entryForm.meal_type}
                onChange={e => setEntryForm(f => ({ ...f, meal_type: e.target.value as MealType }))}
              >
                {MEAL_TYPES.map(m => (
                  <option key={m} value={m}>{getMealLabels(t)[m]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="entry-portions">{t("mealPlanner.entryModal.portionsLabel")}</label>
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
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("mealPlanner.confirmDeleteTitle")}
        body={t("mealPlanner.confirmDeleteBody")}
        onConfirm={() => {
          if (confirmDelete !== null) handlePlanDelete(confirmDelete);
        }}
        onCancel={() => setConfirmDelete(null)}
        danger
      />
    </div>
  );
}

// Sub-components

function PlanList({
  mealPlans,
  openPlanModal,
  loadPlan,
  setConfirmDelete,
  t,
}: {
  mealPlans: MealPlan[];
  openPlanModal: (type: "create" | "edit", plan?: any) => void;
  loadPlan: (id: number) => void;
  setConfirmDelete: (id: number) => void;
  t: T;
}) {
  const locale = t("calendar.locale");
  return (
    <div className="card" style={{ padding: "28px", margin: "0 auto", maxWidth: "760px" }}>
      <h2 className="section-title" style={{ marginBottom: "18px" }}>{t("mealPlanner.yourPlans")}</h2>
      {mealPlans.length === 0 ? (
        <EmptyState
          icon={<span className="ms" style={{ fontSize: 32 }}>calendar_month</span>}
          title={t("mealPlanner.noPlans")}
          body={t("mealPlanner.noPlansDesc")}
          action={
            <button className="btn-primary" onClick={() => openPlanModal("create")}>
              <span className="ms" style={{ fontSize: 16 }}>add</span>
              {t("mealPlanner.createPlan")}
            </button>
          }
        />
      ) : (
        <div className="item-grid">
          {mealPlans.map(plan => (
            <div key={plan.id} className="item-card" style={{ flexDirection: "column", alignItems: "stretch", cursor: "default" }}>
              <div>
                <h3 className="item-name">{plan.name}</h3>
                <p className="item-meta">
                  {new Date(plan.start_date).toLocaleDateString(locale)} – {new Date(plan.end_date).toLocaleDateString(locale)}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button className="btn-primary btn-sm" style={{ flex: 1 }} onClick={() => loadPlan(plan.id)}>
                  {t("mealPlanner.open")}
                </button>
                <button className="btn btn-sm" onClick={() => openPlanModal("edit", { meal_plan: plan, entries: [] })}>
                  {t("common.edit")}
                </button>
                <button className="btn-icon danger" onClick={() => setConfirmDelete(plan.id)} aria-label={t("mealPlanner.deletePlanAria")}>
                  <span className="ms" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyGrid({
  selectedPlan,
  loading,
  handleGenerateShoppingList,
  openPlanModal,
  setSelectedPlan,
  getEntry,
  openEntryModal,
  handleEntryDelete,
  t,
}: {
  selectedPlan: MealPlanWithEntries;
  loading: boolean;
  handleGenerateShoppingList: () => void;
  openPlanModal: (type: "create" | "edit", plan?: any) => void;
  setSelectedPlan: (plan: MealPlanWithEntries | null) => void;
  getEntry: (day: DayOfWeek, meal: MealType) => MealPlanEntry | undefined;
  openEntryModal: (day: DayOfWeek, meal: MealType, entry?: MealPlanEntry) => void;
  handleEntryDelete: (id: number) => void;
  t: T;
}) {
  const startTime = new Date(selectedPlan.meal_plan.start_date).getTime();
  const locale = t("calendar.locale");
  const dayLabelsShort = getDayLabelsShort(t);
  const mealLabels = getMealLabels(t);

  return (
    <>
      <div className="card" style={{ marginBottom: "16px", padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 className="content-title" style={{ fontSize: "20px" }}>{selectedPlan.meal_plan.name}</h2>
            <p className="content-sub mono">
              {new Date(selectedPlan.meal_plan.start_date).toLocaleDateString(locale, { day: "numeric", month: "long" })} – {new Date(selectedPlan.meal_plan.end_date).toLocaleDateString(locale, { day: "numeric", month: "long" })}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn-icon" onClick={() => setSelectedPlan(null)} aria-label={t("mealPlanner.backToPlans")}>
              <span className="ms" style={{ fontSize: 18 }}>arrow_back</span>
            </button>
            <button className="btn" onClick={() => openPlanModal("edit", selectedPlan)}>
              {t("mealPlanner.editPlan")}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "132px repeat(7, minmax(120px, 1fr))", gap: "1px", background: "var(--line-2)" }}>
          <div style={{ background: "var(--inset)", padding: "12px 14px" }} />
          {DAYS.map(day => (
            <div key={day} style={{ background: "var(--inset)", padding: "12px 8px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>
                {dayLabelsShort[day]}
              </div>
              <div className="mono" style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                {new Date(startTime + DAYS.indexOf(day) * 86400000).toLocaleDateString(locale, { day: "2-digit" })}
              </div>
            </div>
          ))}
        </div>
        {MEAL_TYPES.map(meal => (
          <div
            key={meal}
            style={{ display: "grid", gridTemplateColumns: "132px repeat(7, minmax(120px, 1fr))", gap: "6px", padding: "6px", borderTop: "1px solid var(--line-2)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 10px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: MEAL_COLORS[meal], flexShrink: 0 }} />
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink)" }}>{mealLabels[meal]}</span>
            </div>
            {DAYS.map(day => {
              const entry = getEntry(day, meal);
              return entry ? (
                <div
                  key={`${day}-${meal}`}
                  style={{
                    background: "var(--surface)",
                    borderLeft: `3px solid ${MEAL_COLORS[meal]}`,
                    borderRadius: "7px",
                    padding: "8px 9px",
                    minHeight: 52,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "4px",
                  }}
                  onClick={() => openEntryModal(day, meal, entry)}
                >
                  <div>
                    <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>
                      {entry.recipe_name}
                    </div>
                    <div className="mono" style={{ fontSize: "9.5px", color: "var(--ink-3)", marginTop: "3px" }}>
                      {entry.portions} {t("dashboard.week.portions")}
                    </div>
                  </div>
                  <button
                    className="btn-icon danger"
                    style={{ width: 20, height: 20, alignSelf: "flex-end" }}
                    onClick={e => { e.stopPropagation(); handleEntryDelete(entry.id); }}
                    aria-label={t("mealPlanner.deleteEntryAria")}
                  >
                    <span className="ms" style={{ fontSize: 13 }}>delete</span>
                  </button>
                </div>
              ) : (
                <div
                  key={`${day}-${meal}`}
                  style={{
                    background: "transparent",
                    border: "1px dashed var(--line)",
                    borderRadius: "7px",
                    minHeight: 52,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: "var(--ink-3)",
                  }}
                  onClick={() => openEntryModal(day, meal)}
                >
                  <span className="ms" style={{ fontSize: 16 }}>add</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
        <button className="btn-primary" onClick={handleGenerateShoppingList} disabled={loading}>
          <span className="ms" style={{ fontSize: 18 }}>shopping_cart</span>
          {loading ? t("mealPlanner.generating") : t("mealPlanner.generateShoppingList")}
        </button>
      </div>

      <div className="card" style={{ marginTop: "16px", padding: "16px" }}>
        <h3 className="section-title">{t("mealPlanner.summary")}</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px" }}>
          <span className="mono"><strong>{selectedPlan.entries.length}</strong> {t("mealPlanner.mealsPlanned")}</span>
          <span className="mono"><strong>{[...new Set(selectedPlan.entries.map(e => e.recipe_id))].length}</strong> {t("mealPlanner.differentRecipes")}</span>
          <span className="mono"><strong>{selectedPlan.entries.reduce((sum, e) => sum + e.portions, 0)}</strong> {t("mealPlanner.totalPortions")}</span>
        </div>
      </div>
    </>
  );
}
