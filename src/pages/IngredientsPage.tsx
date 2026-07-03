import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import IngredientAvatar from "../components/IngredientAvatar";
import ImageUpload from "../components/ImageUpload";

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

const UNIT_GROUPS = [
  { label: "Peso", units: ["gram", "kilogram", "milligram", "ounce", "pound", "pinch", "bunch", "clove", "slice"] },
  { label: "Volume", units: ["milliliter", "liter", "fluid_ounce", "cup", "pint", "quart", "gallon"] },
  { label: "Culinário", units: ["teaspoon", "tablespoon"] },
  { label: "Contagem", units: ["piece", "dozen"] },
  { label: "Outros", units: ["centimeter", "celsius", "fahrenheit"] },
];

const UNIT_LABELS: Record<string, string> = {
  gram: "g — Grama", kilogram: "kg — Quilograma", milligram: "mg — Miligrama",
  ounce: "oz — Onça", pound: "lb — Libra", pinch: "pitada — Pitada",
  bunch: "molho — Molho", clove: "dente — Dente", slice: "fatia — Fatia",
  milliliter: "ml — Mililitro", liter: "l — Litro",
  fluid_ounce: "fl oz — Fluid Ounce", cup: "cup — Chávena",
  pint: "pt — Pint", quart: "qt — Quart", gallon: "gal — Galão",
  teaspoon: "tsp — Colher de chá", tablespoon: "tbsp — Colher de sopa",
  piece: "pcs — Peça", dozen: "dz — Dúzia",
  centimeter: "cm — Centímetro", celsius: "°C — Celsius",
  fahrenheit: "°F — Fahrenheit",
};

const UNIT_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(UNIT_LABELS).map(([k, v]) => [k, v.split(" — ")[0]])
);

const EMPTY_FORM = { name: "", unit: "gram", price_per_unit: 0 };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch (e) {
      showToast("Erro ao carregar ingredientes", "err");
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setModal("create");
  }

  function openEdit(ing: Ingredient) {
    setForm({ name: ing.name, unit: ing.unit, price_per_unit: ing.price_per_unit });
    setEditing(ing);
    setModal("edit");
  }

  function closeModal() { setModal(null); setEditing(null); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      if (modal === "create") {
        await invoke("ingredient_create", {
          input: {
            name: form.name.trim(),
            unit: form.unit,
            price_per_unit: form.price_per_unit,
          },
        });
        showToast("Ingrediente criado", "ok");
      } else if (editing) {
        await invoke("ingredient_update", {
          id: editing.id,
          input: {
            name: form.name.trim(),
            unit: form.unit,
            price_per_unit: form.price_per_unit,
          },
        });
        showToast("Ingrediente actualizado", "ok");
      }
      closeModal();
      await load();
    } catch (e) {
      showToast("Erro ao guardar", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await invoke("ingredient_delete", { id });
      setConfirmDelete(null);
      showToast("Ingrediente eliminado", "ok");
      await load();
    } catch (e) {
      showToast("Erro ao eliminar", "err");
    }
  }

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="content">
      <PageHeader
        title="Ingredientes"
        subtitle={`Inventário · ${ingredients.length} ${ingredients.length === 1 ? "item" : "itens"}`}
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">add</span>
            Novo ingrediente
          </button>
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-4)" }}>
        <div className="search-bar" role="search" aria-label="Pesquisar ingredientes" style={{ maxWidth: 320 }}>
          <span className="ms" style={{ fontSize: 18, color: "var(--ink-3)" }} aria-hidden="true">search</span>
          <input
            placeholder="Pesquisar ingredientes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Pesquisar"
          />
        </div>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
          {filtered.length} {filtered.length === 1 ? "ingrediente" : "ingredientes"}
        </span>
      </div>

      {filtered.length === 0 && (
        <div className="empty" role="status">
          <span className="ms" style={{ fontSize: 44, color: "var(--ink-3)" }} aria-hidden="true">search_off</span>
          <p className="empty-title">{search ? "Sem resultados" : "Sem ingredientes"}</p>
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
            {search ? "Tenta outra pesquisa." : "Adiciona o primeiro ingrediente para começar."}
          </p>
          {!search && (
            <button className="btn-primary" onClick={openCreate} style={{ marginTop: 8 }}>
              <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">add</span>
              Adicionar ingrediente
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Nome</th>
                  <th>Unidade</th>
                  <th style={{ textAlign: "right" }}>Preço</th>
                  <th style={{ width: 100, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ing => (
                  <tr key={ing.id}>
                    <td><IngredientAvatar name={ing.name} /></td>
                    <td style={{ fontWeight: 500 }}>{ing.name}</td>
                    <td className="mono" style={{ color: "var(--ink-2)" }}>{UNIT_SHORT[ing.unit] ?? ing.unit}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{ing.price_per_unit.toFixed(2)} €</td>
                    <td>
                      {confirmDelete === ing.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }} role="alert">
                          <button
                            className="btn-icon danger"
                            onClick={() => handleDelete(ing.id)}
                            aria-label="Confirmar eliminação"
                            title="Confirmar"
                          >
                            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">check</span>
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => setConfirmDelete(null)}
                            aria-label="Cancelar"
                            title="Cancelar"
                          >
                            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">close</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }} role="group" aria-label="Ações do ingrediente">
                          <button
                            className="btn-icon"
                            onClick={() => openEdit(ing)}
                            title="Editar"
                            aria-label={`Editar ${ing.name}`}
                          >
                            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">edit</span>
                          </button>
                          <button
                            className="btn-icon danger"
                            onClick={() => setConfirmDelete(ing.id)}
                            title="Eliminar"
                            aria-label={`Eliminar ${ing.name}`}
                          >
                            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h2 id="modal-title" className="modal-title" style={{ margin: 0 }}>
                {modal === "create" ? "Novo ingrediente" : "Editar ingrediente"}
              </h2>
              <button className="btn-icon" onClick={closeModal} aria-label="Fechar">
                <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">close</span>
              </button>
            </header>
            <div>
              <div className="field">
                <label htmlFor="name">Nome</label>
                <input
                  id="name"
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSave()}
                  placeholder="ex: Arroz arbório"
                />
              </div>

              <div className="field">
                <label htmlFor="unit">Unidade</label>
                <select
                  id="unit"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                >
                  {UNIT_GROUPS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.units.map(u => (
                        <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="price">Preço por unidade (€)</label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_per_unit}
                  onChange={e => setForm(f => ({
                    ...f,
                    price_per_unit: parseFloat(e.target.value) || 0
                  }))}
                  placeholder="0.00"
                />
              </div>

              <div className="field">
                <label>Imagem do ingrediente</label>
                <ImageUpload
                  entityType="ingredient"
                  entityId={editing?.id ?? 0}
                />
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={loading || !form.name.trim()}
              >
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
