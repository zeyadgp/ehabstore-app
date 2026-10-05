import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Megaphone,
  PlusCircle,
  BarChart3,
  ListFilter,
  Play,
  Pause,
  Sliders,
  Calendar,
  Globe2,
  Users,
  Target,
  DollarSign,
  TrendingUp,
  Layers,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  Check,
  Smartphone,
  Facebook,
  Instagram,
  ShoppingBag,
  Percent,
} from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useProducts, useCategories, priceOf } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { SmartImage } from "@/components/SmartImage";
import { fallbackFor } from "@/lib/images";
import { getMetaConfig, getMetaCampaigns, saveMetaCampaigns } from "@/lib/meta/storage";
import {
  createMetaCampaignApi,
  toggleMetaCampaignStatusApi,
  fetchMetaPerformanceReport,
} from "@/lib/meta/api";
import type {
  MetaCampaign,
  MetaObjective,
  MetaPlatform,
  MetaBudgetType,
  MetaGender,
  MetaTargeting,
} from "@/lib/meta/types";

type AdsSearch = {
  tab?: "campaigns" | "create" | "reports" | undefined;
  products?: string | undefined;
};

export const Route = createFileRoute("/admin/ads")({
  validateSearch: (search: Record<string, unknown>): AdsSearch => ({
    tab: (search["tab"] as any) || "campaigns",
    products: typeof search["products"] === "string" ? search["products"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "إدارة الإعلانات | لوحة التحكم" }, { name: "robots", content: "noindex" }],
  }),
  component: AdsManagementPage,
});

