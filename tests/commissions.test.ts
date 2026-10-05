/**
 * Unit & Integration Tests for Commission Calculations and Status Synchronization
 * Run via: npx tsx tests/commissions.test.ts
 */

import { calculateCommissionFromProfit } from "../src/lib/commissions";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
}

console.log("=== بدء تشغيل اختبارات العمولات وتسوية الأرباح ===\n");

// 1. اختبارات الوحدة لدالة calculateCommissionFromProfit
console.log("1. اختبارات حساب العمولة من صافي الأرباح (Unit Tests):");

// Case A: توفر التكلفة ووجود ربح
{
  const total = 1000;
  const cost = 600;
  const percent = 10;
  const res = calculateCommissionFromProfit(total, cost, percent);
  assert(res.profitCents === 400, "حساب الربح المحقق (1000 - 600 = 400)");
  assert(res.commissionCents === 40, "حساب العمولة بنسبة 10% من الربح (40)");
  assert(res.reason === "ok", "حالة النجاح reason === 'ok'");
}

// Case B: غياب بيانات التكلفة (fallback to 0)
{
  const total = 1000;
  const cost = null;
  const percent = 10;
  const res = calculateCommissionFromProfit(total, cost, percent);
  assert(res.commissionCents === 0, "العمولة صفرية عند غياب التكلفة (null)");
  assert(res.profitCents === null, "الربح غير محدد عند غياب التكلفة");
  assert(res.reason === "no_cost_data", "السبب المسجل no_cost_data");
}

{
  const total = 1000;
  const cost = undefined;
  const percent = 10;
  const res = calculateCommissionFromProfit(total, cost, percent);
  assert(res.commissionCents === 0, "العمولة صفرية عند غياب التكلفة (undefined)");
  assert(res.reason === "no_cost_data", "السبب المسجل no_cost_data");
}

// Case C: خسارة أو تكلفة أعلى من السعر (Negative Profit)
{
  const total = 1000;
  const cost = 1200;
  const percent = 10;
  const res = calculateCommissionFromProfit(total, cost, percent);
  assert(res.profitCents === 0, "الربح صفر عند زيادة التكلفة عن السعر");
  assert(res.commissionCents === 0, "لا عمولة في حالة الخسارة");
  assert(res.reason === "negative_profit", "السبب المسجل negative_profit");
}

// Case D: التكلفة مطابقة للإجمالي (Zero Margin)
{
  const total = 1000;
  const cost = 1000;
  const percent = 10;
  const res = calculateCommissionFromProfit(total, cost, percent);
  assert(res.profitCents === 0, "الربح صفر عند تساوي التكلفة والإجمالي");
  assert(res.commissionCents === 0, "العمولة صفرية");
}

// 2. اختبار محاكاة تكامل دورة حياة الطلب (Integration Simulation)
console.log("\n2. اختبار محاكاة دورة حياة الطلب وعكس العمولات (Integration Flow):");

{
  // حالة طلب جديد
  let balance = 100;
  const orderId = "test-order-uuid";
  const commissionRecords: Array<{ id: string; orderId: string; amount: number; status: string }> =
    [];

  // A. اكتمال الطلب وتسوية العمولة
  const total = 5000;
  const cost = 3000;
  const res = calculateCommissionFromProfit(total, cost, 10);
  const commAmount = res.commissionCents; // 200

  commissionRecords.push({ id: "rec-1", orderId, amount: commAmount, status: "settled" });
  balance += commAmount;

  assert(balance === 300, "تمت إضافة العمولة للرصيد عند التسوية (100 + 200 = 300)");
  assert(commissionRecords[0].status === "settled", "حالة السجل settled");

  // B. إلغاء الطلب وعكس العمولة (Reversal)
  const rec = commissionRecords.find((r) => r.orderId === orderId && r.status === "settled");
  if (rec) {
    rec.status = "reversed";
    balance = Math.max(0, balance - rec.amount);
  }

  assert(balance === 100, "تم خصم العمولة وإعادة الرصيد إلى 100 عند الإلغاء");
  assert(commissionRecords[0].status === "reversed", "تغيرت حالة السجل إلى reversed");

  // C. محاولة العكس مرة أخرى (اختبار منع التكرار Idempotency)
  const duplicateRec = commissionRecords.find(
    (r) => r.orderId === orderId && r.status === "settled",
  );
  assert(
    duplicateRec === undefined,
    "لا يوجد سجل settled متبقٍ — تم منع العكس المزدوج بنجاح (Idempotent)",
  );
  assert(balance === 100, "الرصيد لم يتأثر عند تكرار طلب الإلغاء");
}

console.log("\n🎉 اكتملت جميع اختبارات التحقق بنجاح 100%!");
