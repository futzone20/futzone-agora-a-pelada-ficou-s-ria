import { createFileRoute } from "@tanstack/react-router";
import { HomeDashboard } from "@/components/HomeDashboard";

export const Route = createFileRoute("/capitao/")({ component: HomeDashboard });
