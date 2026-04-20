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
} from "../types";

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
    listar: (): Promise<Receita[]> =>
      invoke("listar_receitas"),

    obter: (id: number): Promise<Receita | null> =>
      invoke("obter_receita", { id }),

    criar: (payload: Omit<Receita, "id" | "created_at" | "updated_at"> & {
      ingredientes: { ingrediente_id: number; quantidade: number }[];
    }): Promise<Receita> =>
      invoke("criar_receita", { payload }),

    atualizar: (
      id: number,
      payload: Omit<Receita, "id" | "created_at" | "updated_at"> & {
        ingredientes: { ingrediente_id: number; quantidade: number }[];
      }
    ): Promise<Receita> =>
      invoke("atualizar_receita", { id, payload }),

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
};
