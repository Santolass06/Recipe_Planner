import { lazy, Suspense } from "react";
import { createBrowserRouter, redirect } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import IngredientsPage from "./pages/IngredientsPage";
import RecipesPage from "./pages/RecipesPage";
import CostsPage from "./pages/CostsPage";
import StockPage from "./pages/StockPage";
import ShoppingListPage from "./pages/ShoppingListPage";
import MealPlannerPage from "./pages/MealPlannerPage";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";
import SuppliersPage from "./pages/SuppliersPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import ReportsPage from "./pages/ReportsPage";
import HelpPage from "./pages/HelpPage";
import { invoke } from "./lib/devInvoke";
import type { Edition } from "../crates/core/bindings/Edition";
import { isProEdition } from "./lib/edition";

const ReceiptScannerPage = lazy(() => import("./pages/ReceiptScannerPage"));

/**
 * Loader guard (PRD-02): Pro-only routes redirect to Home when the edition is
 * not Pro. Running in a loader (rather than a render-time component) keeps the
 * redirect flush-free — navigation to the route is cancelled before it paints.
 *
 * (React Router v7's `redirect` takes a `ResponseInit`/status, not a
 * `{ replace }` option, so a plain home redirect is the idiomatic guard.)
 */
const requireProLoader = async () => {
  const edition = await invoke<Edition>("edition_get");
  if (!isProEdition(edition)) throw redirect("/");
  return null;
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "ingredientes", element: <IngredientsPage /> },
      { path: "receitas", element: <RecipesPage /> },
      { path: "custos", element: <CostsPage />, loader: requireProLoader },
      { path: "armazem", element: <StockPage /> },
      { path: "compras", element: <ShoppingListPage /> },
      { path: "eventos", element: <EventsPage />, loader: requireProLoader },
      { path: "eventos/:id", element: <EventDetailPage />, loader: requireProLoader },
      { path: "planeamento", element: <MealPlannerPage /> },
      { path: "calendario", element: <CalendarPage /> },
      { path: "sugestoes", element: <SuggestionsPage /> },
      { path: "relatorios", element: <ReportsPage /> },
      { path: "fornecedores", element: <SuppliersPage />, loader: requireProLoader },
      {
        path: "scanner",
        element: (
          <Suspense fallback={<div className="empty" style={{ minHeight: 200 }}>...</div>}>
            <ReceiptScannerPage />
          </Suspense>
        ),
      },
      { path: "definicoes", element: <SettingsPage /> },
      { path: "ajuda", element: <HelpPage /> },
    ],
  },
]);