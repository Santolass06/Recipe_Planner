import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import PlaceholderPage from "./components/PlaceholderPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true,              element: <PlaceholderPage name="ingredientes" /> },
      { path: "ingredientes",     element: <PlaceholderPage name="ingredientes" /> },
      { path: "receitas",         element: <PlaceholderPage name="receitas" /> },
      { path: "armazem",          element: <PlaceholderPage name="armazém" /> },
      { path: "sugestor",         element: <PlaceholderPage name="sugestor" /> },
      { path: "custos",           element: <PlaceholderPage name="custos" /> },
      { path: "relatorios",       element: <PlaceholderPage name="relatórios" /> },
      { path: "fornecedores",     element: <PlaceholderPage name="fornecedores" /> },
      { path: "importador",       element: <PlaceholderPage name="importador" /> },
      { path: "definicoes",       element: <PlaceholderPage name="definições" /> },
    ],
  },
]);