import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiModelProvider = "gemini" | "openai" | "deepseek" | "grok" | "claude" | "lovable";

export interface GeminiModelInfo {
  id: string;
  name: string;
  badge?: string;
  tag?: string;
  description: string;
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    badge: "موصى به افتراضياً",
    tag: "الأحدث والأسرع",
    description:
      "أفضل توازن بين السرعة الفائقة والذكاء واستهلاك التكلفة، مثالي للدردشة المباشرة مع زوار المتجر.",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    badge: "فائق السرعة وخفيف",
    tag: "اقتصادي للكوتا",
    description:
      "نموذج فائق الخفة والسرعة، صُمم خصيصاً لتقليل استهلاك الحصص والعمل بأعلى كفاءة في أوقات الذروة.",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    badge: "أعلى ذكاء واستنتاج",
    tag: "منطق عميق",
    description:
      "أقوى نموذج رائد لتحليل مشكلات البشرة المعقدة والروتين الدقيق وربط المنتجات بذكاء استنتاجي متفوق.",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    badge: "الجيل الثاني",
    tag: "سرعة عالية",
    description:
      "نموذج الجيل الثاني فائق السرعة مع زمن استجابة منخفض جداً ودعم ممتاز للغة العربية.",
  },
  {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    badge: "إصدار خفيف وسريع",
    tag: "خفيف وعملي",
    description: "إصدار خفيف واقتصادي وسريع من الجيل الثاني للاستجابة السلسة والمباشرة.",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    badge: "مستقر ومجرب",
    tag: "اعتمادية واسعة",
    description: "إصدار 1.5 المستقر والمعتمد بكفاءة عالية وحدود طلبات واسعة.",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    badge: "سياق ضخم",
    tag: "دقة متقدمة",
    description:
      "نموذج احترافي يتمتع بنافذة سياق ضخمة جداً لاستيعاب تفاصيل دقيقة عن كل منتجات المتجر.",
  },
  {
    id: "gemini-1.5-flash-8b",
    name: "Gemini 1.5 Flash-8B",
    badge: "حجم كبير وسريع",
    tag: "أقل زمن تأخير",
    description: "نموذج 8B المخصص للأحجام العالية وأقل زمن تأخير ممكن.",
  },
];

export const GEMINI_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-2.5-pro",
  "gemini-1.5-pro",
];

export const OTHER_PROVIDER_MODELS: Record<
  string,
  { id: string; name: string; badge?: string; description?: string }[]
> = {
  openai: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      badge: "اقتصادي وسريع",
      description: "أسرع وأقل تكلفة",
    },
    { id: "gpt-4o", name: "GPT-4o", badge: "كامل القوة", description: "أعلى ذكاء واستنتاج" },
    {
      id: "o3-mini",
      name: "o3-mini",
      badge: "استدلال منطقي",
      description: "تفكير عميق للمهام الصعبة",
    },
  ],
  deepseek: [
    {
      id: "deepseek-chat",
      name: "DeepSeek Chat (V3)",
      badge: "موصى به",
      description: "سرعة ودقة فائقة",
    },
    {
      id: "deepseek-reasoner",
      name: "DeepSeek Reasoner (R1)",
      badge: "تفكير عميق",
      description: "نموذج التفكير R1",
    },
  ],
  grok: [
    {
      id: "grok-2-latest",
      name: "Grok 2 Latest",
      badge: "موصى به",
      description: "أحدث إصدار من xAI",
    },
    { id: "grok-beta", name: "Grok Beta", badge: "تجريبي", description: "إصدار تجريبي سريع" },
  ],
  claude: [
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      badge: "سريع وخفيف",
      description: "أسرع استجابة",
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      badge: "ذكاء عالي",
      description: "أقوى تفكير ولغة",
    },
  ],
};

export const PROVIDER_INFO: Record<
  AiModelProvider,
  { name: string; defaultModel: string; placeholder: string; envKeyName: string }
