import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ShoppingItem {
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string;
  needed_quantity: number;
  stock_quantity: number;
  category: string;
}

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

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

export default function ShoppingListPage() {
  const [recipes, setRecipes] = useState<{id: number, name: string}[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);
  const [portionsMultiplier, setPortionsMultiplier] = useState<number>(1);
  const [shoppingList, setShoppingList] = useState<{ items: ShoppingItem[]; total_estimated_cost: number } | null>(null);
  const [purchased, setPurchased] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" | "info" } | null>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err" | "warn" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [recipesData, ingredientsData] = await Promise.all([
        invoke<{id: number, name: string}[]>("recipes_list"),
        invoke<Ingredient[]>("ingredients_list"),
      ]);
      setRecipes(recipesData);
      setIngredients(ingredientsData);
    } catch (e) {
      showToast("Erro ao carregar dados", "err");
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRecipeSelect = (id: number) => {
    setSelectedRecipeIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const generateList = async () => {
    if (selectedRecipeIds.length === 0) {
      showToast("Seleciona pelo menos uma receita", "warn");
      return;
    }
    setLoading(true);
    try {
      const list = await invoke<{items: ShoppingItem[], total_estimated_cost: number}>("shopping_generate", {
        recipeIds: selectedRecipeIds,
        portionsMultiplier,
      });
      setShoppingList(list);
      setPurchased(new Set());
      showToast("Lista de compras gerada", "ok");
    } catch (e) {
      showToast("Erro ao gerar lista", "err");
      setShoppingList(null);
    } finally {
      setLoading(false);
    }
  };

  const togglePurchased = (ingredientId: number) => {
    setPurchased(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  };

  const clearList = () => {
    setShoppingList(null);
    setSelectedRecipeIds([]);
    setPurchased(new Set());
  };

  if (!shoppingList) {
    return (
      <div className="content">
        <div className="content-header">
          <div>
            <h1 className="content-title">Lista de Compras</h1>
            <p className="content-sub mono">Seleciona receitas para gerar a lista</p>
          </div>
        </div>

        <div className="card" style={{ padding: "var(--space-5)", maxWidth: 600, margin: "0 auto" }}>
          <h2 className="text-3" style={{ marginBottom: "var(--space-4)" }}>Selecionar Receitas</h2>
          
          <div className="field" style={{ marginBottom: "var(--space-4)" }}>
            <label className="field-label" htmlFor="portions-multiplier">Multiplicador de porções</label>
            <input
              id="portions-multiplier"
              type="number"
              className="input input-num"
              min="1"
              max="50"
              value={portionsMultiplier}
              onChange={e => { const val = parseInt(e.target.value) || 1; setPortionsMultiplier(val); }}
            />
          </div>

          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {recipes.length === 0 ? (
              <p className="text-3" style={{ textAlign: "center", color: "var(--text-3)" }}>Nenhuma receita disponível</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {recipes.map(recipe => (
                  <label key={recipe.id} style={{ 
                    display: "flex", alignItems: "center", gap: "var(--space-3)",
                    padding: "var(--space-3)", border: "1px solid var(--border)", 
                    borderRadius: "var(--radius)", cursor: "pointer",
                    background: "var(--surface)",
                    transition: "background var(--fast), border-color var(--fast)"
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedRecipeIds.includes(recipe.id)}
                      onChange={() => handleRecipeSelect(recipe.id)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span className="text-2" style={{ flex: 1 }}>{recipe.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)", justifyContent: "center" }}>
            <button 
              className="btn btn-primary" 
              onClick={generateList} 
              disabled={selectedRecipeIds.length === 0 || loading}
              style={{ minWidth: 160 }}
            >
              {loading ? "A gerar…" : "Gerar Lista"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const itemsByCategory: Record<string, typeof shoppingList.items> = {};
  shoppingList.items.forEach(item => {
    if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
    itemsByCategory[item.category].push(item);
  });

  return (
    <div className="content">
      {/* Header */}
      <div className="content-header">
        <div>
          <h1 className="content-title">Lista de Compras</h1>
          <p className="content-sub mono">{shoppingList.items.length} itens • {shoppingList.total_estimated_cost.toFixed(2)} € estimado</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={clearList}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
            </svg>
            Limpar
          </button>
          <button className="btn btn-primary" onClick={generateList} disabled={loading}>
            {loading ? "A actualizar…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* List by Category */}
      <div className="card" style={{ overflow: "hidden" }}>
        {Object.entries(itemsByCategory).map(([category, items]) => (
          <div key={category} style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="field-row" style={{ padding: "var(--space-3) var(--space-4)", background: "var(--elevated)", fontWeight: 600, textTransform: "capitalize" }}>
              {category || "Sem categoria"}
              <span className="mono" style={{ color: "var(--text-3)" }}>{items.length} itens</span>
            </div>
            <div className="table-wrap" style={{ borderTop: "none" }}>
              <table className="table">
                <tbody>
                  {items.map((item, idx) => {
                    const isPurchased = purchased.has(item.ingredient_id);
                    const ingredient = ingredients.find(i => i.id === item.ingredient_id);
                    const price = ingredient?.price_per_unit || 0;
                    const itemCost = item.needed_quantity * price;
                    return (
                      <tr key={idx} style={{ opacity: isPurchased ? 0.5 : 1 }}>
                        <td style={{ width: "40%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                            <input
                              type="checkbox"
                              checked={purchased.has(item.ingredient_id)}
                              onChange={() => togglePurchased(item.ingredient_id)}
                              style={{ width: 18, height: 18, accentColor: "var(--brand)" }}
                            />
                            <div>
                              <span>{item.ingredient_name}</span>
                              <span className="text-4 mono" style={{ marginLeft: "var(--space-2)", color: "var(--text-3)" }}>
                                ({UNIT_LABELS[item.ingredient_unit] ?? item.ingredient_unit})
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="mono" style={{ width: "15%" }}>
                          {item.needed_quantity}
                          {isPurchased && <span className="text-4" style={{ marginLeft: "var(--space-2)", color: "var(--ok)" }}>✓</span>}
                        </td>
                        <td className="mono" style={{ width: "15%" }}>
                          <span style={{ textDecoration: isPurchased ? "line-through" : "none" }}>
                            Stock: {item.stock_quantity}
                          </span>
                        </td>
                        <td style={{ width: "15%", textAlign: "center" }}>
                          <span className={isPurchased ? "status ok" : (item.stock_quantity === 0 ? "status danger" : "status warn")}>
                            {isPurchased ? "Comprado" : item.stock_quantity === 0 ? "Faltando" : "Parcial"}
                          </span>
                        </td>
                        <td style={{ width: "15%" }}>
                          <span className="mono" style={{ color: "var(--brand)" }}>
                            ~{itemCost.toFixed(2)} €
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Total */}
        <div style={{ padding: "var(--space-4)", background: "var(--elevated)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Total estimado</span>
          <span className="mono" style={{ fontSize: "18px", color: "var(--brand)" }}>
            {shoppingList.total_estimated_cost.toFixed(2)} €
          </span>
        </div>
      </div>

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