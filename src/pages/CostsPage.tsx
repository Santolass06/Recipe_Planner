import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";

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
  is_approximate: boolean;
  approximation_note?: string | null;
  promo_price_per_unit?: number | null;
  promo_total_cost?: number | null;
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

const shortUnit = (unit: string) => (UNIT_LABELS[unit] ?? unit).split(" — ")[0];

const eur = (n: number) => `€${n.toFixed(2)}`;

export default function CostsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [_ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [portions, setPortions] = useState<number>(4);
  const [margin, setMargin] = useState<number>(30);
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

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
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const calculate = useCallback(async () => {
    if (!selectedRecipeId) return;
    const recipe = recipes.find(r => r.id === selectedRecipeId);
    if (!recipe) return;

    setLoading(true);
    try {
      const breakdown = await invoke<CostBreakdown>("cost_calculate", {
        recipeId: selectedRecipeId,
      });

      // A margem/lucro é calculada no frontend — o backend devolve só
      // CostBreakdown (total_cost, cost_per_portion, ingredient_costs).
      const total_cost = breakdown.total_cost;
      const cost_per_portion = breakdown.cost_per_portion;
      const marginMultiplier = 1 + margin / 100;
      const suggested_price_per_portion = cost_per_portion * marginMultiplier;
      const suggested_price_total = suggested_price_per_portion * portions;
      const profit_per_portion = suggested_price_per_portion - cost_per_portion;
      const profit_total = suggested_price_total - total_cost;

      setAnalysis({
        breakdown,
        breakdown_with_promo: null,
        margin_percent: margin,
        suggested_price_per_portion,
        suggested_price_total,
        profit_per_portion,
        profit_total,
      });
    } catch (e) {
      showToast("Erro ao calcular custos", "err");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [selectedRecipeId, recipes, margin, portions, showToast]);

  useEffect(() => { calculate(); }, [calculate]);

  const incPortions = () => setPortions(p => Math.min(999, p + 1));
  const decPortions = () => setPortions(p => Math.max(1, p - 1));

  const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMargin(isNaN(val) ? 0 : val);
  };

  if (!selectedRecipeId || !analysis) {
    return (
      <div className="content">
        <PageHeader title="Análise de Custos" subtitle="Seleciona uma receita para analisar" />
        {recipes.length > 0 && (
          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "18px" }}>
            {recipes.map(r => (
              <button
                key={r.id}
                className={`tab-item${r.id === selectedRecipeId ? " active" : ""}`}
                onClick={() => setSelectedRecipeId(r.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
        <EmptyState
          icon={
            <span className="ms" style={{ fontSize: 40, color: "var(--ink-3)" }}>calculate</span>
          }
          title="Nenhuma análise disponível"
          body="Cria uma receita na página de Receitas e seleciona-a aqui."
        />
      </div>
    );
  }

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId)!;
  const { breakdown } = analysis;
  const hasApprox = breakdown.ingredient_costs.some(ic => ic.is_approximate);
  const approxSum = breakdown.ingredient_costs
    .filter(ic => ic.is_approximate)
    .reduce((s, ic) => s + ic.total_cost, 0);
  const approxPct = breakdown.total_cost > 0 ? (approxSum / breakdown.total_cost) * 100 : 0;
  const foodCostPct = analysis.suggested_price_per_portion > 0
    ? (breakdown.cost_per_portion / analysis.suggested_price_per_portion) * 100
    : 0;

  return (
    <div className="content">
      <PageHeader
        title="Análise de Custos"
        subtitle={`${selectedRecipe.name} • ${selectedRecipe.portions} doses base`}
      />

      {/* Recipe switcher chips */}
      <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "18px" }}>
        {recipes.map(r => (
          <button
            key={r.id}
            className={`tab-item${r.id === selectedRecipeId ? " active" : ""}`}
            onClick={() => setSelectedRecipeId(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "16px", alignItems: "start" }}>
        {/* Breakdown card */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: "18px", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedRecipe.name}
              </div>
              <div className="mono" style={{ fontSize: "10.5px", color: "var(--ink-3)", marginTop: "3px" }}>
                Discriminado para {portions} porções {loading && "· a calcular…"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2px", background: "var(--inset)", border: "1px solid var(--line)", borderRadius: "9px", padding: "3px", flexShrink: 0 }}>
              <button
                onClick={decPortions}
                aria-label="Diminuir porções"
                style={{ width: 26, height: 26, border: "none", background: "var(--surface)", borderRadius: 6, cursor: "pointer", color: "var(--ink)", fontSize: 16 }}
              >
                −
              </button>
              <span className="mono" style={{ minWidth: 44, textAlign: "center", fontSize: "12.5px", fontWeight: 600, color: "var(--ink)" }}>
                {portions}
              </span>
              <button
                onClick={incPortions}
                aria-label="Aumentar porções"
                style={{ width: 26, height: 26, border: "none", background: "var(--surface)", borderRadius: 6, cursor: "pointer", color: "var(--ink)", fontSize: 16 }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 90px", gap: "10px", padding: "9px 20px", borderBottom: "1px solid var(--line)", background: "var(--inset)" }}>
            <span className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-3)" }}>Ingrediente</span>
            <span className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-3)", textAlign: "right" }}>Qtd.</span>
            <span className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-3)", textAlign: "right" }}>Custo</span>
          </div>

          {breakdown.ingredient_costs.length === 0 ? (
            <div style={{ padding: "24px 20px" }}>
              <p className="text-3" style={{ margin: 0, fontSize: "13px" }}>Sem ingredientes nesta receita.</p>
            </div>
          ) : (
            breakdown.ingredient_costs.map((ic, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 90px", gap: "10px", padding: "10px 20px", borderBottom: "1px solid var(--line-2)", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "var(--ink)" }}>{ic.name}</span>
                <span className="mono" style={{ fontSize: "12px", color: "var(--ink-2)", textAlign: "right" }}>
                  {ic.quantity} {shortUnit(ic.unit)}
                </span>
                <span style={{ textAlign: "right" }}>
                  {ic.is_approximate ? (
                    <span
                      className="mono"
                      title={ic.approximation_note ?? "Custo aproximado"}
                      style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--approx)", borderBottom: "1px dotted var(--approx)", cursor: "help" }}
                    >
                      ≈ {eur(ic.total_cost)}
                    </span>
                  ) : (
                    <span className="mono" style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink)" }}>
                      {eur(ic.total_cost)}
                    </span>
                  )}
                </span>
              </div>
            ))
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "var(--inset)" }}>
            <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--ink)" }}>Total da receita</span>
            <span className="mono" style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink)" }}>{eur(breakdown.total_cost)}</span>
          </div>
        </div>

        {/* Summary + margin */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "var(--ember)", borderRadius: "14px", padding: "20px", color: "var(--ember-ink)" }}>
            <div className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".8px", opacity: 0.85 }}>Custo por porção</div>
            <div className="mono" style={{ fontSize: "40px", fontWeight: 600, lineHeight: 1, marginTop: "8px" }}>
              {eur(breakdown.cost_per_portion)}
            </div>
            <div style={{ display: "flex", gap: "20px", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,.22)" }}>
              <div>
                <div className="mono" style={{ fontSize: "9px", opacity: 0.8, textTransform: "uppercase" }}>Food-cost</div>
                <div className="mono" style={{ fontSize: "16px", fontWeight: 600, marginTop: "2px" }}>{foodCostPct.toFixed(0)}%</div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: "9px", opacity: 0.8, textTransform: "uppercase" }}>Preço sug.</div>
                <div className="mono" style={{ fontSize: "16px", fontWeight: 600, marginTop: "2px" }}>{eur(analysis.suggested_price_per_portion)}</div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: "9px", opacity: 0.8, textTransform: "uppercase" }}>Margem</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "1px", marginTop: "2px" }}>
                  <input
                    type="number"
                    className="mono"
                    value={margin}
                    onChange={handleMarginChange}
                    aria-label="Margem (%)"
                    min={0}
                    max={500}
                    step={1}
                    style={{
                      width: "34px", fontSize: "16px", fontWeight: 600, background: "transparent",
                      border: "none", borderBottom: "1px dotted rgba(255,255,255,.6)", color: "var(--ember-ink)",
                      padding: 0, outline: "none",
                    }}
                  />
                  <span className="mono" style={{ fontSize: "16px", fontWeight: 600 }}>%</span>
                </div>
              </div>
            </div>
          </div>

          {hasApprox && (
            <div style={{ background: "var(--approx-soft)", border: "1px solid var(--approx)", borderRadius: "14px", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <span className="ms" style={{ fontSize: 20, color: "var(--approx)" }}>rule</span>
                <span style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--ink)" }}>Contém custos aproximados</span>
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.5, marginTop: "9px" }}>
                Alguns ingredientes usam conversões inexatas (contagem→peso, «q.b.»). Os valores marcados com ≈ são estimativas — passa o rato para ver o motivo.
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", paddingTop: "11px", borderTop: "1px solid var(--approx)" }}>
                <span className="mono" style={{ fontSize: "11px", color: "var(--approx)" }}>≈ do total é estimado</span>
                <span className="mono" style={{ fontSize: "13px", fontWeight: 600, color: "var(--approx)" }}>
                  {eur(approxSum)} · {approxPct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
