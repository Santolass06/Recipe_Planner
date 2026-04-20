// Espelha os modelos Rust — mantém em sincronia com src-tauri/src/models/

export type Unidade = "kg" | "g" | "l" | "ml" | "unidade" | "colher_sopa" | "colher_cha" | "chávena";

export interface Ingrediente {
  id: number;
  nome: string;
  unidade: Unidade;
  preco_atual: number;       // preço por unidade base (€)
  imagem_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoricoPreco {
  id: number;
  ingrediente_id: number;
  preco: number;
  data: string;
}

export interface Receita {
  id: number;
  nome: string;
  categoria: string | null;
  tags: string[];            // guardado como JSON em SQLite
  porcoes_base: number;
  instrucoes: string | null;
  imagem_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceitaIngrediente {
  receita_id: number;
  ingrediente_id: number;
  quantidade: number;
  ingrediente?: Ingrediente; // populated em joins
}

// Para cálculo de custo — pode ter preço promocional temporário
export interface IngredienteComPromocao {
  ingrediente_id: number;
  preco_promocao: number | null; // se null, usa o preco_atual da BD
}

export interface CustoReceita {
  receita_id: number;
  porcoes: number;
  custo_total: number;
  custo_por_porcao: number;
  margem_percentagem: number;
  preco_venda_sugerido: number;
  breakdown: CustoIngrediente[];
}

export interface CustoIngrediente {
  ingrediente_id: number;
  nome: string;
  quantidade: number;
  unidade: Unidade;
  preco_usado: number;       // pode ser preço normal ou promocional
  e_promocao: boolean;
  custo_parcial: number;
}