> = {
  gemini: {
    name: "جيميني (Google Gemini)",
    defaultModel: "gemini-2.5-flash",
    placeholder: "AIzaSy...",
    envKeyName: "GEMINI_API_KEY",
  },
  openai: {
    name: "أوبن إيه آي (OpenAI GPT)",
    defaultModel: "gpt-4o-mini",
    placeholder: "sk-proj-...",
    envKeyName: "OPENAI_API_KEY",
  },
  deepseek: {
    name: "ديب سيك (DeepSeek)",
    defaultModel: "deepseek-chat",
    placeholder: "sk-...",
    envKeyName: "DEEPSEEK_API_KEY",
  },
  grok: {
    name: "إكس إيه آي (xAI Grok)",
    defaultModel: "grok-2-latest",
    placeholder: "xai-...",
    envKeyName: "XAI_API_KEY",
  },
  claude: {
    name: "أنثروبيك كلاود (Anthropic Claude)",
    defaultModel: "claude-3-5-haiku-20241022",
    placeholder: "sk-ant-...",
    envKeyName: "ANTHROPIC_API_KEY",
  },
  lovable: {
    name: "بوابة النظام المدمجة (Lovable AI)",
    defaultModel: "openai/gpt-4o-mini",
    placeholder: "مفتاح النظام الافتراضي",
    envKeyName: "LOVABLE_API_KEY",
  },
};

export const assistantSettingsSchema = z.object({
  enabled: z.boolean(),
  hideFloatingButton: z.boolean(),
  adminOnly: z.boolean(),
  activeProvider: z.enum(["gemini", "openai", "deepseek", "grok", "claude", "lovable"]),
  customModelName: z.string().optional().default(""),
  geminiModel: z.string().optional().default("gemini-2.5-flash"),
  geminiAutoFallback: z.boolean().optional().default(true),
  providerKeys: z
    .object({
      gemini: z.string().optional().default(""),
      openai: z.string().optional().default(""),
      deepseek: z.string().optional().default(""),
      grok: z.string().optional().default(""),
      claude: z.string().optional().default(""),
    })
    .default({ gemini: "", openai: "", deepseek: "", grok: "", claude: "" }),
  assistantName: z.string().default("مستشارة الجمال الذكية"),
  welcomeMessage: z
    .string()
    .default(
      "أهلاً بكِ في إيهاب ستور! 🌸 أنا مستشارتكِ الذكية، اخبريني بنوع بشرتكِ أو المشكلة التي تواجهينها وسأقترح لكِ أفضل المنتجات والروتين المناسب.",
    ),
  systemPrompt: z.string().optional().default(""),
});

export type AssistantSettings = z.infer<typeof assistantSettingsSchema>;

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  enabled: true,
  hideFloatingButton: false,
  adminOnly: false,
  activeProvider: "gemini",
  customModelName: "",
  geminiModel: "gemini-2.5-flash",
  geminiAutoFallback: true,
  providerKeys: {
    gemini: "",
    openai: "",
    deepseek: "",
    grok: "",
    claude: "",
  },
  assistantName: "مستشارة الجمال الذكية",
  welcomeMessage:
    "أهلاً بكِ في إيهاب ستور! 🌸 أنا مستشارتكِ الذكية، اخبريني بنوع بشرتكِ أو المشكلة التي تواجهينها وسأقترح لكِ أفضل المنتجات والروتين المناسب.",
  systemPrompt: "",
};

const KEY = "store_ai_assistant_settings";
const GROUP = "store_features";
const MANAGER_ROLES = ["super_admin", "admin"] as const;

export const getAssistantSettingsServer = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_ASSISTANT_SETTINGS;
    }

    const parsed = assistantSettingsSchema.safeParse(JSON.parse(data.value));
    const result = parsed.success ? parsed.data : DEFAULT_ASSISTANT_SETTINGS;
    const { optionalCaller } = await import("@/lib/caller.server");
    const caller = await optionalCaller();
    if (caller?.isAdmin) return result;
    // الزائر لا يرى المفاتيح أو التعليمات الداخلية
    return {
      ...result,
      providerKeys: { gemini: "", openai: "", deepseek: "", grok: "", claude: "" },
      systemPrompt: "",
    };
  } catch {
    return DEFAULT_ASSISTANT_SETTINGS;
  }
});

