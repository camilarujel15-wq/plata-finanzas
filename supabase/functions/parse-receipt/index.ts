// Supabase Edge Function (V2) · OCR de comprobantes.
// Contrato estable para el cliente; el proveedor de visión es intercambiable.
//
// POST /functions/v1/parse-receipt
//   Authorization: Bearer <access_token del usuario>
//   Body: { "path": "<user_id>/<uuid>.jpg" }   (imagen ya subida al bucket privado "receipts")
// 200 → { "amount": 1850, "merchant": "Tambo", "date": "2026-10-19", "categoryKey": "food", "confidence": 0.92 }
//
// Implementación sugerida: descargar la imagen con el cliente del usuario (respeta RLS de Storage),
// enviarla a un modelo multimodal con salida JSON estricta y validar el resultado aquí antes de devolverlo.
// La clave del proveedor vive en los secretos de la función (nunca en el cliente).

import { createClient } from "jsr:@supabase/supabase-js@2";

interface ReceiptResult {
  amount: number | null;
  merchant: string | null;
  date: string | null;
  categoryKey: string | null;
  confidence: number;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response("Unauthorized", { status: 401 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return new Response("Unauthorized", { status: 401 });

  const { path } = (await req.json()) as { path?: string };
  if (!path || !path.startsWith(`${user.user.id}/`)) return new Response("Bad path", { status: 400 });

  const { data: file, error } = await sb.storage.from("receipts").download(path);
  if (error || !file) return new Response("Not found", { status: 404 });

  // TODO(V2): llamar al proveedor de visión con `file` y mapear su respuesta.
  const result: ReceiptResult = { amount: null, merchant: null, date: null, categoryKey: null, confidence: 0 };
  return Response.json(result);
});
