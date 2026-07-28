// Edge Function `send-push`
// Recebe { user_id, title, body, link }, busca as inscrições push desse
// usuário e manda a notificação de verdade pro navegador/celular dele,
// usando o protocolo Web Push (via VAPID).
//
// Chamada automaticamente pelo gatilho `disparar_push_trigger` sempre que
// uma linha nova entra em `notificacoes` — não precisa ser chamada manualmente.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@mrfut.com.br";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const { user_id, title, body, link } = await req.json();
    if (!user_id) return new Response("user_id ausente", { status: 400 });

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ enviado: 0 }), { status: 200 });
    }

    const payload = JSON.stringify({ title, body, link });
    let enviados = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        enviados++;
      } catch (err: any) {
        // 404/410 = inscrição expirou ou o usuário desinstalou — remove pra não tentar de novo
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    return new Response(JSON.stringify({ enviado: enviados }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ erro: err?.message || "erro desconhecido" }), { status: 500 });
  }
});
