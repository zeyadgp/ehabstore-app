import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AbandonedCartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  sku?: string | null;
};

export type AbandonedCart = {
  id: string;
  customer_name: string;
  phone: string;
  city?: string | undefined;
  items: AbandonedCartItem[];
  total: number;
  created_at: string;
  last_updated: string;
  status: "pending" | "contacted" | "recovered" | "ignored";
  notes?: string | undefined;
  contacted_at?: string | undefined;
};

const ABANDONED_CARTS_KEY = "admin_abandoned_carts_list";

const INITIAL_DEMO_CARTS: AbandonedCart[] = [
  {
    id: "cart-101",
    customer_name: "سارة عبد الله الحميري",
    phone: "967771234890",
    city: "صنعاء",
    items: [
      {
        id: "p-1",
        name: "سيروم نياسيناميد 10% + زنك 1% - The Ordinary",
        price: 45,
        quantity: 2,
      },
      {
        id: "p-2",
        name: "غسول رغوي للبشرة العادية إلى الدهنية - CeraVe",
        price: 65,
        quantity: 1,
      },
    ],
    total: 155,
    created_at: new Date(Date.now() - 2.5 * 3600000).toISOString(),
    last_updated: new Date(Date.now() - 2.5 * 3600000).toISOString(),
    status: "pending",
  },
  {
    id: "cart-102",
    customer_name: "مروى نبيل القاسمي",
    phone: "967735987123",
    city: "عدن",
    items: [
      {
        id: "p-3",
        name: "واقي شمس بخلاصة الأرز وبروبيوتيك SPF50 - Beauty of Joseon",
        price: 70,
        quantity: 1,
      },
    ],
    total: 70,
    created_at: new Date(Date.now() - 7 * 3600000).toISOString(),
    last_updated: new Date(Date.now() - 7 * 3600000).toISOString(),
    status: "contacted",
    notes: "تم التواصل عبر واتساب، أبدت اهتماماً وتنتظر كود خصم التوصيل.",
    contacted_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: "cart-103",
    customer_name: "خلود عبد الكريم",
    phone: "967770112233",
    city: "تعز",
    items: [
      {
        id: "p-4",
        name: "عطر ميس ديور أو دو بارفيوم 100 مل",
        price: 320,
        quantity: 1,
      },
    ],
    total: 320,
    created_at: new Date(Date.now() - 14 * 3600000).toISOString(),
    last_updated: new Date(Date.now() - 14 * 3600000).toISOString(),
    status: "recovered",
    notes: "تم إرسال كود خصم 10% واكتمل الطلب برقم #1042.",
    contacted_at: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
];

export async function fetchAbandonedCarts(): Promise<AbandonedCart[]> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", ABANDONED_CARTS_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      const local =
        typeof window !== "undefined" ? localStorage.getItem(ABANDONED_CARTS_KEY) : null;
      if (local) {
        try {
          return JSON.parse(local);
        } catch {
          /* ignore */
        }
      }
      return INITIAL_DEMO_CARTS;
    }

    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DEMO_CARTS;
  } catch {
    return INITIAL_DEMO_CARTS;
  }
}

export async function saveAbandonedCarts(carts: AbandonedCart[]): Promise<void> {
  const json = JSON.stringify(carts);
  if (typeof window !== "undefined") {
    localStorage.setItem(ABANDONED_CARTS_KEY, json);
  }

  const { data: existing } = await supabase
    .from("site_settings")
    .select("id")
    .eq("key", ABANDONED_CARTS_KEY)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("site_settings")
      .update({ value: json, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("site_settings").insert({
      key: ABANDONED_CARTS_KEY,
      value: json,
      group: "sales",
      description: "سجل السلات المتروكة ومتابعات الاسترجاع",
    });
  }
}

export function useAbandonedCarts() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "abandoned-carts"],
    queryFn: fetchAbandonedCarts,
  });

  const mutation = useMutation({
    mutationFn: saveAbandonedCarts,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "abandoned-carts"] });
    },
  });

  return {
    ...query,
    carts: query.data ?? [],
    saveCarts: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
