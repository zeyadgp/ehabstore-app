/**
 * إشعارات الإدارة التلقائية عند وصول طلب جديد (خادم فقط).
 * تُسجّل الرسالة دائماً في سجل رسائل واتساب داخل اللوحة، ثم تُرسل تلقائياً
 * عبر واتساب و/أو البريد إذا كانت المفاتيح متوفرة — بدون إفشال الطلب أبداً.
 */
type AdminClient = {
  from: (table: string) => {
    insert: (rows: unknown) => Promise<{ error: unknown }>;
    select: (cols: string) => {
      limit: (n: number) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
      };
    };
  };
};

export type NewOrderNotice = {
  orderNumber: number | null;
  customerName: string;
  phone: string;
  city: string;
  district?: string | null;
  address: string;
  total: number;
  currencyLabel: string;
  paymentMethod?: string | null;
  items: { name: string; quantity: number; price: number }[];
};

export function buildOrderNotice(n: NewOrderNotice, storeName: string) {
  const lines = n.items.map(
    (i) => `• ${i.name} × ${i.quantity} = ${i.price * i.quantity} ${n.currencyLabel}`,
  );
  return [
    `🔔 طلب جديد في ${storeName}`,
    `رقم الطلب: #${n.orderNumber ?? "—"}`,
    `العميل: ${n.customerName}`,
    `الجوال: ${n.phone}`,
    `العنوان: ${n.city}${n.district ? ` - ${n.district}` : ""} - ${n.address}`,
    n.paymentMethod ? `الدفع: ${n.paymentMethod}` : null,
    "",
    ...lines,
    "",
    `الإجمالي: ${n.total} ${n.currencyLabel}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendWhatsappText(body: string, to: string): Promise<boolean> {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_ID"];

  if (token && phoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[sendWhatsappText] Meta WhatsApp API status: ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(
        "[sendWhatsappText] Failed to send via Meta WhatsApp API:",
        err instanceof Error ? err.name : "Timeout",
      );
      return false;
    }
  }

  const callMeBot = process.env["CALLMEBOT_APIKEY"];
  if (callMeBot) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(to)}&apikey=${encodeURIComponent(
        callMeBot,
      )}&text=${encodeURIComponent(body)}`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[sendWhatsappText] CallMeBot API status: ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(
        "[sendWhatsappText] CallMeBot request failed:",
        err instanceof Error ? err.name : "Timeout",
      );
      return false;
    }
  }

  return false;
}

async function sendEmail(subject: string, body: string, to: string) {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["ORDER_EMAIL_FROM"];
  if (!key || !from) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[sendEmail] Resend API error status: ${res.status}`);
    }
  } catch (err) {
    console.warn("[sendEmail] Email sending failed:", err instanceof Error ? err.name : "Timeout");
  }
}

/** يُنفّذ كل قنوات التنبيه المتاحة دون أن يرفع أي استثناء. */
export async function notifyNewOrder(
  supabaseAdmin: unknown,
  notice: NewOrderNotice,
  store: { name: string; whatsapp: string; email?: string | null },
) {
  const body = buildOrderNotice(notice, store.name);
  const db = supabaseAdmin as AdminClient;
  try {
    await db.from("whatsapp_messages").insert({
      phone: store.whatsapp,
      template: "new_order_admin",
      body,
    });
  } catch {
    /* السجل اختياري */
  }
  try {
    if (store.whatsapp) await sendWhatsappText(body, store.whatsapp.replace(/[^\d]/g, ""));
  } catch {
    /* واتساب اختياري */
  }
  try {
    if (store.email) await sendEmail(`طلب جديد #${notice.orderNumber ?? ""}`, body, store.email);
  } catch {
    /* البريد اختياري */
  }
}
