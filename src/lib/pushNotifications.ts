import { supabase } from "@/integrations/supabase/client";

// Chave pública VAPID — vem de variável de ambiente (VITE_VAPID_PUBLIC_KEY),
// com fallback pro valor fixo caso a env var não esteja configurada. É segura
// de expor no frontend: é assim que o protocolo Web Push funciona (a pública
// fica no cliente, só a privada fica em segredo no servidor/Edge Function).
const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ||
  "BDIjdkbrdk2cHiLgLBN3Vg9hg1FrR3O_eSzY9V-IBupkl2CRdUDMw3_cREU88Rk3quXMUdZ5GFON4tp0Rqws7n0";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function pushSuportado() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function statusPermissaoPush(): Promise<NotificationPermission | "unsupported"> {
  if (!pushSuportado()) return "unsupported";
  return Notification.permission;
}

function comTimeout<T>(promessa: Promise<T>, ms: number, mensagem: string): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(mensagem)), ms)),
  ]);
}

/**
 * @param onProgresso callback opcional, chamado em cada etapa — útil pra
 * diagnosticar em qual passo travou quando algo não funciona (ex: Safari/iOS
 * às vezes falha silenciosamente sem lançar nenhum erro).
 */
export async function ativarPush(userId: string, onProgresso?: (msg: string) => void) {
  const log = (m: string) => onProgresso?.(m);

  if (!pushSuportado()) {
    throw new Error("Seu navegador não suporta notificações push (falta Notification, ServiceWorker ou PushManager).");
  }

  log("Pedindo permissão...");
  if (typeof Notification.requestPermission !== "function") {
    throw new Error("Notification.requestPermission não existe nesse navegador.");
  }
  const permissao = await Notification.requestPermission();
  log(`Permissão retornou: ${permissao}`);
  if (permissao !== "granted") {
    throw new Error(
      permissao === "denied"
        ? "Notificações bloqueadas. Vá em Ajustes do iPhone > Safari (ou o nome do app instalado) e libere manualmente."
        : "Permissão de notificação não concedida."
    );
  }

  log("Verificando o service worker...");
  const registration = await comTimeout(
    navigator.serviceWorker.ready,
    8000,
    "O service worker não ficou pronto a tempo (verifique se o app está instalado/atualizado)."
  );

  log("Buscando inscrição existente...");
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    log("Criando nova inscrição push...");
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  log("Salvando inscrição no servidor...");
  const json = subscription.toJSON();
  const { error } = await (supabase as any).from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh!,
      auth: json.keys!.auth!,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  log("Pronto!");
}

export async function desativarPush() {
  if (!pushSuportado()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await (supabase as any).from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }
}
