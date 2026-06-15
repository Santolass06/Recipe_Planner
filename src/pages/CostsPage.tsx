import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RecipeIngredient {
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: number;
  name: string;
  category: string;
  ingredients: RecipeIngredient[];
  portions: number;
  instructions: string;
}

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

interface IngredientCost {
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_cost: number;
  promo_price_per_unit: number | null;
  promo_total_cost: number | null;
}

interface CostBreakdown {
  total_cost: number;
  cost_per_portion: number;
  ingredient_costs: IngredientCost[];
}

interface CostAnalysis {
  breakdown: CostBreakdown;
  breakdown_with_promo: CostBreakdown | null;
  margin_percent: number;
  suggested_price_per_portion: number;
  suggested_price_total: number;
  profit_per_portion: number;
  profit_total: number;
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

export default function CostsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [_ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [portions, setPortions] = useState<number>(4);
  const [margin, setMargin] = useState<number>(30);
  const [promoPrices, setPromoPrices] = useState<Record<number, number>>({});
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" | "info" } | null>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err" | "warn" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [recipesData, ingredientsData] = await Promise.all([
        invoke<Recipe[]>("recipes_list"),
        invoke<Ingredient[]>("ingredients_list"),
      ]);
      setRecipes(recipesData);
      setIngredients(ingredientsData);
      if (recipesData.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(recipesData[0].id);
      }
    } catch (e) {
      showToast("Erro ao carregar dados", "err");
    }
  }, [showToast, selectedRecipeId]);

  useEffect(() => { load(); }, [load]);

  const calculate = useCallback(async () => {
    if (!selectedRecipeId) return;
    const recipe = recipes.find(r => r.id === selectedRecipeId);
    if (!recipe) return;

    setLoading(true);
    try {
      const promoArray = Object.entries(promoPrices).map(([id, price]) => ({
        ingredient_id: parseInt(id),
        promo_price_per_unit: price,
      }));

      const result = await invoke<CostAnalysis>("analyze_recipe_cost", {
        recipeId: selectedRecipeId,
        marginPercent: margin,
        promoPrices: promoArray.map(p => [p.ingredient_id, p.promo_price_per_unit]),
      });

      setAnalysis(result);
    } catch (e) {
      showToast("Erro ao calcular custos", "err");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [selectedRecipeId, recipes, margin, promoPrices, showToast]);

  useEffect(() => { calculate(); }, [calculate]);

  const handlePortionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 1;
    setPortions(val);
  };

  const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    setMargin(val);
  };

  const handlePromoChange = (ingredientId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val) || val <= 0) {
      setPromoPrices(prev => { const n = { ...prev }; delete n[ingredientId]; return n; });
    } else {
      setPromoPrices(prev => ({ ...prev, [ingredientId]: val }));
    }
  };

  const clearPromo = (ingredientId: number) => {
    setPromoPrices(prev => { const n = { ...prev }; delete n[ingredientId]; return n; });
  };

  if (!selectedRecipeId || !analysis) {
    return (
      <div className="content">
        <div className="content-header">
          <div>
            <h1 className="content-title">Análise de Custos</h1>
            <p className="content-sub mono">Seleciona uma receita para analisar</p>
          </div>
          <div className="search-bar" style={{ maxWidth: 300 }}>
            <select className="select" style={{ width: "100%" }} 
              value={selectedRecipeId ?? ""} 
              onChange={e => setSelectedRecipeId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Seleciona receita…</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="empty" role="status" style={{ minHeight: 300 }}>
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
          </svg>
          <p className="empty-title">Nenhuma análise disponível</p>
          <p className="empty-desc">Cria uma receita na página de Receitas e seleciona-a aqui.</p>
        </div>
      </div>
    );
  }

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId)!;

  return (
    <div className="content">
      {/* Header */}
      <div className="content-header">
        <div style={{ flex: 1 }}>
          <h1 className="content-title">Análise de Custos</h1>
          <p className="content-sub mono">{selectedRecipe.name} • {selectedRecipe.portions} doses base</p>
        </div>
        <div className="search-bar" style={{ maxWidth: 350 }}>
          <select className="select" style={{ width: "100%" }} 
            value={selectedRecipeId ?? ""} 
            onChange={e => setSelectedRecipeId(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">Seleciona receita…</option>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: "var(--space-4) var(--space-5)", marginBottom: "var(--space-5)" }}>
        <div className="field-row" style={{ flexWrap: "wrap", gap: "var(--space-4)", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label className="field-label" htmlFor="portions">Porções</label>
            <input id="portions" type="number" className="input input-num" min="1" max="999"
              value={portions} onChange={handlePortionsChange} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label className="field-label" htmlFor="margin">Margem (%)</label>
            <input id="margin" type="number" className="input input-num" min="0" max="500" step="1"
              value={margin} onChange={handleMarginChange} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)" }}>
            <button className="btn btn-primary" onClick={calculate} disabled={loading}>
              {loading ? "A calcular…" : "Recalcular"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <div className="card" style={{ padding: "var(--space-4)", borderLeft: "4px solid var(--brand)" }}>
          <p className="text-3 mono">Custo Total</p>
          <p className="text-1 mono" style={{ fontSize: "28px", fontWeight: 600, color: "var(--brand)" }}>
            {analysis.breakdown.total_cost.toFixed(2)} €
          </p>
          <p className="text-3 mono" style={{ marginTop: "var(--space-1)" }}>
            {analysis.breakdown.cost_per_portion.toFixed(2)} € / dose
          </p>
        </div>
        <div className="card" style={{ padding: "var(--space-4)", borderLeft: "4px solid var(--ok)" }}>
          <p className="text-3 mono">Preço Sugerido</p>
          <p className="text-1 mono" style={{ fontSize: "28px", fontWeight: 600, color: "var(--ok)" }}>
            {analysis.suggested_price_per_portion.toFixed(2)} €
          </p>
          <p className="text-3 mono" style={{ marginTop: "var(--space-1)" }}>
            {analysis.suggested_price_total.toFixed(2)} € total
          </p>
        </div>
        <div className="card" style={{ padding: "var(--space-4)", borderLeft: "4px solid var(--warn)" }}>
          <p className="text-3 mono">Lucro por Dose</p>
          <p className="text-1 mono" style={{ fontSize: "28px", fontWeight: 600, color: "var(--warn)" }}>
            {analysis.profit_per_portion.toFixed(2)} €
          </p>
          <p className="text-3 mono" style={{ marginTop: "var(--space-1)" }}>
            Margem: {margin}%
          </p>
        </div>
        {analysis.breakdown_with_promo && (
          <div className="card" style={{ padding: "var(--space-4)", borderLeft: "4px solid var(--info)" }}>
            <p className="text-3 mono">Com Promoções</p>
            <p className="text-1 mono" style={{ fontSize: "28px", fontWeight: 600, color: "var(--info)" }}>
              {analysis.breakdown_with_promo.total_cost.toFixed(2)} €
            </p>
            <p className="text-3 mono" style={{ marginTop: "var(--space-1)" }}>
              Poupança: {(analysis.breakdown.total_cost - analysis.breakdown_with_promo.total_cost).toFixed(2)} €
            </p>
          </div>
        )}
      </div>

      {/* Ingredient Cost Breakdown Table */}
      <div className="card" style={{ marginBottom: "var(--space-5)" }}>
        <div className="field-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <h2 className="text-3" style={{ fontSize: "16px", fontWeight: 600 }}>Detalhe por Ingrediente</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th className="mono">Qtd</th>
                <th className="mono">Unid.</th>
                <th className="mono">Preço Base</th>
                <th className="mono">Custo Base</th>
                <th className="mono">Preço Promo</th>
                <th className="mono">Custo Promo</th>
              </tr>
            </thead>
            <tbody>
              {analysis.breakdown.ingredient_costs.map((ic, idx) => (
                <tr key={idx}>
                  <td>{ic.name}</td>
                  <td className="mono">{ic.quantity}</td>
                  <td>{UNIT_LABELS[ic.unit] ?? ic.unit}</td>
                  <td className="mono">{ic.price_per_unit.toFixed(4)} €</td>
                  <td className="mono">{ic.total_cost.toFixed(2)} €</td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                      <input
                        type="number"
                        className="input input-num"
                        style={{ width: 100 }}
                        min="0.0001"
                        step="0.0001"
                        value={ic.promo_price_per_unit ?? ""}
                        onChange={e => handlePromoChange(analysis.breakdown.ingredient_costs.findIndex(x => x === ic), e)}
                        placeholder="Promo"
                      />
                      {ic.promo_price_per_unit && (
                        <button className="btn-icon" onClick={() => clearPromo(analysis.breakdown.ingredient_costs.findIndex(x => x === ic))} aria-label="Limpar promoção">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="mono">
                    {ic.promo_total_cost !== undefined && ic.promo_total_cost !== null 
                      ? ic.promo_total_cost.toFixed(2) + " €" 
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--elevated)", fontWeight: 600 }}>
                <td>TOTAL</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="mono">{analysis.breakdown.total_cost.toFixed(2)} €</td>
                <td></td>
                <td className="mono">
                  {analysis.breakdown_with_promo 
                    ? analysis.breakdown_with_promo.total_cost.toFixed(2) + " €"
                    : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SVG Chart: Cost vs Profit */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h2 className="text-3" style={{ fontSize: "16px", fontWeight: 600, marginBottom: "var(--space-4)" }}>
          Custo vs Lucro (por dose)
        </h2>
        <div style={{ height: 200, display: "flex", alignItems: "flex-end", gap: "var(--space-3)", justifyContent: "center", paddingBottom: "var(--space-3)" }}>
          <div style={{ flex: 1, maxWidth: 120, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div 
              className="chart-bar-cost"
              style={{ 
                width: "100%", 
                background: "var(--danger)", 
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                transition: "height 0.3s ease",
                minHeight: "20px"
              }}
            />
            <span className="text-3 mono" style={{ marginTop: "var(--space-2)", color: "var(--danger)" }}>
              {analysis.breakdown.cost_per_portion.toFixed(2)} €
            </span>
            <span className="text-4">Custo</span>
          </div>
          <div style={{ flex: 1, maxWidth: 120, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div 
              className="chart-bar-profit"
              style={{ 
                width: "100%", 
                background: "var(--ok)", 
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                transition: "height 0.3s ease",
                minHeight: "20px"
              }}
            />
            <span className="text-3 mono" style={{ marginTop: "var(--space-2)", color: "var(--ok)" }}>
              {analysis.profit_per_portion.toFixed(2)} €
            </span>
            <span className="text-4">Lucro</span>
          </div>
          <div style={{ flex: 1, maxWidth: 120, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div 
              className="chart-bar-price"
              style={{ 
                width: "100%", 
                background: "var(--brand)", 
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                transition: "height 0.3s ease",
                minHeight: "20px"
              }}
            />
            <span className="text-3 mono" style={{ marginTop: "var(--space-2)", color: "var(--brand)" }}>
              {analysis.suggested_price_per_portion.toFixed(2)} €
            </span>
            <span className="text-4">Preço Venda</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-6)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div style={{ width: 12, height: 12, background: "var(--danger)", borderRadius: "var(--radius-sm)" }}></div>
            <span className="text-3">Custo</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div style={{ width: 12, height: 12, background: "var(--ok)", borderRadius: "var(--radius-sm)" }}></div>
            <span className="text-3">Lucro</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div style={{ width: 12, height: 12, background: "var(--brand)", borderRadius: "var(--radius-sm)" }}></div>
            <span className="text-3">Preço Venda</span>
          </div>
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