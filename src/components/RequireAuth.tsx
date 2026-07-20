import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, rolePath, type UserRole } from "@/lib/auth";

export function RequireAuth({
  allow,
  children,
}: {
  allow: UserRole[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
    } else if (!allow.includes(user.role)) {
      navigate({ to: rolePath(user.role) });
    }
  }, [user, loading, allow, navigate]);

  if (loading || !user || !allow.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }
  return <>{children}</>;
}
