import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bot,
  Sparkles,
  X,
  Send,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  Loader2,
  Check,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency";
import { useProducts, type Product } from "@/lib/store";
import { useAdmin } from "@/hooks/useAdmin";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { useAssistantSettings, useAssistantChat } from "@/lib/assistant-settings";
import { PROVIDER_INFO } from "@/lib/assistant-settings.functions";

const QUICK_PROMPTS = [
  { icon: "💧", text: "بشرتي جافة ومتقشرة، ما أفضل روتين ترطيب؟" },
  { icon: "🌿", text: "أعاني من حب الشباب والمسامات الواسعة" },
  { icon: "✨", text: "أريد سيروم لتفتيح وتوحيد لون البشرة" },
  { icon: "💄", text: "مكياج ناعم وروج ثابت للإطلالة اليومية" },
  { icon: "👁️", text: "عدسات ملونة تناسب المكياج والمناسبات" },
];

export function StoreAssistantWidget() {
  const { data: settings } = useAssistantSettings();
  const { isAdmin } = useAdmin();
  const { data: products = [] } = useProducts();
  const { add } = useCart();
  const { format } = useCurrency();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Transform products for brief context
  const productsBrief = useMemo(() => {
    return products.slice(0, 50).map((p) => {
      const b: {
        id: string;
        name: string;
        slug?: string;
        price?: number;
        description?: string;
        image?: string;
      } = { id: p.id, name: p.name };
      if (p.slug) b.slug = p.slug;
      if (p.price != null) b.price = Number(p.price);
      if (p.description) b.description = p.description;
      if (p.images?.[0]) b.image = p.images[0];
      return b;
    });
  }, [products]);

  // Product lookup map for recommended cards
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
      if (p.slug) map.set(p.slug, p);
    }
    return map;
  }, [products]);

  const { messages, sendMessage, resetChat, loading } = useAssistantChat(productsBrief);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const providerBadge = useMemo(() => {
    const prov = settings?.activeProvider || "gemini";
    if (prov === "gemini") {
      const model = (settings?.customModelName || settings?.geminiModel || "2.5-flash").replace(
        "gemini-",
        "",
      );
      return `جيميني ${model}`;
    }
    const name = PROVIDER_INFO[prov]?.name?.split(" ")[0] || "AI";
    if (settings?.customModelName) {
      return `${name} (${settings.customModelName})`;
    }
    return name;
  }, [settings]);

  // Visibility logic
  if (!settings?.enabled) {
    return null;
  }
  if (settings.hideFloatingButton && !isAdmin) {
    return null;
  }
  if (settings.adminOnly && !isAdmin) {
    return null;
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || loading) return;
    const text = inputText;
    setInputText("");
    await sendMessage(text);
  };

  const handleQuickPrompt = (prompt: string) => {
    void sendMessage(prompt);
  };

  const handleAddToCart = (product: Product) => {
    add(
      {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        image: product.images?.[0] ?? "",
        slug: product.slug,
      } as never,
      1,
    );
    toast.success(`تمت إضافة «${product.name}» إلى سلتك`);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <aside
          aria-label="مساعد التجميل الذكي"
          className="fixed bottom-24 end-4 z-50 flex items-center gap-2 md:bottom-6 md:end-6"
        >
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="افتح مساعد الذكاء الاصطناعي للمتجر"
            className="group relative flex h-14 items-center gap-2.5 rounded-full gradient-gold px-4 text-primary-foreground shadow-lift ring-2 ring-primary/25 transition-all duration-300 hover:scale-105 active:scale-95 sm:px-5"
          >
            {/* Sparkle badge glow */}
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
              <Bot className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
              <span className="absolute -top-1 -end-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-primary-foreground" />
              </span>
            </span>

            <div className="flex flex-col text-start">
              <span className="text-xs font-black tracking-wide sm:text-sm">
                {settings?.assistantName || "مساعد المتجر الذكي"}
              </span>
              <span className="text-[10px] text-primary-foreground/80">
                اشرحي مشكلتك واختاري منتجك ✨
              </span>
            </div>
          </button>
        </aside>
      )}

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="محادثة مساعد المتجر الذكي"
          className="fixed bottom-4 end-4 z-50 flex h-[90vh] max-h-[640px] w-[calc(100vw-2rem)] sm:w-[420px] flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl transition-all duration-300 md:bottom-6 md:end-6"
        >
          {/* Header */}
          <header className="relative flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 via-secondary/40 to-transparent px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-gold text-primary-foreground shadow-xs">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-xs font-black text-foreground sm:text-sm">
                    {settings?.assistantName || "مستشارة الجمال الذكية"}
                  </h3>
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary border border-primary/20">
                    {providerBadge}
                  </span>
                </div>
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  متصلة لمساعدتكِ في اختيار المنتجات
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetChat}
                title="بدء محادثة جديدة"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((m) => {
              const isUser = m.role === "user";

              // Find matched products if assistant returned recommendations
              const matchedProducts: Product[] = [];
              if (!isUser && m.recommendedProductIds && m.recommendedProductIds.length > 0) {
                for (const id of m.recommendedProductIds) {
                  const found = productsMap.get(id);
                  if (found) matchedProducts.push(found);
                }
              }

              return (
                <div key={m.id} className={`flex flex-col ${isUser ? "items-start" : "items-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed ${
                      isUser
                        ? "bg-primary text-primary-foreground font-medium rounded-br-xs"
                        : "bg-secondary/70 text-foreground border border-border/60 rounded-bl-xs shadow-2xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>

                  {/* Recommended Products Carousel / List */}
                  {matchedProducts.length > 0 && (
                    <div className="mt-2.5 w-full space-y-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>المنتجات المقترحة لحالتكِ:</span>
                      </p>

                      <div className="grid gap-2">
                        {matchedProducts.slice(0, 3).map((p) => {
                          const img = p.images?.[0] || fallbackFor(undefined);
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-2xs transition-colors hover:border-primary/40"
                            >
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
                                <SmartImage
                                  src={img}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <Link
                                  to="/product/$slug"
                                  params={{ slug: p.slug }}
                                  onClick={() => setIsOpen(false)}
                                  className="block truncate text-xs font-bold text-foreground hover:text-primary"
                                >
                                  {p.name}
                                </Link>
                                <div className="mt-0.5 flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-black text-primary">
                                    {format(p.price)}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddToCart(p)}
                                title="أضف إلى السلة"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                              >
                                <ShoppingBag className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground bg-secondary/50 p-3 rounded-2xl w-fit">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs">جاري فحص الكتالوج واختيار المنتج الأنسب...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          {messages.length <= 2 && !loading && (
            <div className="border-t border-border/50 bg-secondary/20 p-2.5">
              <p className="mb-1.5 text-[10px] font-bold text-muted-foreground">
                اسألي عن مشكلة معينة:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.text}
                    type="button"
                    onClick={() => handleQuickPrompt(q.text)}
                    className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-foreground transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary active:scale-95"
                  >
                    <span>{q.icon}</span>
                    <span className="truncate max-w-[170px]">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t border-border bg-card p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="اكتبي مشكلتكِ أو استفساركِ هنا..."
              disabled={loading}
              className="flex-1 rounded-2xl border border-border bg-secondary/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-hidden disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              aria-label="إرسال"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl gradient-gold text-primary-foreground shadow-xs transition-transform hover:opacity-95 active:scale-95 disabled:opacity-40"
            >
              <Send className="h-4 w-4 -rotate-90" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
