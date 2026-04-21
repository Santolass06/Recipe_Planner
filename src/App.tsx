import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Ingredientes from "./pages/Ingredientes";
import Receitas from "./pages/Receitas";
import ReceitaDetalhe from "./pages/ReceitaDetalhe";
import ReceitaForm from "./pages/ReceitaForm";
import Custos from "./pages/Custos";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/ingredientes" replace />} />
        <Route path="/ingredientes" element={<Ingredientes />} />
        <Route path="/receitas" element={<Receitas />} />
        <Route path="/receitas/nova" element={<ReceitaForm />} />
        <Route path="/receitas/:id" element={<ReceitaDetalhe />} />
        <Route path="/receitas/:id/editar" element={<ReceitaForm />} />
        <Route path="/custos/:id" element={<Custos />} />
        <Route path="*" element={<Navigate to="/ingredientes" replace />} />
      </Route>
    </Routes>
  );
}
