import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout do Financeiro: as telas (Resumo, Entradas, Saídas, Fornecedores)
// são rotas filhas e aparecem como submenu na barra lateral.
export const Route = createFileRoute("/dono/financeiro")({ component: () => <Outlet /> });
