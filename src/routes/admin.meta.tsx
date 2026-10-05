import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  HelpCircle,
  Instagram,
  Key,
  Layers,
  Lock,
  Megaphone,
  Package,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { getMetaConfig, saveMetaConfig, DEFAULT_META_CONFIG } from "@/lib/meta/storage";
import {
  getMetaAuthUrl,
  syncMetaAssetsNow,
  selectMetaPageAction,
  selectMetaAdAccountAction,
  disconnectMetaAction,
  saveMetaAppKeys,
  runMetaDiagnostics,
  sendMetaCapiEvent,
  syncMetaPageProfile,
} from "@/lib/meta/meta.functions";
import {
  getRecentMetaEvents,
  clearRecentMetaEvents,
  generateEventId,
  type MetaLoggedEvent,
} from "@/lib/meta/pixel";
import type {
  MetaConfig,
  MetaFacebookPage,
  MetaAdAccount,
  MetaPermissionItem,
} from "@/lib/meta/types";

export const Route = createFileRoute("/admin/meta")({
  head: () => ({
    meta: [
      { title: "مركز تكامل وإدارة إعلانات Meta | لوحة التحكم" },
      { name: "description", content: "إعداد ربط متجر إيهاب بصفحات ميتا والإعلانات والتتبع." },
      { property: "og:title", content: "مركز تكامل ميتا | إيهاب ستور" },
      {
        property: "og:description",
        content: "إعداد ربط متجر إيهاب بصفحات ميتا والإعلانات والتتبع.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MetaIntegrationCenterPage,
});

type ActiveTab =
  "overview" | "pages" | "ads" | "business" | "permissions" | "tracking" | "app_settings";

type TestEventType = "Purchase" | "AddToCart" | "ViewContent" | "InitiateCheckout";

export function MetaIntegrationCenterPage() {
  const qc = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");

  // Local state
  const [pageSearch, setPageSearch] = useState("");
  const [adAccountSearch, setAdAccountSearch] = useState("");
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [oauthStep, setOauthStep] = useState(0);
  const [syncingAssets, setSyncingAssets] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // App credentials form
  const [appIdInput, setAppIdInput] = useState("");
  const [appSecretInput, setAppSecretInput] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);

  // Pixel & CAPI test state
  const [testingCapi, setTestingCapi] = useState(false);
  const [testEventType, setTestEventType] = useState<TestEventType>("Purchase");
  const [testAmount, setTestAmount] = useState<number>(150);
  const [testCurrency, setTestCurrency] = useState<string>("SAR");
  const [recentEvents, setRecentEvents] = useState<MetaLoggedEvent[]>([]);
  const [selectedEventPayload, setSelectedEventPayload] = useState<MetaLoggedEvent | null>(null);

  // Diagnostics state
  const [runningDiag, setRunningDiag] = useState(false);
  const [diagResult, setDiagResult] = useState<any | null>(null);

  // Sync page to store state
  const [syncingPageProfile, setSyncingPageProfile] = useState(false);

  // Fetch full Meta configuration
  const { data: config = DEFAULT_META_CONFIG, isLoading } = useQuery({
    queryKey: ["meta-settings"],
    queryFn: getMetaConfig,
  });

  const [form, setForm] = useState<MetaConfig>(DEFAULT_META_CONFIG);

  useEffect(() => {
    if (config) {
      setForm(config);
      if (config.app_id) {
        setAppIdInput(config.app_id);
      }
    }
  }, [config]);

  // Load recent events & listen for new ones
  useEffect(() => {
    setRecentEvents(getRecentMetaEvents());
    const onEventLogged = () => {
      setRecentEvents(getRecentMetaEvents());
    };
    window.addEventListener("meta-event-logged", onEventLogged);
    return () => window.removeEventListener("meta-event-logged", onEventLogged);
  }, []);

  // Handle postMessage from OAuth popup
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "META_AUTH_SUCCESS") {
        setConnectingOAuth(false);
        setOauthStep(2);
        toast.success(event.data.message || "تم الاتصال بحساب Meta بنجاح!");
        void qc.invalidateQueries({ queryKey: ["meta-settings"] }).then(() => setOauthStep(3));
      } else if (event.data.type === "META_AUTH_ERROR") {
        setConnectingOAuth(false);
        setOauthStep(0);
        toast.error(`خطأ أثناء الاتصال: ${event.data.message || "يرجى التحقق من الصلاحيات"}`);
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, [qc]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (updated: MetaConfig) => {
      await saveMetaConfig(updated);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta-settings"] });
      toast.success("تم حفظ إعدادات Meta بنجاح");
    },
    onError: (err: any) => {
      toast.error(`حدث خطأ أثناء الحفظ: ${err?.message || "يرجى المحاولة مجدداً"}`);
    },
  });

  // 1. Official Meta OAuth Popup Flow
  const handleStartOAuth = async () => {
    setConnectingOAuth(true);
    try {
      const origin = window.location.origin;
      const res = await getMetaAuthUrl({ data: { origin } });
      if (!res?.url) {
        throw new Error("تعذر إنشاء رابط التفويض من الخادم");
      }

      // تحويل مباشر في نفس الصفحة ثم العودة تلقائياً إلى /admin/meta
      setOauthStep(1);
      window.location.href = res.url;
    } catch (err: any) {
      toast.error(err?.message || "فشل بدء جلسة تسجيل الدخول مع Meta");
      setConnectingOAuth(false);
    }
  };

  // 2. Synchronize Assets Now
  const handleSyncAssets = async () => {
    setSyncingAssets(true);
    try {
      const res = await syncMetaAssetsNow();
      if (res.ok) {
        toast.success(res.message || "تمت مزامنة الصفحات والحسابات الإعلانية بنجاح");
        void qc.invalidateQueries({ queryKey: ["meta-settings"] });
      } else {
        toast.warning(res.message || "اكتملت المزامنة مع بعض التحذيرات");
        void qc.invalidateQueries({ queryKey: ["meta-settings"] });
      }
    } catch (err: any) {
      toast.error(err?.message || "فشلت المزامنة مع Meta");
    } finally {
      setSyncingAssets(false);
    }
  };

  // 3. Disconnect Meta Account
  const handleDisconnect = async () => {
    if (
      !confirm(
        "هل أنت متأكد من رغبتك في فصل حساب Meta؟ سيتم إيقاف المزامنة وإلغاء الربط مع الصفحات والحسابات الإعلانية.",
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      await disconnectMetaAction();
      toast.success("تم فصل حساب Meta بنجاح");
      void qc.invalidateQueries({ queryKey: ["meta-settings"] });
    } catch (err: any) {
      toast.error(err?.message || "تعذر فصل الحساب");
    } finally {
      setDisconnecting(false);
    }
  };

  // 4. Select Primary Page
  const handleSelectPage = async (pageId: string) => {
    try {
      await selectMetaPageAction({ data: { pageId } });
      toast.success("تم اختيار الصفحة كصفحة رئيسية للمتجر");
      void qc.invalidateQueries({ queryKey: ["meta-settings"] });
    } catch (err: any) {
      toast.error(err?.message || "تعذر اختيار الصفحة");
    }
  };

  // 5. Select Primary Ad Account
  const handleSelectAdAccount = async (adAccountId: string) => {
    try {
      await selectMetaAdAccountAction({ data: { adAccountId } });
      toast.success("تم اختيار الحساب الإعلاني للمتجر");
      void qc.invalidateQueries({ queryKey: ["meta-settings"] });
    } catch (err: any) {
      toast.error(err?.message || "تعذر اختيار الحساب الإعلاني");
    }
  };

  // 6. Save Meta App Keys (App ID & Secret)
  const handleSaveAppKeys = async () => {
    if (!appIdInput.trim()) {
      toast.error("يرجى إدخال معرّف تطبيق Meta (App ID)");
      return;
    }
    setSavingKeys(true);
    try {
      await saveMetaAppKeys({
        data: {
          appId: appIdInput.trim(),
          appSecret: appSecretInput.trim() || null,
        },
      });
      toast.success("تم حفظ معرّف ورمز تطبيق Meta بنجاح على الخادم");
      setAppSecretInput("");
      void qc.invalidateQueries({ queryKey: ["meta-settings"] });
    } catch (err: any) {
      toast.error(err?.message || "تعذر حفظ بيانات اعتماد التطبيق");
    } finally {
      setSavingKeys(false);
    }
  };

  // 7. Run Comprehensive Diagnostics
  const handleRunDiagnostics = async () => {
    setRunningDiag(true);
    try {
      const res = await runMetaDiagnostics();
      setDiagResult(res);
      if (res.issues.length === 0) {
        toast.success("كافة إعدادات وتكامل Meta سليمة وجاهزة!");
      } else {
        toast.warning(`تم اكتشاف ${res.issues.length} ملاحظات تحتاج إلى انتباه.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "فشل تشغيل الفحص التشخيصي");
    } finally {
      setRunningDiag(false);
    }
  };

  // 8. Test Live Conversions API Event
  const handleSendTestEvent = async () => {
    if (!form.pixel_id) {
      toast.error("يرجى إدخال معرّف البيكسل (Pixel ID) أولاً");
      return;
    }
    setTestingCapi(true);
    try {
      const eventId = generateEventId();
      const res = await sendMetaCapiEvent({
        data: {
          event_name: testEventType,
          event_id: eventId,
          event_source_url: window.location.href,
          user_agent: navigator.userAgent,
          custom_data: {
            currency: testCurrency,
            value: Number(testAmount),
            content_name: "طلب تجريبي لاختبار Conversions API",
            content_type: "product",
          },
        },
      });
      if (res.ok) {
        toast.success(res.message || "تم إرسال الحدث إلى Meta CAPI بنجاح");
        void qc.invalidateQueries({ queryKey: ["meta-settings"] });
      } else {
        toast.error(res.message || "فشل إرسال الحدث التجريبي");
      }
    } catch (err: any) {
      toast.error(err?.message || "تعذر إرسال الحدث إلى Meta");
    } finally {
      setTestingCapi(false);
    }
  };

  // 9. Sync Store info to Facebook Page
  const handleSyncPageProfile = async () => {
    setSyncingPageProfile(true);
    try {
      const res = await syncMetaPageProfile({
        data: { origin: window.location.origin },
      });
      if (res.ok) {
        toast.success(res.message || "تم تحديث صفحة فيسبوك ببيانات المتجر");
        void qc.invalidateQueries({ queryKey: ["meta-settings"] });
      } else {
        toast.error(res.message || "تعذر تحديث الصفحة");
      }
    } catch (err: any) {
      toast.error(err?.message || "فشل تحديث الصفحة");
    } finally {
      setSyncingPageProfile(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("تم النسخ إلى الحافظة");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtered pages & ad accounts
  const filteredPages = useMemo(() => {
    const list = form.discovered_pages || [];
    if (!pageSearch.trim()) return list;
    const q = pageSearch.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)),
    );
  }, [form.discovered_pages, pageSearch]);

  const filteredAdAccounts = useMemo(() => {
    const list = form.discovered_ad_accounts || [];
    if (!adAccountSearch.trim()) return list;
    const q = adAccountSearch.toLowerCase();
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.account_id.includes(q),
    );
  }, [form.discovered_ad_accounts, adAccountSearch]);

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/meta/callback`
      : "https://your-domain.com/api/auth/meta/callback";

  const fallbackCallbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/meta/callback`
      : "https://your-domain.com/auth/meta/callback";

  // Selected primary assets
  const selectedPage = (form.discovered_pages || []).find((p) => p.id === form.page_id);
  const selectedAdAccount = (form.discovered_ad_accounts || []).find(
    (a) => a.id === form.ad_account_id,
  );

  return (
    <div className="min-h-screen bg-[#FCF5F5] text-slate-800 p-4 md:p-8 admin-meta-page" dir="rtl">
      {/* Custom styles to dynamically transform all panels and elements to the blush pink theme */}
      <style>{`
        .admin-meta-page {
          background-color: #FCF5F5 !important;
          color: #334155 !important;
        }
        .admin-meta-page .bg-slate-950 {
          background-color: #FCF5F5 !important;
        }
        .admin-meta-page .bg-slate-900\\/80, 
        .admin-meta-page .bg-slate-900, 
        .admin-meta-page .bg-slate-900\\/60,
        .admin-meta-page .bg-slate-900\\/30,
        .admin-meta-page .bg-gradient-to-br {
          background: #ffffff !important;
          background-image: none !important;
          border-color: #F0D5D8 !important;
          color: #334155 !important;
        }
        .admin-meta-page .bg-[#0B0C0E],
        .admin-meta-page .bg-[#111215] {
          background: #FFF9FA !important;
          border-color: #E9D2D6 !important;
        }
        .admin-meta-page .border-slate-800, 
        .admin-meta-page .border-slate-800\\/80, 
        .admin-meta-page .border-slate-700,
        .admin-meta-page .border-indigo-500\\/20,
        .admin-meta-page .border-indigo-500\\/30,
        .admin-meta-page .border-blue-500\\/20 {
          border-color: #F0D5D8 !important;
        }
        /* Overwrite typography */
        .admin-meta-page .text-white, 
        .admin-meta-page h1, 
        .admin-meta-page h2, 
        .admin-meta-page h3, 
        .admin-meta-page h4, 
        .admin-meta-page .font-bold,
        .admin-meta-page .font-semibold {
          color: #823341 !important;
        }
        .admin-meta-page .text-slate-100 {
          color: #334155 !important;
        }
        .admin-meta-page .text-slate-400, 
        .admin-meta-page .text-slate-300 {
          color: #64748B !important;
        }
        /* Overwrite buttons and interactive elements */
        .admin-meta-page .bg-slate-800 {
          background-color: #FCECEF !important;
          color: #B34D5F !important;
          border-color: #F0D5D8 !important;
        }
        .admin-meta-page .bg-slate-800:hover {
          background-color: #F9DFE3 !important;
        }
        .admin-meta-page input, 
        .admin-meta-page select, 
        .admin-meta-page textarea {
          background-color: #FFF9FA !important;
          border-color: #E9D2D6 !important;
          color: #1e293b !important;
        }
        .admin-meta-page input::placeholder {
          color: #94a3b8 !important;
        }
        /* Buttons and Active States with pink gradient */
        .admin-meta-page .bg-gradient-to-r,
        .admin-meta-page .bg-indigo-600 {
          background-image: linear-gradient(to right, #D48995, #B34D5F) !important;
          color: #ffffff !important;
        }
        .admin-meta-page .bg-gradient-to-r *,
        .admin-meta-page .bg-indigo-600 * {
          color: #ffffff !important;
        }
        .admin-meta-page .text-indigo-400, 
        .admin-meta-page .text-indigo-300,
        .admin-meta-page .text-blue-400 {
          color: #B34D5F !important;
        }
        .admin-meta-page .text-amber-400 {
          color: #823341 !important;
        }
        .admin-meta-page .text-emerald-400 {
          color: #059669 !important;
        }
        /* Navigation Tabs specific overrides */
        .admin-meta-page .overflow-x-auto {
          background-color: #FCECEF !important;
          border-color: #F0D5D8 !important;
          border-radius: 16px !important;
        }
        .admin-meta-page .active-tab-btn {
          background-image: linear-gradient(to right, #D48995, #B34D5F) !important;
          color: #ffffff !important;
        }
      `}</style>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-[28px] border border-[#F0D5D8] shadow-[0_8px_30px_rgba(179,77,95,0.03)]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-4 ring-slate-800">
              <Facebook className="w-7 h-7 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  مركز تكامل وإدارة إعلانات Meta
                </h1>
                {/* Status Badge */}
                {form.connected && form.status === "connected" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    متصل بـ Meta
                  </span>
                )}
                {form.connected && form.status === "insufficient_permissions" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    صلاحيات ناقصة
                  </span>
                )}
                {form.connected && form.status === "needs_reauth" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    يحتاج إعادة تفويض
                  </span>
                )}
                {!form.connected && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    غير متصل
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                الربط الرسمي المباشر مع Facebook Graph API v22.0 لإدارة الصفحات، إنستغرام، محافظ
                الأعمال، إعلانات Meta وتتبع CAPI.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/meta-guide"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              دليل ربط ميتا
            </Link>
            {form.connected ? (
              <>
                <button
                  type="button"
                  onClick={handleSyncAssets}
                  disabled={syncingAssets}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 transition disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${syncingAssets ? "animate-spin text-blue-400" : ""}`}
                  />
                  {syncingAssets ? "جاري المزامنة..." : "مزامنة الآن"}
                </button>
                <button
                  type="button"
                  onClick={handleStartOAuth}
                  disabled={connectingOAuth}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition disabled:opacity-50"
                >
                  <Key className="w-4 h-4 text-indigo-400" />
                  إعادة التفويض
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  فصل الحساب
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartOAuth}
                disabled={connectingOAuth}
                className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/25 transition disabled:opacity-50 cursor-pointer"
              >
                <Facebook className="w-4 h-4 fill-white" />
                {connectingOAuth
                  ? "جاري فتح نافذة Meta..."
                  : "تسجيل الدخول باستخدام Meta / Facebook"}
              </button>
            )}
            <div className="w-full flex items-center gap-2 text-xs" aria-label="خطوات الربط">
              {["جاهز", "فتح النافذة", "جلب الصفحات", "حفظ"].map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold border ${
                      i <= oauthStep
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-500"
                    } ${i === oauthStep && connectingOAuth ? "animate-pulse" : ""}`}
                  >
                    {i + 1}
                  </span>
                  <span className={i <= oauthStep ? "text-slate-200" : "text-slate-500"}>{label}</span>
                  {i < 3 && <span className="w-6 h-px bg-slate-700" />}
                </div>
              ))}
            </div>
            <Link
              to="/admin/ads"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <Megaphone className="w-4 h-4 text-amber-400" />
              مدير الحملات
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 p-1.5 bg-slate-900/60 rounded-xl border border-slate-800/80 scrollbar-none">
          {[
            { id: "overview", label: "نظرة عامة والاتصال", icon: Activity },
            {
              id: "pages",
              label: `الصفحات و Instagram (${form.discovered_pages?.length || 0})`,
              icon: Facebook,
            },
            {
              id: "ads",
              label: `الحسابات الإعلانية (${form.discovered_ad_accounts?.length || 0})`,
              icon: Megaphone,
            },
            {
              id: "business",
              label: `محافظ الأعمال (${form.discovered_businesses?.length || 0})`,
              icon: Layers,
            },
            {
              id: "permissions",
              label: `الصلاحيات والوصول (${form.permissions?.length || 0})`,
              icon: ShieldCheck,
            },
            { id: "tracking", label: "تتبع Pixel & CAPI", icon: Zap },
            { id: "app_settings", label: "إعدادات التطبيق والدليل", icon: Key },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ===================== TAB 1: OVERVIEW & CONNECTION ===================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* If Connected: Connected User Profile Hero Card */}
            {form.connected && form.user ? (
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-6 md:p-8 rounded-2xl border border-indigo-500/20 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5">
                    {form.user.picture_url ? (
                      <img
                        src={form.user.picture_url}
                        alt={form.user.name}
                        className="w-20 h-20 rounded-2xl object-cover ring-4 ring-indigo-500/30 shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-2xl ring-4 ring-indigo-500/30">
                        {form.user.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-2xl font-bold text-white">{form.user.name}</h2>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5" />
                          حساب موثق
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 flex items-center gap-4">
                        <span>معرّف الحساب: {form.user.id}</span>
                        {form.user.email && <span>• {form.user.email}</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        آخر مزامنة:{" "}
                        {form.last_sync_at
                          ? new Date(form.last_sync_at).toLocaleString("ar-SA")
                          : "الآن"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSyncAssets}
                      disabled={syncingAssets}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingAssets ? "animate-spin" : ""}`} />
                      تحديث البيانات
                    </button>
                    <button
                      type="button"
                      onClick={handleStartOAuth}
                      disabled={connectingOAuth}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
                    >
                      <Key className="w-4 h-4" />
                      إعادة التفويض
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* If Disconnected: Prominent Login Hero Card */
              <div className="bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 p-8 md:p-12 rounded-2xl border border-blue-500/20 shadow-2xl text-center space-y-6 relative overflow-hidden">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-2xl shadow-indigo-500/30 ring-8 ring-slate-800/80">
                  <Facebook className="w-10 h-10 text-white fill-white" />
                </div>
                <div className="max-w-2xl mx-auto space-y-2">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    ربط حساب Meta / Facebook بالمتجر
                  </h2>
                  <p className="text-base text-slate-300">
                    سجّل الدخول بحسابك على Meta لتمكين المتجر من اكتشاف واستدعاء كافة صفحات
                    Facebook، حسابات Instagram للأعمال، الحسابات الإعلانية وتتبع أحداث الشراء عبر
                    Conversions API.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    disabled={connectingOAuth}
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-base font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Facebook className="w-5 h-5 fill-white" />
                    {connectingOAuth
                      ? "جاري فتح نافذة تسجيل دخول Meta..."
                      : "تسجيل الدخول باستخدام Facebook / Meta"}
                  </button>
                  <p className="text-xs text-slate-400 mt-3">
                    تدفق OAuth 2.0 رسمي عبر Graph API v22.0. لن يتم تخزين كلمات المرور.
                  </p>
                </div>

                {/* Highlights Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 text-right">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                      <Facebook className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">صفحات Facebook</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      اكتشاف الصفحات التي تديرها وتحديث معلومات المتجر وروابط الأقسام عليها
                      تلقائياً.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center font-bold">
                      <Instagram className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">حسابات Instagram</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      التعرف التلقائي على حساب إنستغرام الاحترافي المرتبط بصفحتك وعرض المتابعين.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">حسابات Meta Ads</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      استدعاء الحسابات الإعلانية، العملة، رصيد الإنفاق، وإدارة الحملات من داخل
                      المتجر.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                      <Zap className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">Pixel & Conversions API</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      تتبع عمليات الشراء والإضافة للسلة بدقة عالية وحماية من قيود حظر الإعلانات.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Status Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Selected Page Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    الصفحة الرئيسية
                  </span>
                  <Facebook className="w-4 h-4 text-blue-400" />
                </div>
                {selectedPage ? (
                  <div className="flex items-center gap-3">
                    {selectedPage.picture_url ? (
                      <img
                        src={selectedPage.picture_url}
                        alt={selectedPage.name}
                        className="w-11 h-11 rounded-xl object-cover ring-2 ring-blue-500/30"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                        {selectedPage.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-white text-sm truncate">{selectedPage.name}</h4>
                      <p className="text-xs text-slate-400 truncate">
                        {selectedPage.followers_count
                          ? `${selectedPage.followers_count.toLocaleString()} متابع`
                          : "متصلة بالمتجر"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">لم يتم اختيار صفحة رئيسية بعد.</p>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab("pages")}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  إدارة الصفحات <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Selected Ad Account Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    الحساب الإعلاني
                  </span>
                  <Megaphone className="w-4 h-4 text-amber-400" />
                </div>
                {selectedAdAccount ? (
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm truncate">
                      {selectedAdAccount.name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      معرّف: {selectedAdAccount.account_id} ({selectedAdAccount.currency})
                    </p>
                    {selectedAdAccount.amount_spent && (
                      <p className="text-xs text-emerald-400 font-semibold">
                        الإنفاق: {Number(selectedAdAccount.amount_spent).toLocaleString()}{" "}
                        {selectedAdAccount.currency}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">لم يتم اختيار حساب إعلاني بعد.</p>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab("ads")}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  إدارة الحسابات الإعلانية <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Instagram Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Instagram للأعمال
                  </span>
                  <Instagram className="w-4 h-4 text-pink-400" />
                </div>
                {form.instagram_username ? (
                  <div className="flex items-center gap-3">
                    {form.instagram_picture ? (
                      <img
                        src={form.instagram_picture}
                        alt={form.instagram_username}
                        className="w-11 h-11 rounded-xl object-cover ring-2 ring-pink-500/30"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center font-bold">
                        IG
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-white text-sm truncate" dir="ltr">
                        @{form.instagram_username}
                      </h4>
                      <p className="text-xs text-slate-400">حساب أعمال متصل</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">
                    {selectedPage
                      ? "الصفحة المختارة غير مرتبطة بحساب إنستغرام"
                      : "يرتبط بحساب إنستغرام عبر الصفحة"}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab("pages")}
                  className="text-xs font-medium text-pink-400 hover:text-pink-300 flex items-center gap-1"
                >
                  تفاصيل إنستغرام <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tracking & Pixel Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Pixel & CAPI
                  </span>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm truncate">
                    {form.pixel_id ? `Pixel: ${form.pixel_id}` : "البيكسل غير مضبوط"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Conversions API:{" "}
                    {form.capi_token ? (
                      <span className="text-emerald-400 font-medium">مفعل على الخادم ✓</span>
                    ) : (
                      <span className="text-slate-400">غير مضبوط</span>
                    )}
                  </p>
                  {form.last_capi_event_at && (
                    <p className="text-xs text-emerald-400">
                      آخر إرسال: {new Date(form.last_capi_event_at).toLocaleTimeString("ar-SA")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("tracking")}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  إعدادات التتبع والاختبار <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Diagnostics Banner & Button */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    الفحص التشخيصي الشامل لتكامل Meta
                  </h3>
                  <p className="text-sm text-slate-400">
                    التحقق من صحة App ID، الرمز السري، صلاحية توكن الجلسة، والربط مع Pixel و CAPI.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunDiagnostics}
                disabled={runningDiag}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
              >
                <Activity
                  className={`w-4 h-4 ${runningDiag ? "animate-spin text-indigo-400" : ""}`}
                />
                {runningDiag ? "جاري الفحص..." : "تشغيل الفحص الآن"}
              </button>
            </div>

            {/* Diagnostic Results Display */}
            {diagResult && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                  نتائج الفحص التشخيصي
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    className={`p-3.5 rounded-xl border ${diagResult.hasAppId ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}
                  >
                    <p className="text-xs text-slate-400">Meta App ID</p>
                    <p className="font-semibold text-sm">
                      {diagResult.hasAppId ? "مضبوط ومتاح ✓" : "مفقود ✕"}
                    </p>
                  </div>
                  <div
                    className={`p-3.5 rounded-xl border ${diagResult.hasSecret ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}
                  >
                    <p className="text-xs text-slate-400">Meta App Secret</p>
                    <p className="font-semibold text-sm">
                      {diagResult.hasSecret ? "مشفر على الخادم ✓" : "مفقود ✕"}
                    </p>
                  </div>
                  <div
                    className={`p-3.5 rounded-xl border ${diagResult.tokenValid ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-amber-500/10 border-amber-500/30 text-amber-300"}`}
                  >
                    <p className="text-xs text-slate-400">حالة توكن الجلسة</p>
                    <p className="font-semibold text-sm">
                      {diagResult.tokenValid ? "نشط وصالح مع Meta ✓" : "غير صالح أو منتهي"}
                    </p>
                  </div>
                </div>

                {diagResult.issues.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-amber-400">الملاحظات والتوصيات:</p>
                    <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                      {diagResult.issues.map((issue: string, i: number) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: DISCOVERED PAGES & INSTAGRAM ===================== */}
        {activeTab === "pages" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">صفحات Facebook وInstagram المكتشفة</h2>
                <p className="text-sm text-slate-400">
                  الصفحات التي تديرها بحساب Meta المتصل مع صلاحيات النشر، المزامنة، وحسابات إنستغرام
                  المرتبطة.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pageSearch}
                    onChange={(e) => setPageSearch(e.target.value)}
                    placeholder="بحث في الصفحات..."
                    className="w-full pl-3 pr-9 py-2 rounded-xl text-sm bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSyncAssets}
                  disabled={syncingAssets}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingAssets ? "animate-spin" : ""}`} />
                  تحديث
                </button>
              </div>
            </div>

            {filteredPages.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
                <Facebook className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-lg font-bold text-white">لم يتم العثور على صفحات</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  {form.connected
                    ? "تأكد من أن حساب Meta يملك صلاحيات مسؤول على صفحة فيسبوك، أو أعد التفويض للتأكد من منح صلاحية pages_show_list."
                    : "يرجى تسجيل الدخول بحساب Meta أولاً لاكتشاف صفحاتك تلقائياً."}
                </p>
                {!form.connected && (
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition mt-2"
                  >
                    <Facebook className="w-4 h-4 fill-white" />
                    تسجيل الدخول الآن
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredPages.map((page) => {
                  const isSelected = form.page_id === page.id;
                  const ig = page.instagram_account;

                  return (
                    <div
                      key={page.id}
                      className={`p-6 rounded-2xl border transition-all space-y-5 ${
                        isSelected
                          ? "bg-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                          : "bg-slate-900/70 hover:bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {/* Page Info Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {page.picture_url ? (
                            <img
                              src={page.picture_url}
                              alt={page.name}
                              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-700"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xl">
                              {page.name.slice(0, 1)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-white">{page.name}</h3>
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  <Check className="w-3 h-3" />
                                  الصفحة الرئيسية للمتجر
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              معرّف الصفحة: {page.id}
                              {page.category && ` • ${page.category}`}
                            </p>
                            {page.followers_count != null && (
                              <p className="text-xs text-blue-400 mt-0.5">
                                {page.followers_count.toLocaleString()} متابع
                              </p>
                            )}
                          </div>
                        </div>

                        {!isSelected ? (
                          <button
                            type="button"
                            onClick={() => handleSelectPage(page.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-500 transition"
                          >
                            اختيار كصفحة رئيسية
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSyncPageProfile}
                            disabled={syncingPageProfile}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {syncingPageProfile ? "جاري التحديث..." : "تحديث بيانات المتجر"}
                          </button>
                        )}
                      </div>

                      {/* Tasks / Permissions on this page */}
                      {page.tasks && page.tasks.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-slate-400">
                            الصلاحيات على الصفحة:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {page.tasks.map((task) => (
                              <span
                                key={task}
                                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {task}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Linked Instagram Professional Account */}
                      {ig ? (
                        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-pink-500/20 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {ig.profile_picture_url ? (
                              <img
                                src={ig.profile_picture_url}
                                alt={ig.username}
                                className="w-10 h-10 rounded-xl object-cover ring-2 ring-pink-500/30"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center font-bold">
                                IG
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm" dir="ltr">
                                  @{ig.username}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/30">
                                  Instagram للأعمال
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                معرّف: {ig.id}
                                {ig.followers_count != null &&
                                  ` • ${ig.followers_count.toLocaleString()} متابع`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                          <Instagram className="w-4 h-4 text-slate-500" />
                          <span>لا يوجد حساب إنستغرام للأعمال مرتبط بهذه الصفحة حالياً.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: DISCOVERED META AD ACCOUNTS ===================== */}
        {activeTab === "ads" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  الحسابات الإعلانية Meta Ads المكتشفة
                </h2>
                <p className="text-sm text-slate-400">
                  الحسابات الإعلانية المتاحة عبر Meta Marketing API لعرض تقارير الإنفاق وإدارة
                  الحملات.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adAccountSearch}
                    onChange={(e) => setAdAccountSearch(e.target.value)}
                    placeholder="بحث في الحسابات الإعلانية..."
                    className="w-full pl-3 pr-9 py-2 rounded-xl text-sm bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSyncAssets}
                  disabled={syncingAssets}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingAssets ? "animate-spin" : ""}`} />
                  تحديث
                </button>
              </div>
            </div>

            {filteredAdAccounts.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
                <Megaphone className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-lg font-bold text-white">لم يتم العثور على حسابات إعلانية</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  {form.connected
                    ? "تأكد من أن حساب Meta يملك صلاحيات إعلانية (ads_read / ads_management)، أو أن الحساب الإعلاني مرتبط بمحفظة أعمالك."
                    : "يرجى تسجيل الدخول بحساب Meta لاكتشاف حساباتك الإعلانية تلقائياً."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredAdAccounts.map((account) => {
                  const isSelected = form.ad_account_id === account.id;

                  return (
                    <div
                      key={account.id}
                      className={`p-6 rounded-2xl border transition-all space-y-4 ${
                        isSelected
                          ? "bg-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30"
                          : "bg-slate-900/70 hover:bg-slate-900 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base">{account.name}</h3>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                معتمد للمتجر
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 font-mono">
                            {account.id} ({account.currency})
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            account.account_status === 1
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {account.account_status_label || "نشط"}
                        </span>
                      </div>

                      {account.amount_spent && (
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                          <p className="text-xs text-slate-400">إجمالي الإنفاق الإعلاني:</p>
                          <p className="text-base font-bold text-white mt-0.5">
                            {Number(account.amount_spent).toLocaleString()} {account.currency}
                          </p>
                        </div>
                      )}

                      {account.business && (
                        <p className="text-xs text-slate-400">
                          محفظة الأعمال:{" "}
                          <span className="text-slate-200 font-medium">
                            {account.business.name}
                          </span>
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        {!isSelected ? (
                          <button
                            type="button"
                            onClick={() => handleSelectAdAccount(account.id)}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white border border-slate-700 hover:border-amber-500 transition text-center"
                          >
                            اختيار للمتجر
                          </button>
                        ) : (
                          <Link
                            to="/admin/ads"
                            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition text-center"
                          >
                            إدارة الحملات الإعلانية
                          </Link>
                        )}
                        <a
                          href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.account_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
                          title="فتح في Meta Ads Manager"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: BUSINESS PORTFOLIOS & CATALOGS ===================== */}
        {activeTab === "business" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                محافظ الأعمال (Meta Business Portfolios)
              </h2>
              <p className="text-sm text-slate-400">
                محافظ الأعمال المرتبطة بحسابك والتي تحتوي على الكتالوجات، البكسلات، وحسابات
                الإعلانات.
              </p>
            </div>

            {(form.discovered_businesses || []).length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
                <Layers className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-lg font-bold text-white">لم يتم اكتشاف محافظ أعمال</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  إذا كنت تدير حساباتك كحساب إعلاني شخصي أو صفحة مباشرة دون Meta Business Manager،
                  يمكنك الاستمرار بذلك بصورة طبيعية.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {(form.discovered_businesses || []).map((biz) => (
                  <div
                    key={biz.id}
                    className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                        <Layers className="w-5 h-5" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {biz.verification_status === "verified" ? "موثق ✓" : "غير موثق"}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-white text-base">{biz.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 font-mono">
                        معرّف المحفظة: {biz.id}
                      </p>
                    </div>

                    {biz.primary_page && (
                      <p className="text-xs text-slate-400">
                        الصفحة الأساسية:{" "}
                        <span className="text-slate-200">{biz.primary_page.name}</span>
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-800">
                      <a
                        href={`https://business.facebook.com/settings?business_id=${biz.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        فتح في Meta Business Suite <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 5: PERMISSIONS & ACCESS ===================== */}
        {activeTab === "permissions" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">إدارة الصلاحيات والوصول</h2>
              <p className="text-sm text-slate-400">
                حالة الصلاحيات الممنوحة من قبل حساب Meta، وما تتطلبه من إجراءات في Meta for
                Developers.
              </p>
            </div>

            {/* Permissions Explanation Notice */}
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-200 leading-relaxed space-y-1">
                <p className="font-semibold">توضيح أمان الصلاحيات:</p>
                <p>
                  يطلب المتجر فقط الصلاحيات اللازمة لإدارة الصفحات والإعلانات وتتبع المبيعات. في حال
                  كان التطبيق في وضع التطوير (Development Mode)، يجب أن يكون حسابك مسجلاً كمسؤول أو
                  مطور أو مختبر (Tester) داخل لوحة Meta Developers.
                </p>
              </div>
            </div>

            {(form.permissions || []).length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
                <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-lg font-bold text-white">لا توجد صلاحيات مسجلة</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  يرجى تسجيل الدخول بحساب Meta لاستدعاء الصلاحيات الممنوحة وفحص حالتها.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(form.permissions || []).map((perm: MetaPermissionItem) => {
                  const isGranted = perm.status === "granted";

                  return (
                    <div
                      key={perm.permission}
                      className={`p-5 rounded-2xl border transition space-y-3 ${
                        isGranted
                          ? "bg-slate-900 border-slate-800"
                          : "bg-rose-950/20 border-rose-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-bold text-white" dir="ltr">
                          {perm.permission}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isGranted
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {isGranted ? "ممنوحة ✓" : "مرفوضة ✕"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {perm.description || "صلاحية للوصول لبيانات Meta"}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                        <span>الهدف: {perm.required_for || "تكامل عام"}</span>
                        {perm.requires_app_review && (
                          <span className="text-amber-400">
                            يتطلب App Review للمستخدمين العامين
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 6: TRACKING (PIXEL & CAPI) ===================== */}
        {activeTab === "tracking" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                تتبع Meta Pixel و Conversions API (CAPI)
              </h2>
              <p className="text-sm text-slate-400">
                إرسال أحداث التصفح والشراء والسلة مباشرة من المتصفح ومن الخادم لضمان أقصى دقة وجودة
                مطابقة (Event Match Quality).
              </p>
            </div>

            {/* Pixel & CAPI Configuration Form */}
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                إعدادات المعرّفات والتوكن
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-200">
                    معرّف Meta Pixel / Dataset ID
                  </label>
                  <input
                    type="text"
                    value={form.pixel_id || ""}
                    onChange={(e) => setForm({ ...form, pixel_id: e.target.value })}
                    placeholder="مثال: 2238981283326658"
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-xs text-slate-400">
                    معرّف مجموعة البيانات (Dataset) أو البيكسل من Meta Events Manager.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-200">
                    رمز اختبار الأحداث (Test Event Code)
                  </label>
                  <input
                    type="text"
                    value={form.test_event_code || ""}
                    onChange={(e) => setForm({ ...form, test_event_code: e.target.value })}
                    placeholder="مثال: TEST36973"
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-xs text-slate-400">
                    انسخ الرمز من تبويب Test Events في Events Manager للاختبار المباشر.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-200">
                  رمز وصول Conversions API الدائم (System User Token)
                </label>
                <div className="relative">
                  <input
                    type={showAppSecret ? "text" : "password"}
                    value={form.capi_token || ""}
                    onChange={(e) => setForm({ ...form, capi_token: e.target.value })}
                    placeholder="EAA..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAppSecret(!showAppSecret)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showAppSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  يتم حفظ التوكن على الخادم واستخدامه في إرسال أحداث CAPI بأمان.
                </p>
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.track_purchases}
                    onChange={(e) => setForm({ ...form, track_purchases: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    تتبع عمليات الشراء (Purchase)
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.track_add_to_cart}
                    onChange={(e) => setForm({ ...form, track_add_to_cart: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    تتبع الإضافة للسلة (AddToCart)
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.track_view_content}
                    onChange={(e) => setForm({ ...form, track_view_content: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    تتبع مشاهدة المنتجات (ViewContent)
                  </span>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => saveMutation.mutate(form)}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {saveMutation.isPending ? "جاري الحفظ..." : "حفظ إعدادات التتبع"}
                </button>
              </div>
            </div>

            {/* Live Event Sender Tester */}
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-400" />
                اختبار إرسال حدث فوري إلى Conversions API
              </h3>
              <p className="text-sm text-slate-400">
                أرسل حدثاً تجريبياً حقيقياً إلى خوادم Meta للتحقق من استلامه داخل Events Manager.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">نوع الحدث</label>
                  <select
                    value={testEventType}
                    onChange={(e) => setTestEventType(e.target.value as TestEventType)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Purchase">شراء (Purchase)</option>
                    <option value="AddToCart">إضافة إلى السلة (AddToCart)</option>
                    <option value="ViewContent">مشاهدة محتوى (ViewContent)</option>
                    <option value="InitiateCheckout">بدء الدفع (InitiateCheckout)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">المبلغ التجريبي</label>
                  <input
                    type="number"
                    value={testAmount}
                    onChange={(e) => setTestAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">العملة</label>
                  <select
                    value={testCurrency}
                    onChange={(e) => setTestCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="YER">ريال يمني (YER)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSendTestEvent}
                  disabled={testingCapi}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 transition disabled:opacity-50 cursor-pointer"
                >
                  <Send className={`w-4 h-4 ${testingCapi ? "animate-spin" : ""}`} />
                  {testingCapi ? "جاري الإرسال لـ Meta..." : "إرسال الحدث التجريبي الآن"}
                </button>
              </div>
            </div>

            {/* Recent Events Log Table */}
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    سجل الأحداث الأخيرة (Live Event Stream)
                  </h3>
                  <p className="text-xs text-slate-400">
                    الأحداث المسجلة محلياً والمطابقة مع Event ID لمنع التكرار (Deduplication).
                  </p>
                </div>
                {recentEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentMetaEvents();
                      setRecentEvents([]);
                      toast.success("تم مسح سجل الأحداث التجريبية");
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 transition"
                  >
                    مسح السجل
                  </button>
                )}
              </div>

              {recentEvents.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400">
                  لم يتم تسجيل أي أحداث حتى الآن. أرسل حدثاً تجريبياً أو تصفح المتجر لمشاهدة التسجيل
                  الفوري.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">اسم الحدث</th>
                        <th className="pb-3 font-semibold">معرّف الحدث (Event ID)</th>
                        <th className="pb-3 font-semibold">الوقت</th>
                        <th className="pb-3 font-semibold">القيمة</th>
                        <th className="pb-3 font-semibold">الحمولة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recentEvents.map((evt, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 font-bold text-indigo-400">{evt.eventName}</td>
                          <td className="py-3 font-mono text-slate-300">{evt.eventId}</td>
                          <td className="py-3 text-slate-400">
                            {new Date(evt.timestamp).toLocaleTimeString("ar-SA")}
                          </td>
                          <td className="py-3 text-emerald-400 font-semibold">
                            {evt.value ? `${evt.value} ${evt.currency || ""}` : "—"}
                          </td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedEventPayload(evt)}
                              className="text-xs text-blue-400 hover:text-blue-300 underline"
                            >
                              عرض البيانات
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Event Payload Inspector Modal */}
            {selectedEventPayload && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-base">
                      تفاصيل حدث: {selectedEventPayload.eventName}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSelectedEventPayload(null)}
                      className="text-slate-400 hover:text-white text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <pre
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto max-h-80"
                    dir="ltr"
                  >
                    {JSON.stringify(selectedEventPayload, null, 2)}
                  </pre>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedEventPayload(null)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 7: APP SETTINGS & SETUP GUIDE ===================== */}
        {activeTab === "app_settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">إعدادات تطبيق Meta ودليل المطورين</h2>
              <p className="text-sm text-slate-400">
                إدخال معرّف ورمز تطبيق Meta (Meta App ID & Secret) وضبط روابط إعادة التوجيه
                (Redirect URIs).
              </p>
            </div>

            {/* App Credentials Card */}
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                بيانات اعتماد تطبيق Meta (App Credentials)
              </h3>
              <p className="text-xs text-slate-400">
                يتم حفظ هذه البيانات مشفرة على الخادم ولن تظهر في الواجهة أبداً.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-200">
                    معرّف التطبيق (Meta App ID)
                  </label>
                  <input
                    type="text"
                    value={appIdInput}
                    onChange={(e) => setAppIdInput(e.target.value)}
                    placeholder="مثال: 1083948293849102"
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-xs text-slate-400">
                    من لوحة التحكم في developers.facebook.com تحت اسم تطبيقك.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-200">
                    الرمز السري للتطبيق (Meta App Secret)
                  </label>
                  <div className="relative">
                    <input
                      type={showAppSecret ? "text" : "password"}
                      value={appSecretInput}
                      onChange={(e) => setAppSecretInput(e.target.value)}
                      placeholder={
                        form.has_secret ? "•••••••••••••••• (محفوظ على الخادم)" : "أدخل الرمز السري"
                      }
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAppSecret(!showAppSecret)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showAppSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    {form.has_secret
                      ? "تم حفظ الرمز السري سلفاً. يمكنك تركه فارغاً ما لم ترغب في تغييره."
                      : "احصل عليه من: App Settings > Basic > App Secret."}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveAppKeys}
                  disabled={savingKeys}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {savingKeys ? "جاري الحفظ..." : "حفظ بيانات التطبيق"}
                </button>
              </div>
            </div>

            {/* Valid OAuth Redirect URIs Card */}
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-indigo-400" />
                روابط إعادة التوجيه المصرح بها (Valid OAuth Redirect URIs)
              </h3>
              <p className="text-sm text-slate-400">
                انسخ هذه الروابط والصقها داخل إعدادات{" "}
                <b>Facebook Login for Business &gt; Settings</b> في حقل{" "}
                <b>Valid OAuth Redirect URIs</b>:
              </p>

              <div className="space-y-3 font-mono text-xs">
                {/* Primary Callback */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-emerald-400 truncate" dir="ltr">
                    {callbackUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(callbackUrl, "cb1")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-sans text-xs shrink-0"
                  >
                    {copiedKey === "cb1" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    نسخ
                  </button>
                </div>

                {/* Fallback Callback */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-slate-300 truncate" dir="ltr">
                    {fallbackCallbackUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fallbackCallbackUrl, "cb2")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-sans text-xs shrink-0"
                  >
                    {copiedKey === "cb2" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    نسخ
                  </button>
                </div>
              </div>
            </div>

            {/* Setup Checklist Guide */}
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                خطوات إعداد تطبيق Meta خطوة بخطوة
              </h3>

              <ol className="space-y-3 text-sm text-slate-300 list-decimal list-inside leading-relaxed">
                <li>
                  ادخل إلى{" "}
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Meta for Developers
                  </a>{" "}
                  واضغط على <b>Create App</b>.
                </li>
                <li>
                  اختر نوع التطبيق: <b>Business</b> أو <b>Other</b> ثم حدد استخدام Facebook Login.
                </li>
                <li>
                  من القائمة الجانبية للتطبيق، أضف منتج <b>Facebook Login for Business</b>.
                </li>
                <li>
                  اذهب إلى <b>Facebook Login &gt; Settings</b>، وتأكد من تفعيل{" "}
                  <b>Client OAuth Login</b> و <b>Web OAuth Login</b>.
                </li>
                <li>
                  في حقل <b>Valid OAuth Redirect URIs</b>، ألصق الروابط الموضحة أعلاه واضغط حفظ.
                </li>
                <li>
                  في <b>App Settings &gt; Basic</b>، انسخ <b>App ID</b> و <b>App Secret</b> وضعهما
                  هنا في الأعلى.
                </li>
                <li>
                  اضغط على زر «تسجيل الدخول باستخدام Meta» واستمتع بمزامنة صفحاتك وحساباتك
                  الإعلانية!
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
