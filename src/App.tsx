import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Ingredientes from "./pages/Ingredientes";
import Receitas from "./pages/Receitas";
import ReceitaDetalhe from "./pages/ReceitaDetalhe";
import ReceitaForm from "./pages/ReceitaForm";
import Custos from "./pages/Custos";
import Definicoes from "./pages/Definicoes";
import Armazem from "./pages/Armazem";
import Relatorios from "./pages/Relatorios";
import Sugestor from "./pages/Sugestor";
import Importador from "./pages/Importador";

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
        <Route path="/definicoes" element={<Definicoes />} />
        <Route path="/armazem" element={<Armazem />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/sugestor" element={<Sugestor />} />
        <Route path="/importador" element={<Importador />} />
        <Route path="*" element={<Navigate to="/ingredientes" replace />} />
      </Route>
    </Routes>
  );
}
