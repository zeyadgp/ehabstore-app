import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/admin/ui/AdminUI";
import {
  Users,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  UserX,
  UserCheck,
  DollarSign,
  TrendingUp,
  Receipt,
  Eye,
  AlertCircle,
  X,
  CreditCard,
} from "lucide-react";
import {
  getAdminInfluencers,
  createInfluencer,
  updateInfluencer,
  getInfluencerEarnings,
  getAdminWithdrawals,
  processWithdrawal,
} from "@/lib/influencer.functions";

export const Route = createFileRoute("/admin/influencers")({
  component: AdminInfluencersPage,
});

function AdminInfluencersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"list" | "payouts">("list");

  // Modals status
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState<any | null>(null);
  const [viewingEarnings, setViewingEarnings] = useState<any | null>(null);
  const [processingPayout, setProcessingPayout] = useState<any | null>(null);

  // Clipboard copies
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    code: "",
    commissionPercent: 10,
    notes: "",
  });

  const [payoutNotes, setPayoutNotes] = useState("");

  // Server functions
  const fetchInfluencers = useServerFn(getAdminInfluencers);
  const fetchWithdrawals = useServerFn(getAdminWithdrawals);
  const fetchEarnings = useServerFn(getInfluencerEarnings);

  const createFn = useServerFn(createInfluencer);
  const updateFn = useServerFn(updateInfluencer);
  const processPayoutFn = useServerFn(processWithdrawal);

  // Queries
  const { data: influencers = [], isLoading: isLoadingInfluencers } = useQuery({
    queryKey: ["admin-influencers"],
    queryFn: () => fetchInfluencers(),
  });

  const { data: withdrawals = [], isLoading: isLoadingWithdrawals } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: () => fetchWithdrawals(),
  });

  const { data: earnings = [], isLoading: isLoadingEarnings } = useQuery({
    queryKey: ["influencer-earnings", viewingEarnings?.id],
    queryFn: () => fetchEarnings({ data: viewingEarnings?.id }),
    enabled: !!viewingEarnings?.id,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => createFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-influencers"] });
      setIsCreateOpen(false);
      resetForm();
      alert("تم تسجيل المؤثر الجديد بنجاح ✨");
    },
    onError: (err: any) => {
      alert(err.message || "حدث خطأ أثناء التسجيل");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-influencers"] });
      setEditingInfluencer(null);
      alert("تم تحديث بيانات المؤثر بنجاح");
    },
    onError: (err: any) => {
      alert(err.message || "حدث خطأ أثناء التحديث");
    },
  });

  const processPayoutMutation = useMutation({
    mutationFn: (data: {
      id: string;
      status: "approved" | "rejected" | "completed";
      adminNotes: string;
    }) => processPayoutFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-influencers"] });
      setProcessingPayout(null);
      setPayoutNotes("");
      alert("تمت معالجة طلب سحب الأرباح وتحديث الرصيد بنجاح 💸");
    },
    onError: (err: any) => {
      alert(err.message || "فشلت معالجة الطلب");
    },
  });

  // Helpers
  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      code: "",
      commissionPercent: 10,
      notes: "",
    });
  };

  const handleCopy = (code: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/?ref=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      id: editingInfluencer.id,
      name: editingInfluencer.name,
      phone: editingInfluencer.phone,
      email: editingInfluencer.email,
      code: editingInfluencer.code,
      commissionPercent: Number(editingInfluencer.commission_percent),
      status: editingInfluencer.status,
      notes: editingInfluencer.notes,
    });
  };

  const handlePayoutDecision = (status: "approved" | "rejected" | "completed") => {
    if (!processingPayout) return;
    processPayoutMutation.mutate({
      id: processingPayout.id,
      status,
      adminNotes: payoutNotes,
    });
  };

  // Stats calculation
  const totalInfluencers = influencers.length;
  const totalEarnedAmount = influencers.reduce(
    (sum, inf) => sum + Number(inf.total_earned || 0),
    0,
  );
  const pendingPayoutsCount = withdrawals.filter((w) => w.status === "pending").length;

  return (
    <div className="min-h-screen bg-[#FCF5F5] text-slate-800 p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-[28px] border border-[#F0D5D8] shadow-[0_8px_30px_rgba(179,77,95,0.03)]">
          <PageHeader
            icon={Users}
            title="نظام المؤثرين والتسويق بالعمولة"
            subtitle="متابعة وتحليل أداء المسوقين والعمولات وصرف الأرباح"
          />
          <button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-bold bg-gradient-to-r from-[#D48995] to-[#B34D5F] hover:opacity-90 shadow-md self-start md:self-auto transition-all"
          >
            <Plus className="w-5 h-5" />
            إضافة مؤثر جديد
          </button>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Influencers Card */}
          <div className="bg-white p-6 rounded-[24px] border border-[#F0D5D8] shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm text-slate-500 font-medium">إجمالي المؤثرين</span>
              <h3 className="text-3xl font-black text-[#823341]">{totalInfluencers}</h3>
            </div>
            <div className="w-12 h-12 bg-[#FFF2F4] text-[#B34D5F] rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Total Commissions Paid */}
          <div className="bg-white p-6 rounded-[24px] border border-[#F0D5D8] shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm text-slate-500 font-medium">إجمالي العمولات المحتسبة</span>
              <h3 className="text-3xl font-black text-[#823341]">
                {totalEarnedAmount.toLocaleString()}{" "}
                <span className="text-base font-medium">ر.ي</span>
              </h3>
            </div>
            <div className="w-12 h-12 bg-[#FFF2F4] text-[#B34D5F] rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Pending Withdrawals */}
          <div className="bg-white p-6 rounded-[24px] border border-[#F0D5D8] shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm text-slate-500 font-medium">طلبات سحب معلقة</span>
              <h3 className="text-3xl font-black text-amber-600">
                {pendingPayoutsCount} <span className="text-base font-medium">طلب</span>
              </h3>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#F0D5D8] gap-4">
          <button
            onClick={() => setActiveTab("list")}
            className={`pb-3 px-4 text-base font-bold transition-all relative ${
              activeTab === "list"
                ? "text-[#B34D5F] border-b-2 border-[#B34D5F]"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            قائمة المؤثرين
          </button>
          <button
            onClick={() => setActiveTab("payouts")}
            className={`pb-3 px-4 text-base font-bold transition-all relative ${
              activeTab === "payouts"
                ? "text-[#B34D5F] border-b-2 border-[#B34D5F]"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            إدارة طلبات السحب
            {pendingPayoutsCount > 0 && (
              <span className="mr-2 px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full font-black animate-pulse">
                {pendingPayoutsCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab content 1: LIST */}
        {activeTab === "list" && (
          <div className="bg-white rounded-3xl border border-[#F0D5D8] overflow-hidden shadow-sm">
            {isLoadingInfluencers ? (
              <div className="p-12 text-center text-slate-500">جاري تحميل المؤثرين...</div>
            ) : influencers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-4">
                <p>لا يوجد أي مؤثر مسجل حتى الآن.</p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 bg-[#FCECEF] text-[#B34D5F] rounded-xl font-bold border border-[#F0D5D8]"
                >
                  اضغط لإضافة أول مؤثر
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#FFF9FA] text-[#823341] border-b border-[#F0D5D8] font-bold">
                      <th className="p-4">الاسم</th>
                      <th className="p-4">الكود التسويقي</th>
                      <th className="p-4">النسبة</th>
                      <th className="p-4">المبيعات</th>
                      <th className="p-4">الرصيد المستحق</th>
                      <th className="p-4">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FCECEF]">
                    {influencers.map((inf: any) => (
                      <tr key={inf.id} className="hover:bg-[#FFFDFD] transition-colors">
                        <td className="p-4 font-bold text-slate-800">
                          <div>{inf.name}</div>
                          <div className="text-xs text-slate-400 font-normal">{inf.phone}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-[#FCECEF] px-2.5 py-1 rounded-lg text-[#B34D5F] font-mono font-bold text-sm">
                            {inf.code}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-600">
                          {inf.commission_percent}%
                        </td>
                        <td className="p-4 text-slate-600 font-semibold">
                          {Number(inf.total_earned || 0).toLocaleString()} ر.ي
                        </td>
                        <td className="p-4 text-[#B34D5F] font-black">
                          {Number(inf.balance || 0).toLocaleString()} ر.ي
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              inf.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {inf.status === "active" ? "نشط" : "موقف"}
                          </span>
                        </td>
                        <td className="p-4 flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleCopy(inf.code)}
                            title="نسخ الرابط التسويقي"
                            className="p-2 text-slate-500 hover:bg-[#FCECEF] hover:text-[#B34D5F] rounded-xl transition-all"
                          >
                            {copiedCode === inf.code ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setViewingEarnings(inf)}
                            title="سجل العمولات والمبيعات"
                            className="p-2 text-slate-500 hover:bg-[#FCECEF] hover:text-[#B34D5F] rounded-xl transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingInfluencer(inf)}
                            title="تعديل البيانات"
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const nextStatus = inf.status === "active" ? "suspended" : "active";
                              updateMutation.mutate({
                                ...inf,
                                commissionPercent: Number(inf.commission_percent),
                                status: nextStatus,
                              });
                            }}
                            title={inf.status === "active" ? "إيقاف الحساب" : "تنشيط الحساب"}
                            className={`p-2 rounded-xl transition-all ${
                              inf.status === "active"
                                ? "text-rose-600 hover:bg-rose-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {inf.status === "active" ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab content 2: PAYOUTS */}
        {activeTab === "payouts" && (
          <div className="bg-white rounded-3xl border border-[#F0D5D8] overflow-hidden shadow-sm">
            {isLoadingWithdrawals ? (
              <div className="p-12 text-center text-slate-500">جاري تحميل طلبات السحب...</div>
            ) : withdrawals.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                لا يوجد أي طلبات سحب أرباح حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#FFF9FA] text-[#823341] border-b border-[#F0D5D8] font-bold">
                      <th className="p-4">المؤثر</th>
                      <th className="p-4">القيمة المطلوبة</th>
                      <th className="p-4">طريقة التحويل</th>
                      <th className="p-4">بيانات المستلم</th>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FCECEF]">
                    {withdrawals.map((w: any) => (
                      <tr key={w.id} className="hover:bg-[#FFFDFD] transition-colors">
                        <td className="p-4 font-bold text-slate-800">
                          <div>{w.influencer?.name || "مؤثر غير معروف"}</div>
                          <div className="text-xs text-[#B34D5F] font-mono">
                            {w.influencer?.code}
                          </div>
                        </td>
                        <td className="p-4 text-[#823341] font-black">
                          {Number(w.amount).toLocaleString()} {w.currency}
                        </td>
                        <td className="p-4 font-medium text-slate-600">
                          {w.payout_method === "kuraimi"
                            ? "الكريمي"
                            : w.payout_method === "jawal"
                              ? "تحويل جوال"
                              : w.payout_method === "cash"
                                ? "نقداً"
                                : "تحويل بنكي"}
                        </td>
                        <td
                          className="p-4 text-slate-500 text-sm max-w-[200px] truncate"
                          title={w.payout_details}
                        >
                          {w.payout_details}
                        </td>
                        <td className="p-4 text-slate-400 text-xs">
                          {new Date(w.created_at).toLocaleDateString("ar-YE")}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              w.status === "completed" || w.status === "approved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : w.status === "rejected"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {w.status === "completed" || w.status === "approved"
                              ? "تم الدفع"
                              : w.status === "rejected"
                                ? "مرفوض"
                                : "قيد المراجعة"}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {w.status === "pending" ? (
                            <button
                              onClick={() => setProcessingPayout(w)}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#D48995] to-[#B34D5F] rounded-xl shadow hover:opacity-90"
                            >
                              مراجعة واعتماد
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400" title={w.admin_notes}>
                              {w.admin_notes || "مكتمل"}
                            </span>
                          )}
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

      {/* MODAL 1: ADD NEW INFLUENCER */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-[28px] border border-[#F0D5D8] overflow-hidden shadow-xl animate-scaleIn">
            <div className="p-6 bg-[#FFF9FA] border-b border-[#F0D5D8] flex items-center justify-between">
              <h3 className="text-lg font-black text-[#823341]">إضافة مؤثر جديد في المتجر</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  الاسم الثلاثي أو المستعار للمؤثر
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: سارة محمد اليماني"
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] focus:ring-1 focus:ring-[#B34D5F] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">
                    رقم الهاتف للتواصل والتحويل
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="77xxxxxxx"
                    className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">
                    كود الخصم / التتبع الإنجليزي
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                      })
                    }
                    placeholder="SARA10"
                    className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">
                    نسبة العمولة (افتراضي 10%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={formData.commissionPercent}
                    onChange={(e) =>
                      setFormData({ ...formData, commissionPercent: Number(e.target.value) })
                    }
                    className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">
                    البريد الإلكتروني (اختياري)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none text-left"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  طريقة الدفع والحساب (مثال: كريمي مميز)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="أدخل حساب الكريمي، رقم المحفظة، أو أي تفاصيل تسليم مالي تهم الإدارة..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-[#F0D5D8] text-slate-500 hover:bg-slate-50 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-6 py-2.5 rounded-xl text-white font-bold bg-gradient-to-r from-[#D48995] to-[#B34D5F] hover:opacity-95"
                >
                  {createMutation.isPending ? "جاري الحفظ..." : "إضافة المؤثر مفعّلاً"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT INFLUENCER */}
      {editingInfluencer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-[28px] border border-[#F0D5D8] overflow-hidden shadow-xl animate-scaleIn">
            <div className="p-6 bg-[#FFF9FA] border-b border-[#F0D5D8] flex items-center justify-between">
              <h3 className="text-lg font-black text-[#823341]">تعديل بيانات المؤثر</h3>
              <button
                onClick={() => setEditingInfluencer(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">الاسم</label>
                <input
                  type="text"
                  required
                  value={editingInfluencer.name}
                  onChange={(e) =>
                    setEditingInfluencer({ ...editingInfluencer, name: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">الهاتف</label>
                  <input
                    type="tel"
                    required
                    value={editingInfluencer.phone}
                    onChange={(e) =>
                      setEditingInfluencer({ ...editingInfluencer, phone: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">كود الخصم / التتبع</label>
                  <input
                    type="text"
                    required
                    value={editingInfluencer.code}
                    onChange={(e) =>
                      setEditingInfluencer({
                        ...editingInfluencer,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                      })
                    }
                    className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">العمولة %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={editingInfluencer.commission_percent}
                    onChange={(e) =>
                      setEditingInfluencer({
                        ...editingInfluencer,
                        commission_percent: Number(e.target.value),
                      })
                    }
                    className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">الحالة</label>
                  <select
                    value={editingInfluencer.status}
                    onChange={(e) =>
                      setEditingInfluencer({ ...editingInfluencer, status: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none bg-white font-semibold"
                  >
                    <option value="active">نشط</option>
                    <option value="suspended">موقف</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  حسابات التوصيل والملاحظات المالية
                </label>
                <textarea
                  value={editingInfluencer.notes || ""}
                  onChange={(e) =>
                    setEditingInfluencer({ ...editingInfluencer, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingInfluencer(null)}
                  className="px-5 py-2.5 rounded-xl border border-[#F0D5D8] text-slate-500 hover:bg-slate-50 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-6 py-2.5 rounded-xl text-white font-bold bg-gradient-to-r from-[#D48995] to-[#B34D5F]"
                >
                  {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW INFLUENCER EARNINGS (SALES RECORD) */}
      {viewingEarnings && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-[28px] border border-[#F0D5D8] overflow-hidden shadow-xl animate-scaleIn">
            <div className="p-6 bg-[#FFF9FA] border-b border-[#F0D5D8] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-[#823341]">سجل إحالات وعمولات المؤثر</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {viewingEarnings.name} ({viewingEarnings.code})
                </p>
              </div>
              <button
                onClick={() => setViewingEarnings(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
              {isLoadingEarnings ? (
                <div className="py-8 text-center text-slate-500">جاري تحميل سجل المبيعات...</div>
              ) : earnings.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  لا توجد أي مبيعات مسجلة لهذا المؤثر حتى الآن.
                </div>
              ) : (
                <div className="space-y-2">
                  {earnings.map((earn: any) => (
                    <div
                      key={earn.id}
                      className="p-4 bg-[#FFF9FA] rounded-2xl border border-[#FCECEF] flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-700">
                            طلب رقم: {earn.order_number || "—"}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({new Date(earn.created_at).toLocaleDateString("ar-YE")})
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          قيمة سلة المنتجات الإجمالية:{" "}
                          <span className="font-bold">
                            {Number(earn.order_total).toLocaleString()} YER
                          </span>
                        </div>
                      </div>
                      <div className="text-left space-y-1">
                        <div className="text-sm text-emerald-600 font-black">
                          +{Number(earn.commission_amount).toLocaleString()} YER
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          عمولة بنسبة {earn.commission_percent}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingEarnings(null)}
                className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 shadow-sm"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PROCESS PAYOUT REQUEST */}
      {processingPayout && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-[28px] border border-[#F0D5D8] overflow-hidden shadow-xl animate-scaleIn">
            <div className="p-6 bg-[#FFF9FA] border-b border-[#F0D5D8] flex items-center justify-between">
              <h3 className="text-lg font-black text-[#823341]">مراجعة واعتماد طلب السحب</h3>
              <button
                onClick={() => setProcessingPayout(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-[#FFF2F4] rounded-2xl border border-[#F0D5D8] space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-semibold">اسم المؤثر:</span>
                  <span className="text-[#823341] font-bold">
                    {processingPayout.influencer?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-semibold">المبلغ المطلوب سحبه:</span>
                  <span className="text-[#B34D5F] font-black text-lg">
                    {Number(processingPayout.amount).toLocaleString()} YER
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-semibold">رصيد المؤثر الحالي:</span>
                  <span className="font-bold text-slate-700">
                    {(
                      influencers.find((i: any) => i.id === processingPayout.influencer_id)
                        ?.balance || 0
                    ).toLocaleString()}{" "}
                    YER
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-[#F0D5D8]/40 pt-2">
                  <span className="text-slate-500 font-semibold">طريقة الدفع والحساب:</span>
                  <span
                    className="font-bold text-slate-800 text-left truncate max-w-[220px]"
                    title={processingPayout.payout_details}
                  >
                    {processingPayout.payout_details}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  ملاحظات التحويل (تظهر للمؤثر)
                </label>
                <textarea
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="مثال: تم إرسال الحوالة بنجاح، رقم الحوالة: 2093847"
                  rows={3}
                  className="w-full p-3 rounded-xl border border-[#F0D5D8] focus:border-[#B34D5F] outline-none text-sm"
                />
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handlePayoutDecision("rejected")}
                  disabled={processPayoutMutation.isPending}
                  className="flex-1 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold hover:bg-rose-100 transition-all"
                >
                  رفض الطلب
                </button>
                <button
                  type="button"
                  onClick={() => handlePayoutDecision("completed")}
                  disabled={processPayoutMutation.isPending}
                  className="flex-1 py-2.5 text-white bg-gradient-to-r from-[#D48995] to-[#B34D5F] rounded-xl font-bold hover:opacity-95 shadow transition-all"
                >
                  {processPayoutMutation.isPending ? "جاري المعالجة..." : "اعتماد الصرف"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
