import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import PlaceholderPage from "./components/PlaceholderPage";
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
import ReportsPage from "./pages/ReportsPage";
import ReceiptScannerPage from "./pages/ReceiptScannerPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "ingredientes", element: <IngredientsPage /> },
      { path: "receitas", element: <RecipesPage /> },
      { path: "custos", element: <CostsPage /> },
      { path: "armazem", element: <StockPage /> },
      { path: "compras", element: <ShoppingListPage /> },
      { path: "planeamento", element: <MealPlannerPage /> },
      { path: "calendario", element: <CalendarPage /> },
      { path: "sugestor", element: <PlaceholderPage name="sugestor" /> },
      { path: "relatorios", element: <ReportsPage /> },
      { path: "fornecedores", element: <SuppliersPage /> },
      { path: "scanner", element: <ReceiptScannerPage /> },
      { path: "definicoes", element: <SettingsPage /> },
      { path: "ajuda", element: <PlaceholderPage name="ajuda" /> },
    ],
  },
]);