export const saveAssistantSettingsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assistantSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    let canManage = false;
    for (const role of MANAGER_ROLES) {
      const { data: hasRole } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (hasRole) {
        canManage = true;
        break;
      }
    }

    if (!canManage) {
      throw new Error("غير مصرح لك بتعديل إعدادات مساعد الذكاء الاصطناعي");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jsonValue = JSON.stringify(data);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("site_settings")
      .select("id")
      .eq("key", KEY)
      .maybeSingle();

    if (readError) throw readError;

    const result = existing?.id
      ? await supabaseAdmin
          .from("site_settings")
          .update({
            value: jsonValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
      : await supabaseAdmin.from("site_settings").insert({
          key: KEY,
          value: jsonValue,
          group: GROUP,
          description: "إعدادات مساعد الذكاء الاصطناعي ونماذج المفاتيح والتعطيل",
        });

    if (result.error) throw result.error;
    return { ok: true, settings: data };
  });

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProductCatalogBrief = {
  id: string;
  name: string;
  slug?: string | undefined;
  price?: number | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  description?: string | undefined;
  image?: string | undefined;
};

const chatInputSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  products: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string().optional(),
        price: z.number().optional(),
        category: z.string().optional(),
        brand: z.string().optional(),
        description: z.string().optional(),
        image: z.string().optional(),
      }),
    )
    .optional(),
});

export const chatWithStoreAssistantServer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => chatInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { optionalCaller } = await import("@/lib/caller.server");
    const chatCaller = await optionalCaller();
    if (!chatCaller) throw new Error("يرجى تسجيل الدخول لاستخدام المساعد الذكي");
    // 1. Get stored settings
    let settings = DEFAULT_ASSISTANT_SETTINGS;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("site_settings")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();

      if (row?.value) {
        const parsed = assistantSettingsSchema.safeParse(JSON.parse(row.value));
        if (parsed.success) settings = parsed.data;
      }
    } catch {
      /* use default */
    }

    if (!settings.enabled) {
      throw new Error("المساعد الذكي معطل حالياً من قبل إدارة المتجر.");
    }

    const provider = settings.activeProvider;
    const providerKey = (settings.providerKeys as Record<string, string>)[provider]?.trim();
    const envKey = process.env[PROVIDER_INFO[provider].envKeyName] || "";
    const effectiveKey = providerKey || envKey;
    let model = settings.customModelName?.trim();
    if (!model) {
      if (provider === "gemini") {
        model = settings.geminiModel || "gemini-2.5-flash";
      } else {
        model = PROVIDER_INFO[provider].defaultModel;
      }
    }

    // Prepare products context
    const productsContext = (data.products ?? [])
      .slice(0, 50)
      .map(
        (p) =>
          `- [ID: ${p.id}] ${p.name} (${p.category || "منتج عام"}) السعر: ${p.price ?? "غير محدد"}. ${p.description ? p.description.slice(0, 80) : ""}`,
      )
      .join("\n");

    const systemPrompt = [
      `أنتِ ${settings.assistantName}، خبيرة تجميل وعناية ومساعدة ذكية في متجر «إيهاب ستور» لمستحضرات التجميل والعناية بالبشرة والمكياج والعدسات والعطور.`,
      `أسلوبك: ودود، لبق، راقٍ ومطمئن، تتحدثين بالعربية بأسلوب احترافي مبسط ومباشر.`,
      `مهمتكِ الأساسية:`,
      `1. الاستماع لمشكلة العميلة أو استفسارها (مثال: جفاف البشرة، حب الشباب، التصبغات، روتين صباحي، اختيار كريم أساس أو لون أحمر شفاه أو عدسات).`,
      `2. تقديم شرح مختصر ومفيد لأسباب المشكلة وكيفية العناية بها وخطوات الروتين السليم.`,
      `3. اقتراح المنتجات المناسبة تماماً من كتالوج المتجر المتوفر أدناه.`,
      `4. عندما تقترحين منتجاً موجوداً في الكتالوج، اذكري اسمه واكتبي في نهاية إجابتك سطراً مخصصاً بصيغة [RECOMMENDED_IDS: id1, id2] مع وضع معرفات المنتجات المقترحة فقط، لكي تظهر كبطاقات تفاعلية للعميلة مباشرة.`,
      `كتالوج المنتجات المتوفرة حالياً بالمتجر:`,
      productsContext || "لا توجد قائمة مفصلة حالياً، قدمي نصائح عامة واسألي عن رغبة العميل.",
      settings.systemPrompt ? `تعليمات إضافية من الإدارة:\n${settings.systemPrompt}` : "",
    ].join("\n\n");

    try {
      const callRes = await executeAiCall({
        provider,
        apiKey: effectiveKey,
        model,
        geminiAutoFallback: settings.geminiAutoFallback ?? true,
        systemPrompt,
        // لا نثق بأدوار الرسائل القادمة من المتصفح: نرسل رسائل العميل فقط وبطول محدود.
        messages: data.messages
          .filter((m) => m.role === "user")
          .slice(-10)
          .map((m) => ({ role: "user" as const, content: m.content.slice(0, 2000) })),
      });

      const reply = callRes.text;

      // Parse recommended product IDs from reply
      const idMatch = reply.match(/\[RECOMMENDED_IDS:\s*([^\]]+)\]/i);
      let recommendedIds: string[] = [];
      let cleanedReply = reply;

      if (idMatch && idMatch[1]) {
        recommendedIds = idMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        cleanedReply = reply.replace(/\[RECOMMENDED_IDS:\s*[^\]]+\]/gi, "").trim();
      }

      // Also auto-detect mentioned products by name if no explicit IDs were returned
      if (recommendedIds.length === 0 && data.products) {
        for (const p of data.products.slice(0, 30)) {
          if (p.name && cleanedReply.includes(p.name)) {
            recommendedIds.push(p.id);
            if (recommendedIds.length >= 3) break;
          }
        }
      }

      return {
        reply: cleanedReply,
        recommendedProductIds: recommendedIds,
        providerUsed: provider,
        modelUsed: callRes.modelUsed,
        fallbackOccurred: callRes.fallbackOccurred,
      };
    } catch (err) {
      // Graceful fallback to rule-based beauty assistant if API call encounters quota or network issue
      const fallbackResult = generateFallbackBeautyAdvice(
        data.messages[data.messages.length - 1]?.content || "",
        data.products || [],
      );
      return {
        reply: fallbackResult.reply,
        recommendedProductIds: fallbackResult.recommendedIds,
        providerUsed: "fallback",
        modelUsed: "offline-matcher",
      };
    }
  });

