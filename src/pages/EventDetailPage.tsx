import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "../lib/devInvoke";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { useI18n } from "../i18n";
import type { Event } from "../../crates/core/bindings/Event";
import type { RecipeWithIngredients as Recipe } from "../../crates/core/bindings/RecipeWithIngredients";
import type { Ingredient } from "../../crates/core/bindings/Ingredient";
import { RecipeFormContent, computeCostLines, eur, EMPTY_FORM } from "./RecipesPage";

type T = (key: string, params?: Record<string, string | number>) => string;

export default function EventDetailPage() {
  const { id } = useParams();
  const eventId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [event, setEvent] = useState<Event | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [catalog, setCatalog] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editModal, setEditModal] = useState<Recipe | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [events, eventRecipes, catalogRecipes, ingredientsData] = await Promise.all([
        invoke<Event[]>("events_list"),
        invoke<Recipe[]>("event_recipes_list", { eventId }),
        invoke<Recipe[]>("recipes_list"),
        invoke<Ingredient[]>("ingredients_list"),
      ]);
      setEvent(events.find(e => e.id === eventId) ?? null);
      setRecipes(eventRecipes);
      setCatalog(catalogRecipes);
      setIngredients(ingredientsData);
    } catch (e) {
      showToast(t("events.loadError"), "err");
    }
  }, [eventId, showToast, t]);

  useEffect(() => { load(); }, [load]);

  async function handleCopy(recipeId: number) {
    try {
      await invoke("recipe_copy_to_event", { recipeId, eventId });
      showToast(t("events.recipeCopied"), "ok");
      setPickerOpen(false);
      await load();
    } catch (e) {
      showToast(t("events.copyError"), "err");
    }
  }

  function openCreate() {
    setCreateForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  async function handleCreateNew() {
    if (!createForm.name.trim()) return;
    setSaving(true);
    try {
      await invoke("recipe_create", {
        input: {
          name: createForm.name.trim(),
          category: createForm.category,
          portions: createForm.portions,
          instructions: createForm.instructions.trim(),
          ingredients: createForm.ingredients.map(ing => ({
            ingredient_id: ing.ingredient_id,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
          prep_time_minutes: null,
          cook_time_minutes: null,
          tags: [],
          image_base64: null,
          event_id: eventId,
        },
      });
      showToast(t("events.recipeCreated"), "ok");
      setCreateOpen(false);
      await load();
    } catch (e) {
      showToast(t("events.copyError"), "err");
    } finally {
      setSaving(false);
    }
  }

  async function handlePromote(recipe: Recipe) {
    try {
      await invoke("recipe_promote_to_catalog", { id: recipe.id });
      showToast(t("events.recipePromoted"), "ok");
      await load();
    } catch (e) {
      showToast(t("events.promoteError"), "err");
    }
  }

  function openEdit(recipe: Recipe) {
    setEditForm({
      name: recipe.name,
      category: recipe.category,
      portions: recipe.portions,
      instructions: recipe.instructions ?? "",
      ingredients: (recipe.ingredients ?? []).map(ing => ({
        ingredient_id: ing.ingredient_id,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
      image_path: recipe.image_path ?? null,
    });
    setEditModal(recipe);
  }

  async function handleSaveEdit() {
    if (!editModal || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await invoke("recipe_update", {
        id: editModal.id,
        input: {
          name: editForm.name.trim(),
          category: editForm.category,
          portions: editForm.portions,
          instructions: editForm.instructions.trim(),
          ingredients: editForm.ingredients.map((ing: any) => ({
            ingredient_id: ing.ingredient_id,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
          prep_time_minutes: null,
          cook_time_minutes: null,
          tags: [],
          image_base64: null,
        },
      });
      showToast(t("events.variantUpdated"), "ok");
      setEditModal(null);
      await load();
    } catch (e) {
      showToast(t("events.variantSaveError"), "err");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(recipe: Recipe) {
    try {
      await invoke("recipe_delete", { id: recipe.id });
      setConfirmDelete(null);
      showToast(t("events.variantDeleted"), "ok");
      await load();
    } catch (e) {
      showToast(t("events.variantDeleteError"), "err");
    }
  }

  if (!event) {
    return (
      <div className="content">
        <PageHeader title={t("events.title")} actions={
          <button className="btn btn-secondary" onClick={() => navigate("/eventos")}>
            <span className="ms" style={{ fontSize: 16 }}>arrow_back</span>
            {t("events.backToList")}
          </button>
        } />
        <EmptyState title={t("events.notFound")} />
      </div>
    );
  }

  return (
    <div className="content">
      <PageHeader
        title={event.name}
        subtitle={t("events.detailSubtitle", { count: recipes.length })}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => navigate("/eventos")}>
              <span className="ms" style={{ fontSize: 16 }}>arrow_back</span>
              {t("events.backToList")}
            </button>
            <button className="btn btn-secondary" onClick={openCreate}>
              <span className="ms" style={{ fontSize: 16 }}>add</span>
              {t("events.createRecipe")}
            </button>
            <button className="btn btn-primary" onClick={() => setPickerOpen(true)}>
              <span className="ms" style={{ fontSize: 16 }}>content_copy</span>
              {t("events.addRecipe")}
            </button>
          </>
        }
      />

      {recipes.length === 0 ? (
        <EmptyState
          icon={<span className="ms" style={{ fontSize: 40 }}>restaurant</span>}
          title={t("events.noRecipes")}
          body={t("events.noRecipesDesc")}
          action={
            <button className="btn btn-primary" onClick={() => setPickerOpen(true)}>
              <span className="ms" style={{ fontSize: 16 }}>add</span>
              {t("events.addRecipe")}
            </button>
          }
        />
      ) : (
        <div role="list" aria-label={t("events.recipesAriaLabel")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {recipes.map(recipe => {
            const costLines = computeCostLines(recipe, recipe.portions, ingredients, t);
            const total = costLines.reduce((s, l) => s + l.cost, 0);
            const perPortion = total / (recipe.portions || 1);
            return (
              <article key={recipe.id} className="item-card" role="listitem" style={{ alignItems: "flex-start", padding: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: "var(--inset)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <span className="ms" style={{ fontSize: 23, color: "var(--ember)" }}>restaurant</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{recipe.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                    {recipe.category} · {recipe.portions} {t("recipes.perPortionAbbrev")}
                  </div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 8 }}>
                    {eur(perPortion)} <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400 }}>/{t("recipes.perPortionAbbrev")}</span>
                  </div>
                </div>
                <div className="item-actions" style={{ position: "absolute", top: 14, right: 16 }} role="group" aria-label={t("events.variantActionsAria", { name: recipe.name })}>
                  <button className="btn-icon" onClick={() => handlePromote(recipe)} title={t("events.promoteAction")} aria-label={t("events.promoteAria", { name: recipe.name })}>
                    <span className="ms" style={{ fontSize: 14 }}>public</span>
                  </button>
                  <button className="btn-icon" onClick={() => openEdit(recipe)} title={t("common.edit")} aria-label={t("events.editVariantAria", { name: recipe.name })}>
                    <span className="ms" style={{ fontSize: 14 }}>edit</span>
                  </button>
                  <button className="btn-icon danger" onClick={() => setConfirmDelete(recipe)} title={t("common.delete")} aria-label={t("events.deleteVariantAria", { name: recipe.name })}>
                    <span className="ms" style={{ fontSize: 14 }}>delete</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t("events.pickerTitle")}
      >
        {catalog.length === 0 ? (
          <p className="text-3">{t("events.pickerEmpty")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
            {catalog.map(recipe => (
              <div
                key={recipe.id}
                role="button"
                tabIndex={0}
                onClick={() => handleCopy(recipe.id)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleCopy(recipe.id); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 9, cursor: "pointer" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{recipe.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{recipe.category}</div>
                </div>
                <span className="ms" style={{ fontSize: 18, color: "var(--ink-3)" }} aria-hidden="true">content_copy</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("events.createRecipeTitle")}
        wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={handleCreateNew} disabled={saving || !createForm.name.trim()}>
              {saving ? t("recipes.modal.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <RecipeFormContent
          form={createForm}
          setForm={setCreateForm}
          ingredients={ingredients}
          isView={false}
          handleSave={handleCreateNew}
          editingId={null}
          t={t as T}
        />
      </Modal>

      {editModal && editForm && (
        <Modal
          open={true}
          onClose={() => setEditModal(null)}
          title={t("events.editVariantTitle", { name: editModal.name })}
          wide
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditModal(null)}>{t("common.cancel")}</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving || !editForm.name.trim()}>
                {saving ? t("recipes.modal.saving") : t("common.save")}
              </button>
            </>
          }
        >
          <RecipeFormContent
            form={editForm}
            setForm={setEditForm}
            ingredients={ingredients}
            isView={false}
            handleSave={handleSaveEdit}
            editingId={editModal.id}
            t={t as T}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("events.confirmDeleteVariantTitle")}
        body={confirmDelete ? t("events.confirmDeleteVariantBody", { name: confirmDelete.name }) : ""}
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </div>
  );
}
