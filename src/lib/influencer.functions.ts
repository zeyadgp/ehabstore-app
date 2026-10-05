import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function assertAdmin() {
  const { requireAdminCaller } = await import("@/lib/caller.server");
  await requireAdminCaller();
}

/** يسمح فقط للمؤثر صاحب الحساب أو للمدير. */
async function assertInfluencerOwner(influencerId: string) {
  const { optionalCaller } = await import("@/lib/caller.server");
  const caller = await optionalCaller();
  if (!caller) throw new Error("يجب تسجيل الدخول");
  if (caller.isAdmin) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("influencers")
    .select("user_id")
    .eq("id", influencerId)
    .maybeSingle();
  if (!data || data.user_id !== caller.userId) throw new Error("غير مصرح");
}

// Zod schemas for validation
const createInfluencerSchema = z.object({
  name: z.string().trim().min(3, "الاسم الثلاثي مطلوب"),
  phone: z.string().trim().min(7, "رقم الهاتف غير صالح"),
  email: z
    .string()
    .trim()
    .email("البريد الإلكتروني غير صالح")
    .optional()
    .nullable()
    .or(z.literal("")),
  code: z.string().trim().min(2, "الكود قصير جداً").toUpperCase(),
  commissionPercent: z.number().min(0).max(100).default(10),
  notes: z.string().trim().optional().nullable(),
});

const updateInfluencerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(3),
  phone: z.string().trim().min(7),
  email: z.string().trim().optional().nullable().or(z.literal("")),
  code: z.string().trim().min(2).toUpperCase(),
  commissionPercent: z.number().min(0).max(100),
  status: z.enum(["active", "suspended", "pending"]),
  notes: z.string().trim().optional().nullable(),
});

const processWithdrawalSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "completed"]),
  adminNotes: z.string().trim().optional().nullable(),
});

// 1. جلب قائمة المؤثرين بالكامل للوحة الإدارة
export const getAdminInfluencers = createServerFn({ method: "GET" }).handler(async () => {
  await assertAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("influencers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
});

// 2. إنشاء مؤثر جديد بالتحقق من عدم تكرار الكود
export const createInfluencer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createInfluencerSchema.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const codeNormalized = data.code.trim().toUpperCase();

    // التحقق من تكرار الكود التسويقي
    const { data: existing } = await supabaseAdmin
      .from("influencers")
      .select("id")
      .eq("code", codeNormalized)
      .maybeSingle();

    if (existing) {
      throw new Error(`الكود التسويقي "${codeNormalized}" مستخدم بالفعل لمؤثر آخر`);
    }

    const { data: created, error } = await supabaseAdmin
      .from("influencers")
      .insert({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        code: codeNormalized,
        commission_percent: data.commissionPercent,
        notes: data.notes || null,
        status: "active",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return created;
  });

// 3. تعديل بيانات المؤثر
export const updateInfluencer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInfluencerSchema.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const codeNormalized = data.code.trim().toUpperCase();

    // التحقق من تكرار الكود مع مؤثر آخر
    const { data: existing } = await supabaseAdmin
      .from("influencers")
      .select("id")
      .eq("code", codeNormalized)
      .neq("id", data.id)
      .maybeSingle();

    if (existing) {
      throw new Error(`الكود التسويقي "${codeNormalized}" مستخدم بالفعل لمؤثر آخر`);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("influencers")
      .update({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        code: codeNormalized,
        commission_percent: data.commissionPercent,
        status: data.status,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

// 4. جلب مبيعات وعمولات مؤثر معين
export const getInfluencerEarnings = createServerFn({ method: "POST" })
  .inputValidator((id: unknown) => z.string().uuid().parse(id))
  .handler(async ({ data: influencerId }) => {
    await assertInfluencerOwner(influencerId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("affiliate_earnings")
      .select("*")
      .eq("influencer_id", influencerId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  });

// 5. جلب كافة طلبات السحب للوحة الإدارة
export const getAdminWithdrawals = createServerFn({ method: "GET" }).handler(async () => {
  await assertAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("affiliate_withdrawals")
    .select(
      `
        *,
        influencer:influencer_id (
          name,
          phone,
          code
        )
      `,
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
});

// 6. اعتماد أو رفض طلب سحب أرباح
export const processWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => processWithdrawalSchema.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. جلب بيانات طلب السحب الحالي
    const { data: withdrawal, error: getErr } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .select("*")
      .eq("id", data.id)
      .single();

    if (getErr || !withdrawal) throw new Error("لم يتم العثور على طلب السحب");
    if (withdrawal.status !== "pending") throw new Error("تمت معالجة هذا الطلب مسبقاً");

    // 2. إذا تم القبول أو الاكتمال، نقوم بالخصم من رصيد المؤثر
    if (data.status === "approved" || data.status === "completed") {
      const { data: influencer } = await supabaseAdmin
        .from("influencers")
        .select("id, balance")
        .eq("id", withdrawal.influencer_id)
        .single();

      if (!influencer) throw new Error("المؤثر غير مسجل في النظام");

      const balance = Number(influencer.balance ?? 0);
      const amount = Number(withdrawal.amount);

      if (balance < amount) {
        throw new Error(
          `عذراً، رصيد المؤثر الحالي (${balance} ر.ي) أقل من قيمة السحب المطلوبة (${amount} ر.ي)`,
        );
      }

      // خصم المبلغ من الرصيد الحالي للمؤثر
      const { error: updErr } = await supabaseAdmin
        .from("influencers")
        .update({
          balance: balance - amount,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", influencer.id);

      if (updErr) throw new Error("فشل تحديث رصيد المؤثر: " + updErr.message);
    }

    // 3. تحديث حالة الطلب
    const { data: updated, error: updWithErr } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .update({
        status: data.status,
        admin_notes: data.adminNotes || null,
        processed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id)
      .select("*")
      .single();

    if (updWithErr) throw new Error(updWithErr.message);
    return updated;
  });

const requestWithdrawalSchema = z.object({
  influencerId: z.string().uuid(),
  amount: z.number().min(500, "الحد الأدنى للسحب هو 500 ر.ي"),
  payoutMethod: z.string().trim().min(2, "اختر طريقة استلام صحيحة"),
  payoutDetails: z.string().trim().min(5, "الرجاء إدخال بيانات حساب المستلم كاملة"),
});

// 7. تقديم طلب سحب أرباح من قبل المؤثر نفسه
export const requestInfluencerWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestWithdrawalSchema.parse(data))
  .handler(async ({ data }) => {
    await assertInfluencerOwner(data.influencerId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. التحقق من رصيد المؤثر قبل تقديم الطلب
    const { data: influencer } = await supabaseAdmin
      .from("influencers")
      .select("id, balance, status")
      .eq("id", data.influencerId)
      .single();

    if (!influencer) throw new Error("المؤثر غير مسجل في النظام");
    if (influencer.status !== "active")
      throw new Error("حساب المؤثر موقف حالياً، يرجى التواصل مع الإدارة");

    const balance = Number(influencer.balance ?? 0);
    if (balance < data.amount) {
      throw new Error(`عذراً، رصيدك الحالي هو ${balance} YER ولا يمكنك سحب ${data.amount} YER`);
    }

    // 2. إدراج طلب سحب معلق
    const { data: request, error } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .insert({
        influencer_id: data.influencerId,
        amount: data.amount,
        payout_method: data.payoutMethod,
        payout_details: data.payoutDetails,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return request;
  });
