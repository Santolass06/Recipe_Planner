// src/utils/api.ts
// Todas as chamadas ao backend Rust passam por aqui.
// Usar invoke() diretamente nos componentes é má prática — centralizar aqui
// facilita testes, refactoring e tratamento de erros.

import { invoke } from "@tauri-apps/api/core";
import type {
  Ingrediente,
  IngredienteComPromocao,
  Receita,
  CustoReceita,
  StockItem,
  RelatorioResumo,
} from "../types";

// The Rust model stores `tags` as a raw JSON string in SQLite.
// Tauri serializes it as a plain string, so we parse it here before it reaches components.
type RawReceita = Omit<Receita, "tags"> & { tags: string };

function parseReceita(r: RawReceita): Receita {
  return { ...r, tags: JSON.parse(r.tags) as string[] };
}

// ─── Ingredientes ─────────────────────────────────────────────────────────────

export const api = {
  ingredientes: {
    listar: (): Promise<Ingrediente[]> =>
      invoke("listar_ingredientes"),

    obter: (id: number): Promise<Ingrediente | null> =>
      invoke("obter_ingrediente", { id }),

    criar: (payload: Omit<Ingrediente, "id" | "created_at" | "updated_at">): Promise<Ingrediente> =>
      invoke("criar_ingrediente", { payload }),

    atualizar: (
      id: number,
      payload: Omit<Ingrediente, "id" | "created_at" | "updated_at">
    ): Promise<Ingrediente> =>
      invoke("atualizar_ingrediente", { id, payload }),

    eliminar: (id: number): Promise<void> =>
      invoke("eliminar_ingrediente", { id }),
  },

  // ─── Receitas ──────────────────────────────────────────────────────────────

  receitas: {
    listar: async (): Promise<Receita[]> => {
      const rows: RawReceita[] = await invoke("listar_receitas");
      return rows.map(parseReceita);
    },

    obter: async (id: number): Promise<Receita | null> => {
      const row: RawReceita | null = await invoke("obter_receita", { id });
      return row ? parseReceita(row) : null;
    },

    criar: async (payload: Omit<Receita, "id" | "created_at" | "updated_at"> & {
      ingredientes: { ingrediente_id: number; quantidade: number }[];
    }): Promise<Receita> => {
      const row: RawReceita = await invoke("criar_receita", { payload });
      return parseReceita(row);
    },

    atualizar: async (
      id: number,
      payload: Omit<Receita, "id" | "created_at" | "updated_at"> & {
        ingredientes: { ingrediente_id: number; quantidade: number }[];
      }
    ): Promise<Receita> => {
      const row: RawReceita = await invoke("atualizar_receita", { id, payload });
      return parseReceita(row);
    },

    eliminar: (id: number): Promise<void> =>
      invoke("eliminar_receita", { id }),
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
    listar: (): Promise<StockItem[]> =>
      invoke("listar_stock"),

    atualizar: (payload: { ingrediente_id: number; quantidade_disponivel: number }): Promise<StockItem> =>
      invoke("atualizar_stock", { payload }),
  },

  // ─── Sugestor ──────────────────────────────────────────────────────────────

  sugestor: {
    receitasPossiveis: async (): Promise<Receita[]> => {
      const rows: RawReceita[] = await invoke("receitas_possiveis");
      return rows.map(parseReceita);
    },
  },

  // ─── Relatórios ────────────────────────────────────────────────────────────

  relatorios: {
    resumo: (): Promise<RelatorioResumo> =>
      invoke("relatorio_resumo"),
  },
};
