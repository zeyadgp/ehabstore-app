import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users,
  DollarSign,
  TrendingUp,
  Copy,
  Check,
  Receipt,
  Gift,
  ArrowLeft,
  Lock,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/account";
import { PageHeader } from "@/components/admin/ui/AdminUI";
import { createInfluencer, requestInfluencerWithdrawal } from "@/lib/influencer.functions";

export const Route = createFileRoute("/influencer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "برنامج المؤثرين | إيهاب ستور" },
      {
        name: "description",
        content: "برنامج المؤثرين في إيهاب ستور: تابع روابطك التسويقية وعمولاتك وطلبات السحب.",
      },
      { property: "og:title", content: "برنامج المؤثرين | إيهاب ستور" },
      {
        property: "og:description",
        content: "برنامج المؤثرين في إيهاب ستور: تابع روابطك التسويقية وعمولاتك وطلبات السحب.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InfluencerPortalPage,
});

function InfluencerPortalPage() {
  const queryClient = useQueryClient();
  const { userId, loading: loadingSession } = useSessionUser();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"earnings" | "withdrawals">("earnings");

  // Modals
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Withdraw form state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("kuraimi");
  const [payoutDetails, setPayoutDetails] = useState("");

  // Self registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    email: "",
    code: "",
  });

  // Server actions
  const registerInfluencerFn = useServerFn(createInfluencer);
  const requestWithdrawFn = useServerFn(requestInfluencerWithdrawal);

  // 1. Query for checking if user is an influencer
  const { data: influencerProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["my-influencer-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("influencers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // 2. Query for influencer earnings (referral commission history)
  const { data: myEarnings = [], isLoading: isLoadingEarnings } = useQuery({
    queryKey: ["my-earnings", influencerProfile?.id],
    queryFn: async () => {
      if (!influencerProfile?.id) return [];
      const { data, error } = await supabase
        .from("affiliate_earnings")
        .select("*")
        .eq("influencer_id", influencerProfile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!influencerProfile?.id,
  });

  // 3. Query for influencer withdrawal requests
  const { data: myWithdrawals = [], isLoading: isLoadingWithdrawals } = useQuery({
    queryKey: ["my-withdrawals", influencerProfile?.id],
    queryFn: async () => {
      if (!influencerProfile?.id) return [];
      const { data, error } = await supabase
        .from("affiliate_withdrawals")
        .select("*")
        .eq("influencer_id", influencerProfile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!influencerProfile?.id,
  });

  // Mutations
  const registerMutation = useMutation({
    mutationFn: async (data: typeof regForm) => {
      return registerInfluencerFn({
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          code: data.code.trim().toUpperCase(),
          commissionPercent: 10,
          notes: "تسجيل ذاتي عبر البوابة الإلكترونية",
        },
      });
    },
    onSuccess: async (created: any) => {
      // Link the created influencer profile with current user_id
      const { error } = await supabase
        .from("influencers")
        .update({ user_id: userId } as never)
        .eq("id", created.id);

      if (error) {
        toast.error("حدث خطأ أثناء ربط الحساب، يرجى الاتصال بالدعم");
      } else {
        queryClient.invalidateQueries({ queryKey: ["my-influencer-profile"] });
        toast.success("تهانينا! تم تفعيل حسابك كمسوقة بالعمولة بنجاح 🌸");
        setIsRegistering(false);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء التسجيل، يرجى المحاولة بكود آخر");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: number; method: string; details: string }) => {
      if (!influencerProfile) throw new Error("لا يوجد ملف تعريف مؤثر");
      return requestWithdrawFn({
        data: {
          influencerId: influencerProfile.id,
          amount: data.amount,
          payoutMethod: data.method,
          payoutDetails: data.details,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["my-influencer-profile"] });
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      setPayoutDetails("");
      toast.success("تم إرسال طلب السحب بنجاح، جاري مراجعته من قبل الإدارة 💸");
    },
    onError: (err: any) => {
      toast.error(err.message || "فشل إرسال طلب السحب");
    },
  });

  // Prefill registration phone if possible
  useEffect(() => {
    if (userId && !regForm.phone) {
      supabase.auth.getUser().then(({ data }) => {
        const phone = data.user?.phone || "";
        if (phone) {
          setRegForm((prev) => ({ ...prev, phone: phone.replace(/^\+967/, "") }));
        }
      });
    }
  }, [userId, regForm.phone]);

  const handleCopyLink = () => {
    if (!influencerProfile) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/?ref=${influencerProfile.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("تم نسخ رابط الإحالة المباشر الخاص بكِ! 🌸");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!influencerProfile) return;
    navigator.clipboard.writeText(influencerProfile.code);
    setCopiedCode(true);
    toast.success("تم نسخ كود الخصم! 💖");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (amount <= 0 || isNaN(amount)) {
      toast.error("الرجاء إدخال مبلغ سحب صحيح");
      return;
    }
    withdrawMutation.mutate({
      amount,
      method: payoutMethod,
      details: payoutDetails,
    });
  };

  const handleRegSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(regForm);
  };

  // 1. Loading state
  if (loadingSession || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-[#FCF5F5] flex items-center justify-center p-4">
        <div className="text-[#B34D5F] font-bold animate-pulse text-lg">جاري تحميل البوابة...</div>
      </div>
    );
  }

  // 2. Guest landing page (If not logged in)
  if (!userId) {
    return (
      <div className="min-h-screen bg-[#FCF5F5] text-slate-800 py-12 px-4" dir="rtl">
        <div className="max-w-xl mx-auto bg-white rounded-[32px] border border-[#F0D5D8] overflow-hidden shadow-[0_8px_30px_rgba(179,77,95,0.03)]">
          <div className="p-8 bg-gradient-to-b from-[#FFF2F4] to-white text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-[#FCECEF] flex items-center justify-center text-[#B34D5F] shadow-inner">
              <Gift className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-[#823341]">بوابة التسويق بالعمولة</h1>
            <p className="text-slate-500 font-medium leading-relaxed">
              انضمي الآن لبرنامج المؤثرين والمسوقين بالعمولة لـ{" "}
              <strong className="text-[#B34D5F]">إيهاب ستور للعناية والتجميل</strong>، وشاركي
              منتجاتنا الرائعة مع جمهوركِ واحصلي على عمولات مجزية وفورية!
            </p>
          </div>

          <div className="p-8 space-y-6">
            <h3 className="font-bold text-slate-700 text-sm border-r-4 border-[#B34D5F] pr-3">
              مميزات برنامج المؤثرين معنا:
            </h3>

            <div className="grid grid-cols-1 gap-4 text-sm font-semibold text-slate-600">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  ✓
                </div>
                <p>
                  عمولة مبيعات مرتفعة تبلغ <span className="text-[#B34D5F] font-bold">10%</span> على
                  كل طلب ناجح يتم من خلالكِ.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  ✓
                </div>
                <p>رابط تتبع ذكي وكود خصم مخصص لجمهوركِ بنقرة واحدة.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  ✓
                </div>
                <p>
                  سحب سهل وسريع لأرباحكِ عبر حساب{" "}
                  <span className="text-[#B34D5F] font-bold">الكريمي</span> أو محفظة جوال.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#FCECEF]">
              <Link
                to="/auth"
                search={{ next: "/influencer" }}
                className="w-full py-4 bg-gradient-to-r from-[#D48995] to-[#B34D5F] text-white font-bold text-center rounded-2xl shadow-md hover:opacity-95 flex items-center justify-center gap-2 transition-all"
              >
                <LogIn className="w-5 h-5" />
                تسجيل الدخول لبدء الأرباح الآن ✨
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Registered but status pending/suspended OR has no profile (Self registration form)
  if (!influencerProfile) {
    return (
      <div className="min-h-screen bg-[#FCF5F5] text-slate-800 py-12 px-4" dir="rtl">
        <div className="max-w-lg mx-auto bg-white rounded-[32px] border border-[#F0D5D8] overflow-hidden shadow-[0_8px_30px_rgba(179,77,95,0.03)]">
          <div className="p-6 bg-[#FFF9FA] border-b border-[#F0D5D8] flex items-center justify-between">
            <h3 className="text-lg font-black text-[#823341]">تفعيل حساب التسويق بالعمولة</h3>
            <Link
              to="/"
              className="text-slate-400 hover:text-[#B34D5F] flex items-center gap-1 text-xs font-bold"
            >
              <ChevronRight className="w-4 h-4" />
              العودة للمتجر
            </Link>
          </div>

          <form onSubmit={handleRegSubmit} className="p-6 space-y-4">
            <p className="text-xs font-semibold text-slate-500 leading-relaxed bg-[#FFF2F4] p-3.5 rounded-xl border border-[#F0D5D8]">
              يرجى ملء البيانات التالية لتوليد كود الخصم ورابط التتبع الخاص بكِ لتتمكني من بدء النشر
              فوراً وتتبع العمولات حياً!
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">اسمكِ الثلاثي</label>
              <input
                type="text"
                required
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                placeholder="الاسم الكامل لإرسال الأرباح عليه"
                className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-semibold text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  رقم هاتف تحويل الأرباح (الواتساب)
                </label>
                <input
                  type="tel"
                  required
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  placeholder="77xxxxxxx"
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-semibold text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  الكود التسويقي المفضل (إنجليزي)
                </label>
                <input
                  type="text"
                  required
                  value={regForm.code}
                  onChange={(e) =>
                    setRegForm({
                      ...regForm,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                    })
                  }
                  placeholder="SARA10"
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-mono font-bold text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">
                البريد الإلكتروني (اختياري)
              </label>
              <input
                type="email"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                placeholder="sara@example.com"
                className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none text-sm"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full py-3.5 text-white font-bold bg-gradient-to-r from-[#D48995] to-[#B34D5F] rounded-2xl hover:opacity-95 shadow-md disabled:opacity-50"
              >
                {registerMutation.isPending
                  ? "جاري تسجيل حسابكِ..."
                  : "تسجيل وتفعيل حسابي كمسوقة ✨"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 4. If account is suspended
  if (influencerProfile.status !== "active") {
    return (
      <div
        className="min-h-screen bg-[#FCF5F5] flex items-center justify-center p-4 text-center"
        dir="rtl"
      >
        <div className="max-w-md bg-white p-8 rounded-[32px] border border-[#F0D5D8] shadow-sm space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-[#823341]">حساب المؤثر موقف مؤقتاً</h2>
          <p className="text-slate-500 text-sm font-semibold leading-relaxed">
            حساب التسويق بالعمولة الخاص بكِ غير مفعّل حالياً أو تم إيقافه مؤقتاً من قبل الإدارة.
            يرجى مراجعة الدعم الفني أو الاتصال بالمتجر لتنشيط الحساب لبدء استلام العمولات.
          </p>
          <Link
            to="/"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-[#FCECEF] text-[#B34D5F] font-bold border border-[#F0D5D8]"
          >
            تصفح المتجر
          </Link>
        </div>
      </div>
    );
  }

  // 5. Active Influencer Dashboard
  return (
    <div className="min-h-screen bg-[#FCF5F5] text-slate-800 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Panel */}
        <div className="bg-white p-6 rounded-[28px] border border-[#F0D5D8] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PageHeader
            icon={TrendingUp}
            title={`مرحباً بكِ، ${influencerProfile.name} ✨`}
            subtitle="لوحة تحكم المسوقة بالعمولة - تابعي مبيعاتك وأرباحك أولاً بأول"
          />
          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            disabled={Number(influencerProfile.balance) <= 0}
            className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-[#D48995] to-[#B34D5F] disabled:opacity-50 hover:opacity-90 transition-all shadow-md self-start md:self-auto"
          >
            طلب سحب الأرباح 💸
          </button>
        </div>

        {/* Dynamic Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Available Balance */}
          <div className="bg-white p-6 rounded-[24px] border border-[#F0D5D8] shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold">الرصيد المتاح للسحب</span>
              <h3 className="text-2xl font-black text-[#B34D5F]">
                {Number(influencerProfile.balance || 0).toLocaleString()}{" "}
                <span className="text-xs font-bold">YER</span>
              </h3>
            </div>
            <div className="w-12 h-12 bg-[#FFF2F4] text-[#B34D5F] rounded-2xl flex items-center justify-center font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Total Earnings */}
          <div className="bg-white p-6 rounded-[24px] border border-[#F0D5D8] shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold">
                إجمالي الأرباح المستلمة والمحققة
              </span>
              <h3 className="text-2xl font-black text-[#823341]">
                {Number(influencerProfile.total_earned || 0).toLocaleString()}{" "}
                <span className="text-xs font-bold">YER</span>
              </h3>
            </div>
            <div className="w-12 h-12 bg-[#FFF9FA] text-[#823341] rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Commission rate */}
          <div className="bg-white p-6 rounded-[24px] border border-[#F0D5D8] shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold">نسبة عمولتكِ الحالية</span>
              <h3 className="text-2xl font-black text-emerald-600">
                {influencerProfile.commission_percent}%
              </h3>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Gift className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* DIRECT COPIES LINKS BOX */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-[28px] border border-[#F0D5D8] shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500">
              رابط الإحالة المباشر الخاص بكِ
            </label>
            <div className="flex rounded-2xl border border-[#F0D5D8] bg-[#FFF9FA] overflow-hidden p-1">
              <input
                type="text"
                readOnly
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/?ref=${influencerProfile.code}`
                    : ""
                }
                className="w-full px-3 py-2 bg-transparent text-xs font-mono font-bold text-slate-600 outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-[#FCECEF] text-[#B34D5F] hover:bg-[#F9DFE3] rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedLink ? "تم النسخ" : "نسخ الرابط"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500">كود خصم التتبع لجمهوركِ</label>
            <div className="flex rounded-2xl border border-[#F0D5D8] bg-[#FFF9FA] overflow-hidden p-1">
              <input
                type="text"
                readOnly
                value={influencerProfile.code}
                className="w-full px-3 py-2 bg-transparent font-mono font-bold text-center text-sm text-[#823341] outline-none"
              />
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-[#FCECEF] text-[#B34D5F] hover:bg-[#F9DFE3] rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 transition-colors"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedCode ? "تم النسخ" : "نسخ الكود"}
              </button>
            </div>
          </div>
        </div>

        {/* TABS INTERACTIVE */}
        <div className="space-y-4">
          <div className="flex border-b border-[#F0D5D8] gap-4">
            <button
              onClick={() => setActiveTab("earnings")}
              className={`pb-3 px-4 text-sm font-bold transition-all ${
                activeTab === "earnings"
                  ? "text-[#B34D5F] border-b-2 border-[#B34D5F]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              سجل العمولات والأرباح
            </button>
            <button
              onClick={() => setActiveTab("withdrawals")}
              className={`pb-3 px-4 text-sm font-bold transition-all ${
                activeTab === "withdrawals"
                  ? "text-[#B34D5F] border-b-2 border-[#B34D5F]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              سجل طلبات سحب الأرباح
            </button>
          </div>

          {/* Earnings History list */}
          {activeTab === "earnings" && (
            <div className="bg-white rounded-3xl border border-[#F0D5D8] overflow-hidden shadow-sm">
              {isLoadingEarnings ? (
                <div className="p-12 text-center text-slate-400">جاري تحميل سجل المبيعات...</div>
              ) : myEarnings.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  لم يتم تسجيل مبيعات عبر الكود الخاص بكِ بعد. شاركي رابطكِ لتفعيل الأرباح! 💖
                </div>
              ) : (
                <div className="divide-y divide-[#FCECEF]">
                  {myEarnings.map((earn: any) => (
                    <div
                      key={earn.id}
                      className="p-4 flex items-center justify-between hover:bg-[#FFFDFD] transition-colors"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-700 block">
                          طلب رقم: #{earn.order_number || "—"}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          قيمة مشتريات المنتجات: {Number(earn.order_total).toLocaleString()} YER
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-black text-[#B34D5F] block">
                          +{Number(earn.commission_amount).toLocaleString()} YER
                        </span>
                        <span className="text-[9px] text-slate-400 font-semibold block">
                          عمولة {earn.commission_percent}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Withdraw History list */}
          {activeTab === "withdrawals" && (
            <div className="bg-white rounded-3xl border border-[#F0D5D8] overflow-hidden shadow-sm">
              {isLoadingWithdrawals ? (
                <div className="p-12 text-center text-slate-400">جاري تحميل طلبات السحب...</div>
              ) : myWithdrawals.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  لم تقدمي أي طلبات سحب للأرباح حتى الآن.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-[#FFF9FA] border-b border-[#F0D5D8] text-[#823341] font-bold">
                        <th className="p-4">القيمة المطلوبة</th>
                        <th className="p-4">طريقة التحويل</th>
                        <th className="p-4">الحالة</th>
                        <th className="p-4">تاريخ التقديم</th>
                        <th className="p-4">ملاحظات الإدارة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FCECEF]">
                      {myWithdrawals.map((w: any) => (
                        <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-black text-slate-800">
                            {Number(w.amount).toLocaleString()} YER
                          </td>
                          <td className="p-4 text-slate-600 font-semibold">
                            {w.payout_method === "kuraimi"
                              ? "الكريمي"
                              : w.payout_method === "jawal"
                                ? "تحويل جوال"
                                : w.payout_method === "cash"
                                  ? "نقداً"
                                  : "تحويل بنكي"}
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                w.status === "completed" || w.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : w.status === "rejected"
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {w.status === "completed" || w.status === "approved"
                                ? "تم التحويل"
                                : w.status === "rejected"
                                  ? "مرفوض"
                                  : "قيد المراجعة"}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 text-xs">
                            {new Date(w.created_at).toLocaleDateString("ar-YE")}
                          </td>
                          <td
                            className="p-4 text-slate-500 font-semibold max-w-[150px] truncate"
                            title={w.admin_notes}
                          >
                            {w.admin_notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WITHDRAW MODAL REQUEST */}
      {isWithdrawModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          dir="rtl"
        >
          <div className="bg-white w-full max-w-md rounded-[28px] border border-[#F0D5D8] overflow-hidden shadow-xl animate-scaleIn">
            <div className="p-6 bg-[#FFF9FA] border-b border-[#F0D5D8] flex items-center justify-between">
              <h3 className="text-lg font-black text-[#823341]">تقديم طلب سحب الأرباح</h3>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div className="p-4 bg-[#FFF2F4] rounded-2xl border border-[#F0D5D8]">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">رصيدك الحالي المتاح:</span>
                  <span className="text-[#B34D5F]">
                    {Number(influencerProfile.balance || 0).toLocaleString()} YER
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">المبلغ المراد سحبه (YER)</label>
                <input
                  type="number"
                  required
                  min="500"
                  max={Number(influencerProfile.balance)}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="الحد الأدنى 500 ر.ي"
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-bold text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">طريقة الاستلام المفضلة</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none bg-white font-bold text-sm"
                >
                  <option value="kuraimi">حساب الكريمي مميز</option>
                  <option value="jawal">حوالة جوال أو رقم الهاتف</option>
                  <option value="cash">نقداً من فرع المتجر</option>
                  <option value="bank">حساب بنكي آخر</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  بيانات حساب المستلم بالتفصيل
                </label>
                <textarea
                  required
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                  placeholder="أدخلي رقم الحساب أو اسم المستلم الرباعي ورقم التحويل بوضوح لتفادي التأخير..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none text-xs font-semibold leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-[#F0D5D8] text-slate-500 font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={withdrawMutation.isPending}
                  className="px-6 py-2.5 text-white font-bold bg-gradient-to-r from-[#D48995] to-[#B34D5F] rounded-xl hover:opacity-95 shadow"
                >
                  {withdrawMutation.isPending ? "جاري الإرسال..." : "تأكيد وإرسال الطلب ✨"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
