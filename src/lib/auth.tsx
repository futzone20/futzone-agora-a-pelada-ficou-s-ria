import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type UserRole = "jogador" | "capitao" | "dono" | "parceiro" | "admin";
type DbRole = "jogador" | "capitao" | "dono_quadra" | "parceiro" | "admin";

const dbToApp = (r: DbRole): UserRole => (r === "dono_quadra" ? "dono" : r);
const appToDb = (r: UserRole): DbRole => (r === "dono" ? "dono_quadra" : r);

export interface FZUser {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  nascimento: string;
  role: UserRole;
  goleiro?: boolean;
  posicao?: string | null;
  foto_url?: string | null;
  cidade?: string | null;
  estado?: string | null;
  peso?: number | null;
  altura?: number | null;
  bio?: string | null;
}

export interface SignUpData {
  nome: string;
  email: string;
  whatsapp: string;
  nascimento: string;
  password: string;
  role: UserRole;
  goleiro?: boolean;
}

interface AuthCtx {
  user: FZUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<FZUser>;
  signUp: (data: SignUpData) => Promise<FZUser>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<Omit<FZUser, "id" | "role">>) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function loadProfile(userId: string): Promise<FZUser | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, nome, email, whatsapp, data_nascimento, role, quer_ser_goleiro, posicao_preferida, foto_url, cidade, estado, peso, altura, bio")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as any;
  return {
    id: d.user_id,
    nome: d.nome ?? "",
    email: d.email ?? "",
    whatsapp: d.whatsapp ?? "",
    nascimento: d.data_nascimento ?? "",
    role: dbToApp(d.role as DbRole),
    goleiro: !!d.quer_ser_goleiro,
    posicao: d.posicao_preferida,
    foto_url: d.foto_url,
    cidade: d.cidade,
    estado: d.estado,
    peso: d.peso,
    altura: d.altura,
    bio: d.bio,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FZUser | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      return;
    }
    const p = await loadProfile(session.user.id);
    setUser(p);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer DB call to avoid deadlock
      setTimeout(() => { void hydrate(session); }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      void hydrate(data.session).finally(() => setLoading(false));
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Credenciais inválidas" : error.message);
    const p = await loadProfile(data.user.id);
    if (!p) throw new Error("Perfil não encontrado");
    setUser(p);
    return p;
  };

  const signUp: AuthCtx["signUp"] = async (d) => {
    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          nome: d.nome,
          whatsapp: d.whatsapp,
          data_nascimento: d.nascimento,
          role: appToDb(d.role),
          quer_ser_goleiro: !!d.goleiro,
        },
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes("registered")) throw new Error("Email já cadastrado");
      throw new Error(error.message);
    }
    if (!data.user) throw new Error("Erro ao criar conta");
    // Trigger creates profile + skills. Poll briefly.
    let p: FZUser | null = null;
    for (let i = 0; i < 5 && !p; i++) {
      await new Promise((r) => setTimeout(r, 200));
      p = await loadProfile(data.user.id);
    }
    if (!p) {
      p = { id: data.user.id, nome: d.nome, email: d.email, whatsapp: d.whatsapp, nascimento: d.nascimento, role: d.role, goleiro: d.goleiro };
    }
    setUser(p);
    return p;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateUser: AuthCtx["updateUser"] = async (patch) => {
    if (!user) return;
    const dbPatch: Record<string, unknown> = {};
    if (patch.nome !== undefined) dbPatch.nome = patch.nome;
    if (patch.whatsapp !== undefined) dbPatch.whatsapp = patch.whatsapp;
    if (patch.nascimento !== undefined) dbPatch.data_nascimento = patch.nascimento || null;
    if (patch.goleiro !== undefined) dbPatch.quer_ser_goleiro = patch.goleiro;
    if (patch.posicao !== undefined) dbPatch.posicao_preferida = patch.posicao;
    if (patch.foto_url !== undefined) dbPatch.foto_url = patch.foto_url;
    if (patch.cidade !== undefined) dbPatch.cidade = patch.cidade;
    if (patch.estado !== undefined) dbPatch.estado = patch.estado;
    if (patch.peso !== undefined) dbPatch.peso = patch.peso;
    if (patch.altura !== undefined) dbPatch.altura = patch.altura;
    if (patch.bio !== undefined) dbPatch.bio = patch.bio;
    const { error } = await supabase.from("profiles").update(dbPatch as never).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    setUser({ ...user, ...patch });
  };

  const refresh = async () => {
    if (!user) return;
    const p = await loadProfile(user.id);
    if (p) setUser(p);
  };

  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut, updateUser, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

export function rolePath(role: UserRole): string {
  switch (role) {
    case "jogador": return "/jogador";
    case "capitao": return "/capitao";
    case "dono": return "/dono";
    case "parceiro": return "/parceiro";
    case "admin": return "/admin";
  }
}