export function AdsManagementPage() {
  const qc = useQueryClient();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const { symbol } = useCurrency();

  const [activeTab, setActiveTab] = useState<"campaigns" | "create" | "reports">(
    searchParams.tab || "campaigns",
  );

  const { data: config } = useQuery({
    queryKey: ["meta-settings"],
    queryFn: getMetaConfig,
  });

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ["meta-campaigns"],
    queryFn: getMetaCampaigns,
  });

  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();

  // تقرير الأداء
  const [reportPeriod, setReportPeriod] = useState<"today" | "last_7_days" | "last_30_days">(
    "last_7_days",
  );
  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ["meta-report", reportPeriod],
    queryFn: () => fetchMetaPerformanceReport(reportPeriod),
  });

  // تحديث التبويب عند تغير الرابط
  useEffect(() => {
    if (searchParams.tab) {
      setActiveTab(searchParams.tab);
    }
  }, [searchParams.tab]);

  // ==========================================
  // حالة إنشاء الحملة الإعلانية (Create Campaign)
  // ==========================================
  const [campaignName, setCampaignName] = useState(
    "حملة ترويجية جديدة - " + new Date().toLocaleDateString("ar-SA"),
  );
  const [objective, setObjective] = useState<MetaObjective>("OUTCOME_SALES");
  const [productSelectionType, setProductSelectionType] = useState<
    "single" | "multiple" | "category" | "all_catalog"
  >(searchParams.products ? "multiple" : "all_catalog");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    searchParams.products ? searchParams.products.split(",").filter(Boolean) : [],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isDynamicCatalog, setIsDynamicCatalog] = useState(true);
  const [platforms, setPlatforms] = useState<MetaPlatform[]>(["facebook", "instagram"]);
  const [budgetType, setBudgetType] = useState<MetaBudgetType>("daily");
  const [budgetAmount, setBudgetAmount] = useState<number>(100);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]!);
  const [endDate, setEndDate] = useState<string>("");
  const [hasEndDate, setHasEndDate] = useState(false);

  // الجمهور المستهدف
  const [targetCountries, setTargetCountries] = useState<string[]>(["SA"]);
  const [targetCities, setTargetCities] = useState<string[]>(["الرياض", "جدة"]);
  const [cityInput, setCityInput] = useState("");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(50);
  const [gender, setGender] = useState<MetaGender>("female");
  const [interests, setInterests] = useState<string[]>([
    "مستحضرات التجميل",
    "العناية بالبشرة",
    "المكياج",
    "التسوق الإلكتروني",
  ]);
  const [interestInput, setInterestInput] = useState("");

  // معاينة الإعلان
  const [previewPlatform, setPreviewPlatform] = useState<"instagram" | "facebook">("instagram");

  // تحكم في تعديل الميزانية للحملات الحالية
  const [editingBudgetCampaignId, setEditingBudgetCampaignId] = useState<string | null>(null);
  const [editingBudgetAmount, setEditingBudgetAmount] = useState<number>(0);

  // تبديل حالة الحملة (Active / Paused)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      campaignId,
      newStatus,
      metaId,
    }: {
      campaignId: string;
      newStatus: "ACTIVE" | "PAUSED";
      metaId?: string | undefined;
    }) => {
      await toggleMetaCampaignStatusApi(campaignId, newStatus, metaId);
      const updated = campaigns.map((c) => (c.id === campaignId ? { ...c, status: newStatus } : c));
      await saveMetaCampaigns(updated);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["meta-campaigns"] });
      toast.success(
        vars.newStatus === "ACTIVE" ? "تم تشغيل الحملة الإعلانية" : "تم إيقاف الحملة مؤقتاً",
      );
    },
  });

  // حفظ الميزانية الجديدة
  const updateBudgetMutation = useMutation({
    mutationFn: async ({ campaignId, amount }: { campaignId: string; amount: number }) => {
      const updated = campaigns.map((c) =>
        c.id === campaignId ? { ...c, budget_amount: amount } : c,
      );
      await saveMetaCampaigns(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meta-campaigns"] });
      setEditingBudgetCampaignId(null);
      toast.success("تم تحديث ميزانية الحملة بنجاح");
    },
  });

  // إنشاء حملة جديدة
  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const targeting: MetaTargeting = {
        countries: targetCountries,
        cities: targetCities,
        age_min: ageMin,
        age_max: ageMax,
        genders: gender,
        interests,
      };

      const newCampData = {
        name: campaignName.trim() || "حملة إعلانية جديدة",
        objective,
        status: "ACTIVE" as const,
        platforms,
        budget_type: budgetType,
        budget_amount: budgetAmount,
        currency: config?.ad_account_currency || "SAR",
        start_date: startDate,
        end_date: hasEndDate && endDate ? endDate : null,
        targeting,
        product_selection_type: productSelectionType,
        selected_product_ids: selectedProductIds,
        selected_category_id: selectedCategoryId || null,
        is_dynamic_catalog: isDynamicCatalog,
      };

      const res = await createMetaCampaignApi(newCampData);

      const completeCampaign: MetaCampaign = {
        ...newCampData,
        id: res.campaign_id,
        ...(res.meta_campaign_id ? { meta_campaign_id: res.meta_campaign_id } : {}),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metrics: {
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          purchases: 0,
          purchase_value: 0,
          roas: 0,
          cpc: 0,
          cpm: 0,
          ctr: 0,
        },
      };

      const updatedList = [completeCampaign, ...campaigns];
      await saveMetaCampaigns(updatedList);
      return res;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["meta-campaigns"] });
      if (res?.local_only) {
        toast.success(
          res.error
            ? `تم حفظ الحملة داخلياً. Meta ردّت: ${res.error}`
            : "تم حفظ الحملة كمسودة داخلية. اربطي حساب Meta الإعلاني لنشرها فعلياً.",
        );
      } else {
        toast.success("تم إنشاء الحملة الإعلانية بنجاح وإرسالها إلى Meta!");
      }
      setActiveTab("campaigns");
      void navigate({ to: "/admin/ads", search: { tab: "campaigns" } as any });
    },
    onError: (err: any) => {
      toast.error(`تعذر إنشاء الحملة: ${err?.message || "يرجى المحاولة مجدداً"}`);
    },
  });

  // المنتجات المختارة للعرض في المعاينة
  const previewProducts = useMemo(() => {
    if (selectedProductIds.length > 0) {
      return products.filter((p) => selectedProductIds.includes(p.id));
    }
    if (selectedCategoryId) {
      return products.filter((p) => p.category_id === selectedCategoryId);
    }
    return products.slice(0, 4);
  }, [products, selectedProductIds, selectedCategoryId]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      {/* الرأس والتبويبات */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1877F2]/10 text-[#1877F2]">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                إدارة إعلانات Facebook & Instagram
              </h1>
              <p className="text-xs text-muted-foreground">
                إنشاء حملات مبيعات مباشرة، إعلانات كتالوج ديناميكي (Advantage+ Catalog Ads)، ومتابعة
                النتائج.
              </p>
            </div>
          </div>
        </div>

        {/* أزرار التبويب */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-muted/30 p-1">
          <button
            onClick={() => {
              setActiveTab("campaigns");
              void navigate({ to: "/admin/ads", search: { tab: "campaigns" } as any });
            }}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "campaigns"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            الحملات الحالية ({campaigns.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("create");
              void navigate({ to: "/admin/ads", search: { tab: "create" } as any });
            }}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "create"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            إنشاء حملة إعلانية
          </button>

          <button
            onClick={() => {
              setActiveTab("reports");
              void navigate({ to: "/admin/ads", search: { tab: "reports" } as any });
            }}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "reports"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            لوحة تقارير الأداء
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* التبويب 1: الحملات الإعلانية الحالية (Active Campaigns) */}
      {/* ========================================================= */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">الحملات النشطة والمجدولة</h2>
            <button
              onClick={() => {
                setActiveTab("create");
                void navigate({ to: "/admin/ads", search: { tab: "create" } as any });
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              حملة جديدة
            </button>
          </div>

          {loadingCampaigns ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              جاري تحميل الحملات...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
              <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-bold text-foreground">
                لا توجد حملات إعلانية بعد
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ابدأ بإنشاء أول حملة إعلانية لمنتجاتك لزيادة المبيعات والوصول لآلاف العملاء في
                منطقتك.
              </p>
              <button
                onClick={() => setActiveTab("create")}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground"
              >
                <PlusCircle className="h-4 w-4" />
                إنشاء أول إعلان الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {campaigns.map((camp) => {
                const isActive = camp.status === "ACTIVE";
                const metrics = camp.metrics || {
                  spend: 0,
                  impressions: 0,
                  clicks: 0,
                  purchases: 0,
                  purchase_value: 0,
                  roas: 0,
                };

                return (
                  <div
                    key={camp.id}
                    className="rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* معلومات الحملة الأساسية */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{camp.name}</h3>

                          {isActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              نشطة الآن
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                              متوقفة مؤقتاً
                            </span>
                          )}

                          {camp.is_dynamic_catalog && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              Advantage+ Catalog
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            الهدف:{" "}
                            {camp.objective === "OUTCOME_SALES"
                              ? "مبيعات وتحويلات"
                              : "زيارات وتفاعل"}
                          </span>
                          <span>•</span>
                          <span>
                            الميزانية: {camp.budget_amount} {camp.currency} /{" "}
                            {camp.budget_type === "daily" ? "يومياً" : "إجمالية"}
                          </span>
                          <span>•</span>
                          <span>المنصات: {camp.platforms.join(" + ")}</span>
                          {camp.meta_campaign_id && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[11px]">
                                ID: {camp.meta_campaign_id}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* إحصائيات الحملة السريعة والأزرار */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-muted/40 p-2.5 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground">الإنفاق</span>
                            <p className="font-bold text-foreground">
                              {metrics.spend} {camp.currency}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">المبيعات</span>
                            <p className="font-bold text-emerald-600">
                              {metrics.purchase_value} {camp.currency}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">الطلبات</span>
                            <p className="font-bold text-foreground">{metrics.purchases}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">ROAS</span>
                            <p className="font-bold text-primary">{metrics.roas}x</p>
                          </div>
                        </div>

                        {/* مفتاح التشغيل والإيقاف */}
                        <button
                          type="button"
                          onClick={() => {
                            toggleStatusMutation.mutate({
                              campaignId: camp.id,
                              newStatus: isActive ? "PAUSED" : "ACTIVE",
                              metaId: camp.meta_campaign_id,
                            });
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${
                            isActive
                              ? "border border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                          }`}
                        >
                          {isActive ? (
                            <>
                              <Pause className="h-3.5 w-3.5" />
                              إيقاف مؤقت
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              تشغيل الحملة
                            </>
                          )}
                        </button>

                        {/* تعديل الميزانية */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBudgetCampaignId(camp.id);
                            setEditingBudgetAmount(camp.budget_amount);
                          }}
                          className="rounded-2xl border border-border bg-background p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          title="تعديل الميزانية"
                        >
                          <Sliders className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* نافذة تعديل الميزانية المنبثقة السريعة */}
                    {editingBudgetCampaignId === camp.id && (
                      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                        <span className="text-xs font-bold text-foreground">
                          تعديل الميزانية ({camp.currency}):
                        </span>
                        <input
                          type="number"
                          min="10"
                          value={editingBudgetAmount}
                          onChange={(e) => setEditingBudgetAmount(Number(e.target.value))}
                          className="w-24 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold outline-none focus:border-primary"
                        />
                        <button
                          onClick={() =>
                            updateBudgetMutation.mutate({
                              campaignId: camp.id,
                              amount: editingBudgetAmount,
                            })
                          }
                          className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                        >
                          حفظ
                        </button>
                        <button
                          onClick={() => setEditingBudgetCampaignId(null)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          إلغاء
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* التبويب 2: إنشاء حملة إعلانية (Campaign Creator Wizard) */}
      {/* ========================================================= */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* قسم إعدادات الحملة (عمودين) */}
          <div className="space-y-6 lg:col-span-2">
            {/* الخطوة 1: الهدف الإعلاني واسم الحملة */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold text-foreground">1. الهدف الإعلاني واسم الحملة</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-foreground">اسم الحملة</label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">اختيار الهدف</label>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setObjective("OUTCOME_SALES")}
                      className={`flex flex-col items-start rounded-2xl border p-3.5 text-right transition ${
                        objective === "OUTCOME_SALES"
                          ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                          : "border-border hover:bg-muted/30 text-foreground"
                      }`}
                    >
                      <ShoppingBag className="h-5 w-5 mb-2 text-primary" />
                      <span className="text-xs font-bold">زيادة المبيعات</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        تحويلات وطلبات مباشرة
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setObjective("OUTCOME_TRAFFIC")}
                      className={`flex flex-col items-start rounded-2xl border p-3.5 text-right transition ${
                        objective === "OUTCOME_TRAFFIC"
                          ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                          : "border-border hover:bg-muted/30 text-foreground"
                      }`}
                    >
                      <TrendingUp className="h-5 w-5 mb-2 text-blue-500" />
                      <span className="text-xs font-bold">زيارات للمتجر</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        نقرات مباشرة لصفحات المنتجات
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setObjective("OUTCOME_LEADS")}
                      className={`flex flex-col items-start rounded-2xl border p-3.5 text-right transition ${
                        objective === "OUTCOME_LEADS"
                          ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                          : "border-border hover:bg-muted/30 text-foreground"
                      }`}
                    >
                      <Users className="h-5 w-5 mb-2 text-amber-500" />
                      <span className="text-xs font-bold">تفاعل ورسائل</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        محادثات واستفسارات واتساب/دايركت
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* الخطوة 2: اختيار المنتجات والكتالوج */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">2. اختيار المنتجات للإعلان</h2>
                </div>
                <Link to="/admin/ad-products" className="text-xs text-primary hover:underline">
                  اختيار من صفحة المنتجات →
                </Link>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => {
                      setProductSelectionType("all_catalog");
                      setIsDynamicCatalog(true);
                    }}
                    className={`rounded-2xl border p-3 text-center text-xs font-bold transition ${
                      productSelectionType === "all_catalog"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-foreground hover:bg-muted/30"
                    }`}
                  >
                    كل الكتالوج (ديناميكي)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductSelectionType("multiple");
                      setIsDynamicCatalog(true);
                    }}
                    className={`rounded-2xl border p-3 text-center text-xs font-bold transition ${
                      productSelectionType === "multiple"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-foreground hover:bg-muted/30"
                    }`}
                  >
                    عدة منتجات مختارة ({selectedProductIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductSelectionType("category");
                      setIsDynamicCatalog(false);
                    }}
                    className={`rounded-2xl border p-3 text-center text-xs font-bold transition ${
                      productSelectionType === "category"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-foreground hover:bg-muted/30"
                    }`}
                  >
                    تصنيف محدد
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductSelectionType("single");
                      setIsDynamicCatalog(false);
                    }}
                    className={`rounded-2xl border p-3 text-center text-xs font-bold transition ${
                      productSelectionType === "single"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-foreground hover:bg-muted/30"
                    }`}
                  >
                    منتج واحد
                  </button>
                </div>

                {/* إذا تم اختيار تصنيف */}
                {productSelectionType === "category" && (
                  <div>
                    <label className="text-xs font-bold text-foreground">اختر التصنيف</label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-medium outline-none focus:border-primary"
                    >
                      <option value="">اختر تصنيف المنتجات...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* خيار الإعلانات الديناميكية Advantage+ */}
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3.5">
                  <div>
                    <span className="text-xs font-bold text-foreground">
                      إعلان كتالوج تفاعلي دوار (Advantage+ Catalog Dynamic Ads)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      يعرض تلقائياً لكل مستخدم على فيسبوك وإنستغرام المنتجات والألوان المناسبة
                      لاهتماماته.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isDynamicCatalog}
                    onChange={(e) => setIsDynamicCatalog(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                </div>
              </div>
            </div>

            {/* الخطوة 3: المنصات والمواضع */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  3. المنصات والمواضع (Placements)
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4 hover:bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <Instagram className="h-5 w-5 text-[#E1306C]" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Instagram</p>
                      <span className="text-[10px] text-muted-foreground">
                        Feed, Stories, Reels
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={platforms.includes("instagram")}
                    onChange={(e) => {
                      if (e.target.checked) setPlatforms([...platforms, "instagram"]);
                      else setPlatforms(platforms.filter((p) => p !== "instagram"));
                    }}
                    className="h-4 w-4 rounded accent-primary"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border p-4 hover:bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <Facebook className="h-5 w-5 text-[#1877F2]" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Facebook</p>
                      <span className="text-[10px] text-muted-foreground">
                        Feed, Stories, Video
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={platforms.includes("facebook")}
                    onChange={(e) => {
                      if (e.target.checked) setPlatforms([...platforms, "facebook"]);
                      else setPlatforms(platforms.filter((p) => p !== "facebook"));
                    }}
                    className="h-4 w-4 rounded accent-primary"
                  />
                </label>

                <div className="flex items-center rounded-2xl bg-primary/5 p-4 border border-primary/20">
                  <StoreLogo className="h-5 w-5 text-primary shrink-0 ml-2" />
                  <span className="text-[11px] text-muted-foreground">
                    اختيار المنصتين يمنحك أقل تكلفة نقرة (CPC) وأعلى عائد شراء.
                  </span>
                </div>
              </div>
            </div>

            {/* الخطوة 4: الميزانية والجدول الزمني */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-foreground">4. الميزانية والجدول الزمني</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-foreground">نوع الميزانية</label>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBudgetType("daily")}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                        budgetType === "daily"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      يومية
                    </button>
                    <button
                      type="button"
                      onClick={() => setBudgetType("lifetime")}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                        budgetType === "lifetime"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      إجمالية طوال الحملة
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">
                    المبلغ ({config?.ad_account_currency || "SAR"})
                  </label>
                  <input
                    type="number"
                    min="20"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(Math.max(10, Number(e.target.value)))}
                    className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-bold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">تاريخ البدء</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-medium outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">تاريخ الانتهاء</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasEndDate}
                        onChange={(e) => setHasEndDate(e.target.checked)}
                        className="rounded"
                      />
                      تحديد موعد انتهاء
                    </label>
                  </div>
                  <input
                    type="date"
                    disabled={!hasEndDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-medium outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* الخطوة 5: استهداف الجمهور */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  5. استهداف الجمهور (Targeting)
                </h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-foreground">الدولة</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {[
                        { code: "SA", label: "السعودية" },
                        { code: "YE", label: "اليمن" },
                        { code: "AE", label: "الإمارات" },
                        { code: "KW", label: "الكويت" },
                      ].map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            if (targetCountries.includes(c.code)) {
                              setTargetCountries(targetCountries.filter((x) => x !== c.code));
                            } else {
                              setTargetCountries([...targetCountries, c.code]);
                            }
                          }}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            targetCountries.includes(c.code)
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-background text-foreground"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground">الجنس</label>
                    <div className="mt-1 flex gap-2">
                      {[
                        { val: "all", label: "الكل" },
                        { val: "female", label: "نساء" },
                        { val: "male", label: "رجال" },
                      ].map((g) => (
                        <button
                          key={g.val}
                          type="button"
                          onClick={() => setGender(g.val as any)}
                          className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                            gender === g.val
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-background text-foreground"
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* الفئة العمرية */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-foreground">
                      من عمر: {ageMin} سنة
                    </label>
                    <input
                      type="range"
                      min="18"
                      max="65"
                      value={ageMin}
                      onChange={(e) => setAgeMin(Number(e.target.value))}
                      className="mt-1 w-full accent-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground">
                      إلى عمر: {ageMax} سنة
                    </label>
                    <input
                      type="range"
                      min="18"
                      max="65"
                      value={ageMax}
                      onChange={(e) => setAgeMax(Number(e.target.value))}
                      className="mt-1 w-full accent-primary"
                    />
                  </div>
                </div>

                {/* الاهتمامات */}
                <div>
                  <label className="text-xs font-bold text-foreground">الاهتمامات والسلوكيات</label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {interests.map((interest) => (
                      <span
                        key={interest}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {interest}
                        <button
                          type="button"
                          onClick={() => setInterests(interests.filter((i) => i !== interest))}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="أضف اهتماماً (مثال: العناية بالشعر، عطور فاخرة...)"
                      value={interestInput}
                      onChange={(e) => setInterestInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && interestInput.trim()) {
                          e.preventDefault();
                          setInterests([...interests, interestInput.trim()]);
                          setInterestInput("");
                        }
                      }}
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (interestInput.trim()) {
                          setInterests([...interests, interestInput.trim()]);
                          setInterestInput("");
                        }
                      }}
                      className="rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-bold"
                    >
                      إضافة
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* زر الإطلاق والنشر */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("campaigns")}
                className="rounded-2xl border border-border px-5 py-3 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={() => createCampaignMutation.mutate()}
                disabled={createCampaignMutation.isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90 disabled:opacity-50"
              >
                <Megaphone className="h-4 w-4" />
                {createCampaignMutation.isPending
                  ? "جاري إنشاء ونشر الإعلان على Meta..."
                  : "إنشاء ونشر الحملة الإعلانية"}
              </button>
            </div>
          </div>

          {/* العمود الجانبي: معاينة الإعلان المباشرة على الجوال */}
          <div className="space-y-4">
            <div className="sticky top-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">معاينة الإعلان الحية</span>
                </div>

                <div className="flex rounded-xl bg-muted/50 p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewPlatform("instagram")}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                      previewPlatform === "instagram"
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Instagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPlatform("facebook")}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                      previewPlatform === "facebook"
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Facebook
                  </button>
                </div>
              </div>

              {/* بطاقة محاكاة منشور إنستغرام أو فيسبوك */}
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-background text-foreground shadow-sm">
                {/* رأس الحساب */}
                <div className="flex items-center justify-between p-3 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-primary/20 flex items-center justify-center font-bold text-[10px] text-primary">
                      EH
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">
                        {config?.instagram_username || "ehabstore_official"}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        إعلان مُمول • Sponsored
                      </span>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs font-bold">•••</span>
                </div>

                {/* صورة المنتج أو الكاروسيل الدوار */}
                <div className="relative aspect-square w-full bg-muted">
                  {previewProducts[0] ? (
                    <SmartImage
                      src={previewProducts[0].images?.[0] || fallbackFor("product")}
                      alt={previewProducts[0].name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      صور الكتالوج الديناميكي
                    </div>
                  )}

                  {isDynamicCatalog && (
                    <div className="absolute bottom-2 left-2 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                      كتالوج Advantage+ تفاعلي 1/{previewProducts.length || 4}
                    </div>
                  )}
                </div>

                {/* شريط الإجراء وCTA */}
                <div className="flex items-center justify-between bg-primary/10 p-2.5 px-3">
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground">
                      {previewProducts[0]?.name || "تشكيلة منتجات الجمال الأصلية"}
                    </p>
                    <span className="text-[11px] font-bold text-primary">
                      {previewProducts[0]
                        ? `${priceOf(previewProducts[0])} ${symbol}`
                        : "تسوق الآن بأفضل الأسعار"}
                    </span>
                  </div>
                  <button className="rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground">
                    تسوّق الآن
                  </button>
                </div>

                {/* نص الإعلان */}
                <div className="p-3 text-[11px] space-y-1">
                  <p>
                    <strong className="ml-1">
                      {config?.instagram_username || "ehabstore_official"}
                    </strong>
                    اكتشفي أرقى منتجات العناية بالبشرة والمكياج الأصلية 100% مع شحن سريع وضمان ذهبي.
                    ✨💄
                  </p>
                  <p className="text-[10px] text-primary">#عناية #جمال #مكياج #إيهاب_ستور</p>
                </div>
              </div>

              {/* ملخص الحملة */}
              <div className="mt-4 space-y-2 border-t border-border/50 pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الميزانية المقدرة:</span>
                  <span className="font-bold">
                    {budgetAmount} {config?.ad_account_currency || "SAR"} /{" "}
                    {budgetType === "daily" ? "يوم" : "إجمالي"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الوصول التقديري:</span>
                  <span className="font-bold text-emerald-600">8,500 - 24,000 شخص</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">النقرات المتوقعة:</span>
                  <span className="font-bold">420 - 1,200 نقرة</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* التبويب 3: لوحة تقارير الأداء (Ad Performance Analytics) */}
      {/* ========================================================= */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* شريط الفلاتر الزمنية */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  تحليلات وأداء الحملات الإعلانية
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  مؤشرات العائد على الإنفاق (ROAS)، المبيعات، ومعدل التحويل الحقيقي من Pixel & CAPI.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
              {[
                { id: "today", label: "اليوم" },
                { id: "last_7_days", label: "آخر 7 أيام" },
                { id: "last_30_days", label: "آخر 30 يوماً" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setReportPeriod(p.id as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    reportPeriod === p.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {loadingReport ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              جاري استخراج بيانات الأداء...
            </div>
          ) : report ? (
            <>
              {/* شبكة مؤشرات الأداء الرئيسية (KPIs) */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-[11px] text-muted-foreground">إجمالي الإنفاق</span>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {report.total_spend} {symbol}
                  </p>
                  <span className="text-[10px] text-muted-foreground">المصروف على الإعلانات</span>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-[11px] text-muted-foreground">مبيعات الإعلانات</span>
                  <p className="mt-1 text-xl font-bold text-emerald-600">
                    {report.total_sales} {symbol}
                  </p>
                  <span className="text-[10px] text-emerald-600">عائد المبيعات المباشرة</span>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-[11px] text-muted-foreground">عدد الطلبات المحققة</span>
                  <p className="mt-1 text-xl font-bold text-foreground">{report.total_orders}</p>
                  <span className="text-[10px] text-muted-foreground">طلب شراء مؤكد</span>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-[11px] text-muted-foreground">
                    العائد على الإنفاق (ROAS)
                  </span>
                  <p className="mt-1 text-xl font-bold text-primary">{report.roas}x</p>
                  <span className="text-[10px] text-primary">كل 1 ريال حقق {report.roas} ريال</span>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-[11px] text-muted-foreground">النقرات (Link Clicks)</span>
                  <p className="mt-1 text-xl font-bold text-foreground">{report.total_clicks}</p>
                  <span className="text-[10px] text-muted-foreground">
                    CTR: {report.average_ctr}%
                  </span>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-[11px] text-muted-foreground">تكلفة الشراء (CPA)</span>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {report.cost_per_purchase} {symbol}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    CPC: {report.average_cpc} {symbol}
                  </span>
                </div>
              </div>

              {/* رسم بياني: الإنفاق مقابل المبيعات اليومية */}
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">
                    اتجاهات الإنفاق والمبيعات اليومية
                  </h3>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      المبيعات المحققة ({symbol})
                    </span>
                    <span className="flex items-center gap-1.5 text-[#1877F2]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#1877F2]" />
                      الإنفاق الإعلاني ({symbol})
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.daily_trends}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1877F2" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "none",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name="المبيعات"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#salesGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="spend"
                        name="الإنفاق"
                        stroke="#1877F2"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#spendGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* جدول المنتجات الأكثر مبيعاً والأعلى أداءً في الإعلانات */}
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      المنتجات الأكثر مبيعاً والأفضل أداءً في الإعلانات
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      ترتيب المنتجات بناءً على حجم المبيعات الإعلانية والعائد على الصرف (ROAS).
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-border bg-muted/40 font-bold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">المنتج</th>
                        <th className="px-4 py-3">طلبات الشراء</th>
                        <th className="px-4 py-3">قيمة المبيعات</th>
                        <th className="px-4 py-3">الإنفاق الإعلاني</th>
                        <th className="px-4 py-3">العائد (ROAS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {report.top_selling_products.map((item, idx) => (
                        <tr key={item.product_id} className="hover:bg-muted/30 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-bold text-[10px]">
                                {idx + 1}
                              </span>
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                                <SmartImage
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <span className="font-bold text-foreground">{item.product_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-foreground">
                            {item.orders_count} طلب
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600">
                            {item.sales_amount} {symbol}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.ad_spend} {symbol}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-primary">
                              {item.roas}x
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
