import { Order, OrderItem } from "@/lib/admin";
import type { Product } from "@/lib/store";
import { ProductCost } from "@/lib/suppliers";

export type ProfitSummary = {
  totalRevenue: number;
  productsRevenue: number;
  totalCogs: number;
  grossProfit: number;
  netProfit: number;
  profitMarginPercent: number;
  totalOrdersCount: number;
  paidOrdersCount: number;
  codPendingAmount: number;
  codCollectedAmount: number;
  averageOrderValue: number;
  totalDiscountAmount: number;
  deliveryFeesCollected: number;
  productsWithoutCostCount: number;
};

export type ProductProfitItem = {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  unitCost: number;
  unitPrice: number;
  totalCogs: number;
  profit: number;
  marginPercent: number;
  hasExplicitCost: boolean;
};

export function calculateFinancialProfits({
  orders,
  orderItems,
  products,
  costsMap,
  defaultCostRatio = 0, // 0 = سعر الشراء اختياري، وإذا لم يُحدد يعتبر 0 حتى يحدده التاجر
}: {
  orders: Order[];
  orderItems: OrderItem[];
  products: Product[];
  costsMap: Record<string, ProductCost>;
  defaultCostRatio?: number;
}): {
  summary: ProfitSummary;
  productProfits: ProductProfitItem[];
  dailyProfits: Array<{ date: string; revenue: number; cogs: number; profit: number }>;
} {
  // تصفية الطلبات المعتمدة (استبعاد الملغية والمرتجعة)
  const validOrders = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
  const validOrderMap = new Map<string, Order>();
  validOrders.forEach((o) => validOrderMap.set(o.id, o));

  let totalRevenue = 0;
  let productsRevenue = 0;
  let totalCogs = 0;
  let totalDiscountAmount = 0;
  let deliveryFeesCollected = 0;
  let codPendingAmount = 0;
  let codCollectedAmount = 0;
  let paidOrdersCount = 0;

  // خريطة المنتجات للبحث السريع
  const productById = new Map<string, Product>();
  products.forEach((p) => productById.set(p.id, p));

  // خريطة تجميع أرباح كل منتج
  const productStats = new Map<
    string,
    {
      name: string;
      qty: number;
      revenue: number;
      cogs: number;
      unitPrice: number;
      unitCost: number;
      hasExplicitCost: boolean;
    }
  >();

  // خريطة التوزيع اليومي للتطابق المحاسبي الدقيق
  const dailyMap = new Map<string, { revenue: number; cogs: number; profit: number }>();

  const getSafeDateKey = (dateStr: string): string => {
    try {
      return new Date(dateStr).toISOString().slice(0, 10);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  };

  // 1. حساب مجاميع الطلبات وتوزيع الإيرادات اليومية
  validOrders.forEach((o) => {
    const orderTotal = Number(o.total || 0);
    const orderDelivery = Number(o.delivery_fee || 0);
    const orderDiscount = Number((o as any).discount || 0);

    totalRevenue += orderTotal;
    deliveryFeesCollected += orderDelivery;
    totalDiscountAmount += orderDiscount;

    // تتبع حالة السداد
    if (o.payment_status === "paid") {
      paidOrdersCount++;
      codCollectedAmount += orderTotal;
    } else {
      if (
        o.payment_method?.toLowerCase().includes("cod") ||
        o.payment_method?.includes("استلام") ||
        !o.payment_method
      ) {
        codPendingAmount += orderTotal;
      }
    }

    // إضافة إيراد اليوم
    const dateKey = getSafeDateKey(o.created_at);
    const dayStat = dailyMap.get(dateKey) || { revenue: 0, cogs: 0, profit: 0 };
    dayStat.revenue += orderTotal;
    dailyMap.set(dateKey, dayStat);
  });

  // 2. حساب بنود المبيعات وتكلفة البضاعة المباعة (COGS)
  let productsWithoutCostCount = 0;

  orderItems.forEach((item) => {
    const order = validOrderMap.get(item.order_id);
    if (!order) return;

    const qty = Math.max(1, Number(item.quantity || 1));
    const itemPrice = Number(item.price || 0);
    const itemRevenue = itemPrice * qty;
    productsRevenue += itemRevenue;

    // التحقق من سعر الشراء (اختياري)
    let unitCost = 0;
    let hasExplicitCost = false;

    const matchedProduct = item.product_id ? productById.get(item.product_id) : null;
    const explicitCost = item.product_id ? costsMap[item.product_id]?.cost_price : null;
    const productFieldCost = (matchedProduct as any)?.cost_price;

    if (explicitCost !== undefined && explicitCost !== null && !isNaN(Number(explicitCost))) {
      unitCost = Math.max(0, Number(explicitCost));
      hasExplicitCost = true;
    } else if (
      productFieldCost !== undefined &&
      productFieldCost !== null &&
      !isNaN(Number(productFieldCost))
    ) {
      unitCost = Math.max(0, Number(productFieldCost));
      hasExplicitCost = true;
    } else if (defaultCostRatio > 0) {
      // نسبة تكلفة تقديرية إذا اختارها التاجر صراحة
      unitCost = Math.max(0, itemPrice * defaultCostRatio);
      hasExplicitCost = false;
    } else {
      // سعر الشراء غير محدد
      unitCost = 0;
      hasExplicitCost = false;
    }

    const itemCogs = unitCost * qty;
    totalCogs += itemCogs;

    // ربط تكلفة البضاعة باليوم الفعلي للطلب
    const orderDateKey = getSafeDateKey(order.created_at);
    const dayStat = dailyMap.get(orderDateKey) || { revenue: 0, cogs: 0, profit: 0 };
    dayStat.cogs += itemCogs;
    dailyMap.set(orderDateKey, dayStat);

    const prodId = item.product_id || item.product_name;
    const existing = productStats.get(prodId) || {
      name: item.product_name || "منتج",
      qty: 0,
      revenue: 0,
      cogs: 0,
      unitPrice: itemPrice,
      unitCost,
      hasExplicitCost,
    };

    existing.qty += qty;
    existing.revenue += itemRevenue;
    existing.cogs += itemCogs;
    existing.unitPrice = itemPrice;
    if (hasExplicitCost || !existing.hasExplicitCost) {
      existing.unitCost = unitCost;
      existing.hasExplicitCost = hasExplicitCost;
    }
    productStats.set(prodId, existing);
  });

  // حساب صافي الربح وهامش الربح بدقة
  // إجمالي ربح المنتجات = مبيعات المنتجات - تكلفة البضاعة
  const grossProfit = Math.max(0, productsRevenue - totalCogs);
  // صافي الربح الكلي = إجمالي الإيرادات - تكلفة البضاعة المباعة
  const netProfit = Math.max(0, totalRevenue - totalCogs);
  const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const averageOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

  // تحويل إحصاءات المنتجات إلى مصفوفة مرتبة حسب الربح
  const productProfits: ProductProfitItem[] = Array.from(productStats.entries())
    .map(([id, stat]) => {
      const profit = stat.revenue - stat.cogs;
      const margin = stat.revenue > 0 ? (profit / stat.revenue) * 100 : 0;
      if (!stat.hasExplicitCost) {
        productsWithoutCostCount++;
      }
      return {
        productId: id,
        productName: stat.name,
        quantitySold: stat.qty,
        totalRevenue: Math.round(stat.revenue * 100) / 100,
        unitCost: Math.round(stat.unitCost * 100) / 100,
        unitPrice: Math.round(stat.unitPrice * 100) / 100,
        totalCogs: Math.round(stat.cogs * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        marginPercent: Math.round(margin * 10) / 10,
        hasExplicitCost: stat.hasExplicitCost,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  // ترتيب الأيام وتحديث الأرباح الفعلية
  const dailyProfits = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stat]) => ({
      date,
      revenue: Math.round(stat.revenue),
      cogs: Math.round(stat.cogs),
      profit: Math.round(stat.revenue - stat.cogs),
    }));

  return {
    summary: {
      totalRevenue: Math.round(totalRevenue),
      productsRevenue: Math.round(productsRevenue),
      totalCogs: Math.round(totalCogs),
      grossProfit: Math.round(grossProfit),
      netProfit: Math.round(netProfit),
      profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
      totalOrdersCount: validOrders.length,
      paidOrdersCount,
      codPendingAmount: Math.round(codPendingAmount),
      codCollectedAmount: Math.round(codCollectedAmount),
      averageOrderValue: Math.round(averageOrderValue),
      totalDiscountAmount: Math.round(totalDiscountAmount),
      deliveryFeesCollected: Math.round(deliveryFeesCollected),
      productsWithoutCostCount,
    },
    productProfits,
    dailyProfits,
  };
}
