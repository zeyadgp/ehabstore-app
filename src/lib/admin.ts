import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { currenciesQuery } from "@/lib/currency";
import {
  BUCKET,
  useSettings,
  type Category,
  type Product,
  type StoreSettingsFull,
} from "@/lib/store";

export type OrderStatus =
  | "new"
  | "reviewing"
  | "confirmed"
  | "processing"
  | "ready"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "returned"
  | "no_contact"
  | "on_hold";

export const statusLabels: Record<OrderStatus, string> = {
  new: "جديد",
  reviewing: "قيد المراجعة",
  confirmed: "تم التأكيد",
  processing: "قيد التجهيز",
  ready: "جاهز للشحن",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  completed: "مكتمل",
  cancelled: "ملغي",
  returned: "مرتجع",
  no_contact: "فشل التواصل",
  on_hold: "معلّق",
};

export const statusOrder: OrderStatus[] = [
  "new",
  "reviewing",
  "confirmed",
  "processing",
  "ready",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "returned",
  "no_contact",
  "on_hold",
];

export const statusColor: Record<OrderStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  reviewing: "bg-amber-100 text-amber-700",
  confirmed: "bg-indigo-100 text-indigo-700",
  processing: "bg-purple-100 text-purple-700",
  ready: "bg-teal-100 text-teal-700",
  shipped: "bg-cyan-100 text-cyan-700",
  delivered: "bg-lime-100 text-lime-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
  returned: "bg-orange-100 text-orange-700",
  no_contact: "bg-slate-200 text-slate-700",
  on_hold: "bg-yellow-100 text-yellow-800",
};

export type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  city: string;
  district: string | null;
  address: string;
  notes: string | null;
  total: number;
  delivery_fee: number | null;
  currency: string;
  currency_label: string | null;
  currency_rate: number | null;
  status: OrderStatus;
  payment_method: string | null;
  payment_status: string | null;
  receipt_url: string | null;
  last_contact_at: string | null;
  created_at: string;
  public_token?: string | null;
};

export type Invoice = {
  id: string;
  invoice_number: number;
  order_id: string;
  phone: string;
  customer_name: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  currency_label: string;
  payment_method: string | null;
  payment_status: string;
  points_awarded: number;
  issued_at: string;
};

export const paymentStatusLabels: Record<string, string> = {
  unpaid: "غير مدفوع",
  pending: "بانتظار المراجعة",
  paid: "مدفوع",
  refunded: "مسترجع",
  failed: "مرفوض",
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  color_name?: string | null;
  size_name?: string | null;
  image?: string | null;
};

export type AdminTestimonial = {
  id: string;
  customer_name: string;
  content: string;
  rating: number;
  is_visible: boolean;
  created_at: string;
};

/** All products including hidden ones (admin only, enforced by RLS). */
export function useAllProducts() {
  return useQuery({
    queryKey: ["admin", "products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Product[]) ?? [];
    },
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return (data as unknown as Category[]) ?? [];
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Order[]) ?? [];
    },
  });
}

export function useOrderItems() {
  return useQuery({
    queryKey: ["admin", "order-items"],
    queryFn: async (): Promise<OrderItem[]> => {
      const { data, error } = await supabase
        .from("order_items")
        .select(
          "id,order_id,product_id,product_name,quantity,price,color_name,size_name,image,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(3000);
      if (error) throw error;
      return (data as unknown as OrderItem[]) ?? [];
    },
  });
}

export function useAdminTestimonials() {
  return useQuery({
    queryKey: ["admin", "testimonials"],
    queryFn: async (): Promise<AdminTestimonial[]> => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as AdminTestimonial[]) ?? [];
    },
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async (): Promise<StoreSettingsFull | null> => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as StoreSettingsFull | null) ?? null;
    },
  });
}

function extOf(name: string) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name);
  return m?.[1]?.toLowerCase() ?? "jpg";
}

/** Uploads to the private bucket (auto WebP compression) and returns the storage path. */
export async function uploadImage(file: File, folder = "products"): Promise<string> {
  const optimized = await compressImage(file, { maxSize: 1600, quality: 0.85 });
  const isWebp = optimized.type === "image/webp" || optimized.name.endsWith(".webp");
  const ext = isWebp ? "webp" : extOf(optimized.name);
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, optimized, {
    cacheControl: "31536000",
    contentType: isWebp ? "image/webp" : optimized.type || "image/png",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeImage(path: string) {
  if (!path || path.startsWith("http")) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * العملة المفضّلة (الافتراضية) للمتجر — مصدر واحد لكل شاشات لوحة التحكم.
 * تعتمد على جدول العملات (is_default) وتعود لإعدادات المتجر عند غيابها.
 */
export function useAdminCurrency() {
  const { data: settings } = useSettings();
  const { data: currencies = [] } = useQuery(currenciesQuery);
  const def = currencies.find((c) => c.is_default) ?? currencies[0] ?? null;
  return {
    label: def?.symbol ?? settings?.currency_label ?? "ر.ي",
    code: def?.code ?? settings?.currency ?? "YER",
  };
}

export function useInvoices() {
  return useQuery({
    queryKey: ["admin", "invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("invoice_number", { ascending: false });
      if (error) throw error;
      return (data as unknown as Invoice[]) ?? [];
    },
  });
}

export type WaMessage = {
  id: string;
  order_id: string | null;
  phone: string;
  template: string | null;
  body: string;
  created_at: string;
};

export function useWhatsappMessages() {
  return useQuery({
    queryKey: ["admin", "wa-messages"],
    queryFn: async (): Promise<WaMessage[]> => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as unknown as WaMessage[]) ?? [];
    },
  });
}
