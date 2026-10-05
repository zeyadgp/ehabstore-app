import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  FileText,
  X,
  ExternalLink,
  Download,
  Upload,
} from "lucide-react";
import { useSuppliers, Supplier } from "@/lib/suppliers";
import { useAdminCurrency } from "@/lib/admin";

export const Route = createFileRoute("/admin/suppliers")({
  component: AdminSuppliersPage,
});

function AdminSuppliersPage() {
  const { suppliers, saveSuppliers, isSaving, isLoading } = useSuppliers();
  const { label: currency } = useAdminCurrency();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [form, setForm] = useState<Partial<Supplier>>({
    name: "",
    company_name: "",
    phone: "",
    whatsapp: "",
    email: "",
    city: "صنعاء",
    address: "",
    balance: 0,
    payment_terms: "أجل 30 يوم",
    notes: "",
    status: "active",
  });

  const openNewModal = () => {
    setEditingSupplier(null);
    setForm({
      name: "",
      company_name: "",
      phone: "",
      whatsapp: "",
      email: "",
      city: "صنعاء",
      address: "",
      balance: 0,
      payment_terms: "أجل 30 يوم",
      notes: "",
      status: "active",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setForm({ ...sup });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.phone?.trim()) {
      toast.error("يرجى إدخال اسم المورد ورقم الهاتف على الأقل");
      return;
    }

    try {
      let updated: Supplier[];
      if (editingSupplier) {
        updated = suppliers.map((s) =>
          s.id === editingSupplier.id
            ? ({
                ...s,
                ...form,
                updated_at: new Date().toISOString(),
              } as Supplier)
            : s,
        );
        toast.success("تم تحديث بيانات المورد بنجاح");
      } else {
        const newSupplier: Supplier = {
          id: `sup-${Date.now()}`,
          name: form.name.trim(),
          company_name: form.company_name?.trim() || "",
          phone: form.phone.trim(),
          whatsapp: form.whatsapp?.trim() || form.phone.trim(),
          email: form.email?.trim() || "",
          city: form.city?.trim() || "صنعاء",
          address: form.address?.trim() || "",
          balance: Number(form.balance || 0),
          payment_terms: form.payment_terms || "أجل 30 يوم",
          notes: form.notes || "",
          status: form.status || "active",
          created_at: new Date().toISOString(),
        };
        updated = [newSupplier, ...suppliers];
        toast.success("تم إضافة المورد بنجاح");
      }

      await saveSuppliers(updated);
      setIsModalOpen(false);
    } catch {
      toast.error("حدث خطأ أثناء حفظ بيانات المورد");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المورد "${name}"؟`)) return;
    try {
      const updated = suppliers.filter((s) => s.id !== id);
      await saveSuppliers(updated);
      toast.success("تم حذف المورد بنجاح");
    } catch {
      toast.error("تعذر حذف المورد");
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.company_name && s.company_name.toLowerCase().includes(search.toLowerCase())) ||
      s.phone.includes(search) ||
      (s.city && s.city.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = filterStatus === "all" || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // إحصاءات سريعة
  const totalBalanceDue = suppliers.reduce((acc, s) => acc + Number(s.balance || 0), 0);
  const activeCount = suppliers.filter((s) => s.status === "active").length;

  const getWhatsappUrl = (phone: string, text: string) => {
    const clean = phone.replace(/[^0-9]/g, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportSuppliers = () => {
    try {
      const dataStr = JSON.stringify(suppliers, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suppliers-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير قائمة الموردين بنجاح");
    } catch {
      toast.error("تعذر تصدير البيانات");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let imported: Supplier[] = [];
      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed))
          throw new Error("ملف JSON غير صالح، يجب أن يحتوي على مصفوفة موردين");
        imported = parsed;
      } else {
        // Simple CSV parse
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length <= 1) throw new Error("الملف فارغ أو لا يحتوي على بيانات");
        const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        imported = lines.slice(1).map((line, idx) => {
          const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
          return {
            id: `sup-${Date.now()}-${idx}`,
            name: parts[0] || `مورد ${idx + 1}`,
            company_name: parts[1] || "",
            phone: parts[2] || "",
            whatsapp: parts[3] || parts[2] || "",
            email: parts[4] || "",
            city: parts[5] || "صنعاء",
            address: parts[6] || "",
            balance: Number(parts[7]) || 0,
            payment_terms: parts[8] || "أجل 30 يوم",
            notes: parts[9] || "",
            status: (parts[10] === "inactive" ? "inactive" : "active") as "active" | "inactive",
            created_at: new Date().toISOString(),
          };
        });
      }

      if (imported.length === 0) throw new Error("لم يتم العثور على أي موردين داخل الملف");

      // Merge with existing suppliers
      const existingIds = new Set(suppliers.map((s) => s.id));
      const existingPhones = new Set(suppliers.map((s) => s.phone));
      const newItems = imported.filter(
        (s) => !existingIds.has(s.id) && !existingPhones.has(s.phone),
      );
      const merged = [...suppliers, ...newItems];

      await saveSuppliers(merged);
      toast.success(`تم استيراد ${newItems.length} مورد بنجاح`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل استيراد الملف");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              إدارة الموردين والشركاء
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            تتبع الموردين، أرصدة الحسابات الآجلة، وشروط السداد مع إمكانية التواصل الفوري عبر واتساب.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportSuppliers}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-muted/80 transition"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير الموردين
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-muted/80 transition"
          >
            <Upload className="h-3.5 w-3.5" />
            استيراد
          </button>
          <button
            onClick={openNewModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            إضافة مورد جديد
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">إجمالي الموردين</span>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-foreground">{suppliers.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">شركات ومؤسسات مسجلة</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">الموردون النشطون</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">توريد نشط ومستمر</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">الأرصدة المستحقة</span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {totalBalanceDue.toLocaleString()} {currency}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">مستحقات للموردين قيد السداد</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">طريقة السداد الأكثر</span>
            <Clock className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-3 text-lg font-bold text-foreground">أجل 30 يوم</div>
          <p className="mt-1 text-xs text-muted-foreground">تسوية شهرية دورية</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="البحث باسم المورد، الشركة، المدينة، أو رقم الجوال..."
            className="w-full rounded-xl border border-border bg-background py-2 pr-9 pl-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
              filterStatus === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            الكل ({suppliers.length})
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
              filterStatus === "active"
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            النشطون ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus("inactive")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
              filterStatus === "inactive"
                ? "bg-amber-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            غير نشط ({suppliers.length - activeCount})
          </button>
        </div>
      </div>

      {/* Suppliers Cards Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          جارٍ تحميل قائمة الموردين...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-semibold text-foreground">لا يوجد موردون مطابقون للبحث</p>
          <p className="text-xs text-muted-foreground">
            يمكنك إضافة مورد جديد أو تغيير كلمات البحث.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredSuppliers.map((sup) => (
            <div
              key={sup.id}
              className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition hover:border-primary/50"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        sup.status === "active"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      {sup.status === "active" ? "نشط" : "غير نشط"}
                    </span>
                    <h3 className="mt-2 font-bold text-foreground">{sup.name}</h3>
                    {sup.company_name && (
                      <p className="text-xs text-muted-foreground">{sup.company_name}</p>
                    )}
                  </div>

                  <div className="text-left">
                    <span className="text-[11px] text-muted-foreground">الرصيد المستحق</span>
                    <div
                      className={`text-base font-extrabold ${
                        Number(sup.balance || 0) > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {Number(sup.balance || 0).toLocaleString()} {currency}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 space-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span dir="ltr">{sup.phone}</span>
                  </div>

                  {sup.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        {sup.city} {sup.address ? `- ${sup.address}` : ""}
                      </span>
                    </div>
                  )}

                  {sup.payment_terms && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>شروط الدفع: {sup.payment_terms}</span>
                    </div>
                  )}

                  {sup.notes && (
                    <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground/80 bg-muted/40 p-2 rounded-lg">
                      {sup.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <a
                    href={getWhatsappUrl(
                      sup.whatsapp || sup.phone,
                      `السلام عليكم ورحمة الله، بخصوص توريد منتجات متجر إيهاب ستور..`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    واتساب
                  </a>
                  <a
                    href={`tel:${sup.phone}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    اتصال
                  </a>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(sup)}
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    title="تعديل"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(sup.id, sup.name)}
                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute left-5 top-5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                {editingSupplier ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
              </h2>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground">اسم المورد *</label>
                <input
                  type="text"
                  required
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: مؤسسة الهدى لمستحضرات التجميل"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground">
                    اسم الشركة / المعرض
                  </label>
                  <input
                    type="text"
                    value={form.company_name || ""}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    placeholder="اسم المؤسسة التجارية"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground">المدينة</label>
                  <input
                    type="text"
                    value={form.city || ""}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="صنعاء / عدن / تعز..."
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground">
                    رقم الهاتف *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="96777xxxxxxx"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground">رقم واتساب</label>
                  <input
                    type="text"
                    value={form.whatsapp || ""}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="96777xxxxxxx"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground">
                    الرصيد المستحق للمورد ({currency})
                  </label>
                  <input
                    type="number"
                    value={form.balance ?? 0}
                    onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })}
                    placeholder="0"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground">شروط السداد</label>
                  <select
                    value={form.payment_terms || "أجل 30 يوم"}
                    onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="نقداً عند التسليم">نقداً عند التسليم</option>
                    <option value="أجل 15 يوم">أجل 15 يوم</option>
                    <option value="أجل 30 يوم">أجل 30 يوم</option>
                    <option value="دفعة 50% مقدماً">دفعة 50% مقدماً</option>
                    <option value="تحويل بنكي فوري">تحويل بنكي فوري</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  العنوان التفصيلي
                </label>
                <input
                  type="text"
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="الشارع، اسم العمارة أو المجمع التجاري"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  ملاحظات إضافية
                </label>
                <textarea
                  rows={3}
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="أي معلومات هامة حول المنتجات الموردة أو الاتفاقيات الخاصة..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="statusActive"
                  checked={form.status === "active"}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.checked ? "active" : "inactive" })
                  }
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
                <label
                  htmlFor="statusActive"
                  className="text-xs font-medium text-foreground cursor-pointer"
                >
                  مورد نشط (يتم التعامل وتوريد البضائع منه حالياً)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving ? "جارٍ الحفظ..." : "حفظ المورد"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