const testInputSchema = z.object({
  provider: z.enum(["gemini", "openai", "deepseek", "grok", "claude", "lovable"]),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  geminiModel: z.string().optional(),
  geminiAutoFallback: z.boolean().optional(),
});

export const testAssistantConnectionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => testInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { provider, apiKey, model, geminiModel, geminiAutoFallback } = data;
    const envKey = process.env[PROVIDER_INFO[provider].envKeyName] || "";
    const effectiveKey = apiKey?.trim() || envKey;
    const effectiveModel =
      model?.trim() ||
      (provider === "gemini"
        ? geminiModel || "gemini-2.5-flash"
        : PROVIDER_INFO[provider].defaultModel);

    try {
      const callRes = await executeAiCall({
        provider,
        apiKey: effectiveKey,
        model: effectiveModel,
        geminiAutoFallback: geminiAutoFallback ?? true,
        systemPrompt: "أنت مساعد ذكي، أجب بكلمة واحدة فقط: «الاتصال ناجح»",
        messages: [{ role: "user", content: "مرحباً، اختبر الاتصال." }],
      });

      const fallbackNote =
        callRes.fallbackOccurred && callRes.modelUsed !== effectiveModel
          ? ` (تم التبديل التلقائي للنموذج البديل: ${callRes.modelUsed})`
          : "";

      return {
        ok: true,
        message: `نجح الاتصال بنموذج ${callRes.modelUsed} (${provider}) بنجاح!${fallbackNote}`,
        reply: callRes.text,
        modelUsed: callRes.modelUsed,
        fallbackOccurred: callRes.fallbackOccurred,
      };
    } catch (e: any) {
      return {
        ok: false,
        message: e?.message || `فشل الاتصال بـ ${provider}، تحقق من صحة المفتاح والنموذج.`,
      };
    }
  });

