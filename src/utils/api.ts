// src/utils/api.ts
// Todas as chamadas ao backend Rust passam por aqui.
// Usar invoke() diretamente nos componentes é má prática — centralizar aqui
// facilita testes, refactoring e tratamento de erros.

import { invoke } from "@tauri-apps/api/core";
import type {
  Ingrediente,
  IngredienteComPromocao,
  Receita,
  ReceitaCompleta,
  ReceitaIngredientePayload,
  CustoReceita,
  StockItem,
  RelatorioResumo,
} from "../types";

// The Rust model stores `tags` as a raw JSON string in SQLite.
// Tauri serializes it as a plain string, so we parse it here before it reaches components.
type RawReceita = Omit<Receita, "tags"> & { tags: string };
type RawReceitaCompleta = Omit<ReceitaCompleta, "tags"> & {
  tags: string;
  ingredientes: ReceitaIngredientePayload[];
};

function parseReceita(r: RawReceita): Receita {
  return { ...r, tags: JSON.parse(r.tags) as string[] };
}

function parseReceitaCompleta(r: RawReceitaCompleta): ReceitaCompleta {
  return { ...r, tags: JSON.parse(r.tags) as string[] };
}

let ingredientesListCache: Promise<Ingrediente[]> | null = null;
let receitasListCache: Promise<Receita[]> | null = null;
let stockListCache: Promise<StockItem[]> | null = null;
let sugestorCache: Promise<Receita[]> | null = null;

function invalidateIngredientes() {
  ingredientesListCache = null;
  stockListCache = null;
}

function invalidateReceitas() {
  receitasListCache = null;
  sugestorCache = null;
}

// ─── Ingredientes ─────────────────────────────────────────────────────────────

export const api = {
  ingredientes: {
    listar: (): Promise<Ingrediente[]> => {
      ingredientesListCache ??= invoke("listar_ingredientes");
      return ingredientesListCache;
    },

    obter: (id: number): Promise<Ingrediente | null> =>
      invoke("obter_ingrediente", { id }),

    criar: async (payload: Omit<Ingrediente, "id" | "created_at" | "updated_at">): Promise<Ingrediente> => {
      const row: Ingrediente = await invoke("criar_ingrediente", { payload });
      invalidateIngredientes();
      return row;
    },

    atualizar: async (
      id: number,
      payload: Omit<Ingrediente, "id" | "created_at" | "updated_at">
    ): Promise<Ingrediente> => {
      const row: Ingrediente = await invoke("atualizar_ingrediente", { id, payload });
      invalidateIngredientes();
      return row;
    },

    eliminar: async (id: number): Promise<void> => {
      await invoke("eliminar_ingrediente", { id });
      invalidateIngredientes();
    },
  },

  // ─── Receitas ──────────────────────────────────────────────────────────────

  receitas: {
    listar: async (): Promise<Receita[]> => {
      receitasListCache ??= invoke<RawReceita[]>("listar_receitas").then((rows) => rows.map(parseReceita));
      return receitasListCache;
    },

    obter: async (id: number): Promise<Receita | null> => {
      const row: RawReceita | null = await invoke("obter_receita", { id });
      return row ? parseReceita(row) : null;
    },

    obterCompleta: async (id: number): Promise<ReceitaCompleta | null> => {
      const row: RawReceitaCompleta | null = await invoke("obter_receita_completa", { id });
      return row ? parseReceitaCompleta(row) : null;
    },

    criar: async (payload: Omit<Receita, "id" | "created_at" | "updated_at"> & {
      ingredientes: { ingrediente_id: number; quantidade: number }[];
    }): Promise<Receita> => {
      const row: RawReceita = await invoke("criar_receita", { payload });
      invalidateReceitas();
      return parseReceita(row);
    },

    atualizar: async (
      id: number,
      payload: Omit<Receita, "id" | "created_at" | "updated_at"> & {
        ingredientes: { ingrediente_id: number; quantidade: number }[];
      }
    ): Promise<Receita> => {
      const row: RawReceita = await invoke("atualizar_receita", { id, payload });
      invalidateReceitas();
      return parseReceita(row);
    },

    eliminar: async (id: number): Promise<void> => {
      await invoke("eliminar_receita", { id });
      invalidateReceitas();
    },
  },

  // ─── Custos ────────────────────────────────────────────────────────────────

  custos: {
    calcular: (params: {
      receita_id: number;
      porcoes: number;
      margem_percentagem: number;
      promocoes: IngredienteComPromocao[];
    }): Promise<CustoReceita> =>
      invoke("calcular_custo_receita", { pedido: params }),
  },

  // ─── Stock ─────────────────────────────────────────────────────────────────

  stock: {
    listar: (): Promise<StockItem[]> => {
      stockListCache ??= invoke("listar_stock");
      return stockListCache;
    },

    atualizar: async (payload: { ingrediente_id: number; quantidade_disponivel: number }): Promise<StockItem> => {
      const row: StockItem = await invoke("atualizar_stock", { payload });
      stockListCache = null;
      sugestorCache = null;
      return row;
    },
  },

  // ─── Sugestor ──────────────────────────────────────────────────────────────

  sugestor: {
    receitasPossiveis: async (): Promise<Receita[]> => {
      sugestorCache ??= invoke<RawReceita[]>("receitas_possiveis").then((rows) => rows.map(parseReceita));
      return sugestorCache;
    },
  },

  // ─── Relatórios ────────────────────────────────────────────────────────────

  relatorios: {
    resumo: (): Promise<RelatorioResumo> =>
      invoke("relatorio_resumo"),
  },
};
