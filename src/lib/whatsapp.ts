import type { CartItem } from "./cart";

export type CheckoutInfo = {
  name: string;
  phone: string;
  city: string;
  district?: string;
  address: string;
  notes?: string;
};

function money(value: number, currencyLabel: string) {
  return `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currencyLabel}`;
}

export function buildWhatsappMessage(opts: {
  storeName: string;
  orderNumber?: number | null;
  info: CheckoutInfo;
  items: CartItem[];
  total: number;
  currencyLabel: string;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  couponCode?: string | null;
  pointsEarned?: number;
  deliveryNote?: string;
  paymentMethod?: string | null;
  orderUrl?: string | null;
  cartUrl?: string | null;
}) {
  const {
    storeName,
    orderNumber,
    info,
    items,
    total,
    currencyLabel,
    subtotal,
    deliveryFee,
    discount = 0,
    couponCode,
    pointsEarned = 0,
    deliveryNote,
    paymentMethod,
    orderUrl,
    cartUrl,
  } = opts;

  const orderNumStr = orderNumber ? `#${orderNumber}` : "";

  const lines = [
    `═════════════════════════`,
    `🛍️ *${storeName}* 🛍️`,
    `📄 *فاتورة طلب إلكترونية رسمية* ${orderNumStr}`,
    `═════════════════════════`,
    orderNumber ? `📋 *رقم الطلب:* #${orderNumber}` : null,
    `📅 *التاريخ:* ${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}`,
    "",
    `👤 *بيانات العميل:*`,
    `• الاسم: ${info.name}`,
    `• رقم الهاتف: ${info.phone}`,
    `• المحافظة: ${info.city}`,
    info.district ? `• المديرية/المنطقة: ${info.district}` : null,
    `• العنوان بالتفصيل: ${info.address}`,
    info.notes ? `• ملاحظات الطلب: ${info.notes}` : null,
    "",
    `📦 *تفاصيل المنتجات والخيارات:*`,
    `─────────────────────────`,
    ...items.map((i, idx) => {
      const parts = [`${idx + 1}️⃣ *${i.name}*`];
      const variantDetails: string[] = [];
      if (i.color) {
        variantDetails.push(`اللون: ${i.color}`);
      }
      if (i.size) {
        variantDetails.push(`المقاس: ${i.size}`);
      }
      if (variantDetails.length > 0) {
        parts.push(`   🎨 [ ${variantDetails.join(" | ")} ]`);
      }
      parts.push(
        `   • الكمية: ${i.quantity} × ${money(i.price, currencyLabel)} = *${money(i.price * i.quantity, currencyLabel)}*`,
      );
      return parts.join("\n");
    }),
    `─────────────────────────`,
    `💰 *ملخص الحساب والفاتورة:*`,
    subtotal !== undefined ? `• المجموع الفرعي: ${money(subtotal, currencyLabel)}` : null,
    deliveryFee !== undefined && deliveryFee > 0
      ? `• رسوم التوصيل: ${money(deliveryFee, currencyLabel)}`
      : null,
    discount > 0
      ? `• الخصم الترويجي${couponCode ? ` (كود ${couponCode})` : ""}: -${money(discount, currencyLabel)}`
      : null,
    `• *الإجمالي النهائي: ${money(total, currencyLabel)}*`,
    paymentMethod ? `• طريقة الدفع: ${paymentMethod}` : null,
    pointsEarned > 0
      ? `🎁 *نقاط نادي الولاء:* +${pointsEarned} نقطة ستضاف لرصيدك بعد التسليم`
      : null,
    deliveryNote ? `🚚 *ملاحظة التوصيل:* ${deliveryNote}` : null,
    "",
    `─────────────────────────`,
    orderUrl ? `🔗 *رابط استعراض وتتبع الطلب والفاتورة:*\n${orderUrl}` : null,
    cartUrl ? `🛒 *رابط المتجر والسلة:*\n${cartUrl}` : null,
    `═════════════════════════`,
    `💖 *شكراً لتسوقك وثقتك بنا!* 💖`,
  ].filter(Boolean);

  return lines.join("\n");
}

export function whatsappLink(number: string, message: string) {
  const clean = (number || "").replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function buildProductMessage(opts: {
  storeName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  currencyLabel: string;
  color?: string | null;
  size?: string | null;
  sku?: string | null;
  productUrl?: string | null;
}) {
  const {
    storeName,
    productName,
    quantity,
    unitPrice,
    currencyLabel,
    color,
    size,
    sku,
    productUrl,
  } = opts;

  const lines = [
    `═════════════════════════`,
    `⚡ *طلب شراء فوري عبر واتساب*`,
    `🛍️ *${storeName}*`,
    `═════════════════════════`,
    `مرحباً، أرغب بطلب هذا المنتج بشكل فوري:`,
    "",
    `📦 *المنتج:* ${productName}`,
    sku ? `🏷️ *كود المنتج (SKU):* ${sku}` : null,
    color ? `🎨 *اللون المختار:* ${color}` : null,
    size ? `📏 *الحجم/المقاس:* ${size}` : null,
    `🔢 *الكمية:* ${quantity}`,
    `💰 *سعر الحبة:* ${money(unitPrice, currencyLabel)}`,
    `💵 *الإجمالي:* *${money(unitPrice * quantity, currencyLabel)}*`,
    "",
    productUrl ? `🔗 *رابط المنتج في المتجر:*\n${productUrl}` : null,
    `═════════════════════════`,
    `يرجى تأكيد التوفر وترتيب الشحن والتوصيل. شكراً لكم!`,
  ].filter(Boolean);

  return lines.join("\n");
}