export type AiCallResult = {
  text: string;
  modelUsed: string;
  fallbackOccurred?: boolean;
};

async function callSingleGeminiModel({
  key,
  model,
  systemPrompt,
  messages,
}: {
  key: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
}): Promise<string> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`خطأ Gemini (${res.status}) للنموذج [${model}]: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`لم تتلقَ استجابة نصية من نموذج Gemini (${model})`);
  return text;
}

async function executeAiCall({
  provider,
  apiKey,
  model,
  geminiAutoFallback,
  systemPrompt,
  messages,
}: {
  provider: AiModelProvider;
  apiKey: string;
  model: string;
  geminiAutoFallback?: boolean;
  systemPrompt: string;
  messages: ChatMessage[];
}): Promise<AiCallResult> {
  // If provider is Lovable or no key is provided, try lovable gateway
  if (provider === "lovable" || (!apiKey && process.env["LOVABLE_API_KEY"])) {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    if (lovableKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: model || "openai/gpt-4o-mini",
          instructions: systemPrompt,
          input: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const text =
          json?.output?.find?.((item: any) => item.type === "message")?.content?.[0]?.text ??
          json?.output_text ??
          json?.choices?.[0]?.message?.content;
        if (text) return { text, modelUsed: model || "lovable-gateway" };
      }
    }
  }

  // 1. Google Gemini (Supports all Gemini models & automatic fallback)
  if (provider === "gemini") {
    const key = apiKey || process.env["GEMINI_API_KEY"];
    if (!key) throw new Error("مفتاح Google Gemini API غير متوفر، يرجى إدخاله في الإعدادات.");

    const primaryModel = model || "gemini-2.5-flash";
    const autoFallback = geminiAutoFallback ?? true;

    if (!autoFallback) {
      const text = await callSingleGeminiModel({
        key,
        model: primaryModel,
        systemPrompt,
        messages,
      });
      return { text, modelUsed: primaryModel, fallbackOccurred: false };
    }

    // Build fallback chain: primary model first, followed by remainder of GEMINI_FALLBACK_CHAIN
    const chain = [primaryModel, ...GEMINI_FALLBACK_CHAIN.filter((m) => m !== primaryModel)];
    let lastError: Error | null = null;

    for (const candidateModel of chain) {
      try {
        const text = await callSingleGeminiModel({
          key,
          model: candidateModel,
          systemPrompt,
          messages,
        });
        return {
          text,
          modelUsed: candidateModel,
          fallbackOccurred: candidateModel !== primaryModel,
        };
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || "");
        if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("403 Forbidden")) {
          throw new Error("مفتاح Gemini API غير صالح أو غير مصرح له.");
        }
      }
    }

    throw lastError || new Error("فشلت جميع محاولات نماذج Gemini");
  }

  // 2. OpenAI GPT
  if (provider === "openai") {
    if (!apiKey) throw new Error("مفتاح OpenAI API غير متوفر.");
    const chosenModel = model || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`خطأ OpenAI (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      text: data?.choices?.[0]?.message?.content || "",
      modelUsed: chosenModel,
    };
  }

  // 3. DeepSeek
  if (provider === "deepseek") {
    if (!apiKey) throw new Error("مفتاح DeepSeek API غير متوفر.");
    const chosenModel = model || "deepseek-chat";
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`خطأ DeepSeek (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      text: data?.choices?.[0]?.message?.content || "",
      modelUsed: chosenModel,
    };
  }

  // 4. xAI Grok
  if (provider === "grok") {
    if (!apiKey) throw new Error("مفتاح xAI Grok API غير متوفر.");
    const chosenModel = model || "grok-2-latest";
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`خطأ Grok (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      text: data?.choices?.[0]?.message?.content || "",
      modelUsed: chosenModel,
    };
  }

  // 5. Anthropic Claude
  if (provider === "claude") {
    if (!apiKey) throw new Error("مفتاح Anthropic Claude API غير متوفر.");
    const chosenModel = model || "claude-3-5-haiku-20241022";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: chosenModel,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`خطأ Claude (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      text: data?.content?.[0]?.text || "",
      modelUsed: chosenModel,
    };
  }

  throw new Error(`المزود ${provider} غير مدعوم أو ينقصه المفتاح.`);
}

function generateFallbackBeautyAdvice(
  userQuery: string,
  products: ProductCatalogBrief[],
): { reply: string; recommendedIds: string[] } {
  const query = userQuery.toLowerCase();
  let advice = "";
  let matches: ProductCatalogBrief[] = [];

  if (query.includes("جاف") || query.includes("تقشير") || query.includes("ترطيب")) {
    advice =
      "بالنسبة للبشرة الجافة، السر يكمن في الحفاظ على الحاجز الواقي للبشرة: استخدمي غسولاً كريمياً لطيفاً خالياً من الكبريتات، مع سيروم حمض الهيالورونيك على بشرة رطبة، ثم كريم مرطب غني بالسيراميد لحبس الرطوبة. إليكِ أفضل المنتجات المرطبة المتوفرة لدينا:";
    matches = products.filter(
      (p) =>
        p.name.includes("مرطب") ||
        p.name.includes("ترطيب") ||
        p.name.includes("سيروم") ||
        p.name.includes("كريم"),
    );
  } else if (query.includes("حب") || query.includes("مسام") || query.includes("دهني")) {
    advice =
      "للبشرة الدهنية والمعرضة للحبوب، ننصح بالتركيز على مكونات مثل النياسيناميد وحمض الساليسيليك لتنظيم الإفرازات وتنقية المسام دون تجفيف مفرط للبشرة. إليكِ منتجات مختارة تناسب حالتكِ تماماً:";
    matches = products.filter(
      (p) =>
        p.name.includes("غسول") ||
        p.name.includes("تونر") ||
        p.name.includes("سيروم") ||
        p.name.includes("تنقية"),
    );
  } else if (query.includes("تفتيح") || query.includes("تصبغ") || query.includes("هالات")) {
    advice =
      "لعلاج التصبغات وتوحيد لون البشرة، سيروم فيتامين C صباحاً مع واقي الشمس هو الخطوة الذهبية، بالإضافة إلى مقشرات لطيفة أو مرطبات مغذية مساءً. إليكِ خيارات ممتازة من متجرنا:";
    matches = products.filter(
      (p) =>
        p.name.includes("تفتيح") ||
        p.name.includes("فيتامين") ||
        p.name.includes("واقي") ||
        p.name.includes("سيروم"),
    );
  } else if (query.includes("مكياج") || query.includes("روج") || query.includes("شفاه")) {
    advice =
      "لإطلالة مكياج مميزة وثابتة، ننصح بالبدء ببرايمر مرطب يثبت الأساس، ثم اختيار درجات أحمر شفاه متناسقة مع لون بشرتكِ. تفضلي هذه التشكيلة الفاخرة من المكياج:";
    matches = products.filter(
      (p) =>
        p.name.includes("أحمر") ||
        p.name.includes("روج") ||
        p.name.includes("شفاه") ||
        p.name.includes("مكياج") ||
        p.category?.includes("مكياج"),
    );
  } else if (query.includes("عدسات") || query.includes("عين")) {
    advice =
      "العدسات الملونة تضفي سحراً فورياً وتكمل إطلالة المكياج اليومية أو المسائية. إليكِ أرقى العدسات المتوفرة لدينا بألوان طبيعية وراحة فائقة:";
    matches = products.filter(
      (p) => p.name.includes("عدسات") || p.name.includes("عدسة") || p.category?.includes("عدسات"),
    );
  } else {
    advice =
      "يسعدني جداً مساعدتكِ! تفضلي بشرح المشكلة بالتحديد (مثل نوع بشرتكِ أو النتيجة التي تتمنين الوصول إليها) وسأقوم فوراً بتركيب أفضل روتين واقتراح المنتجات المتطابقة من متجرنا:";
    matches = products.slice(0, 3);
  }

  if (matches.length === 0) {
    matches = products.slice(0, 3);
  }

  const recommendedIds = matches.slice(0, 3).map((m) => m.id);
  return { reply: advice, recommendedIds };
}
