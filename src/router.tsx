import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import PlaceholderPage from "./components/PlaceholderPage";
import IngredientsPage from "./pages/IngredientsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true,              element: <IngredientsPage /> },
      { path: "ingredientes",     element: <IngredientsPage /> },
      { path: "receitas",         element: <PlaceholderPage name="receitas" /> },
      { path: "armazem",          element: <PlaceholderPage name="armazém" /> },
      { path: "sugestor",         element: <PlaceholderPage name="sugestor" /> },
      { path: "custos",           element: <PlaceholderPage name="custos" /> },
      { path: "relatorios",       element: <PlaceholderPage name="relatórios" /> },
      { path: "fornecedores",     element: <PlaceholderPage name="fornecedores" /> },
      { path: "importador",       element: <PlaceholderPage name="importador" /> },
      { path: "definicoes",       element: <PlaceholderPage name="definições" /> },
      { path: "ajuda",            element: <PlaceholderPage name="ajuda" /> },
    ],
  },
]);