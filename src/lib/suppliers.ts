import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Supplier = {
  id: string;
  name: string;
  company_name?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  address?: string;
  balance: number; // المبلغ المستحق له (أو لنا إن كان سالباً)
  payment_terms?: string; // مثلاً: نقداً، أجل 30 يوم، تحويل بنكي
  notes?: string;
  supplied_categories?: string[];
  status: "active" | "inactive";
  created_at: string;
  updated_at?: string;
};

export type ProductCost = {
  product_id: string;
  cost_price: number; // سعر التكلفة
  supplier_id?: string | undefined;
  supplier_name?: string | undefined;
  updated_at?: string | undefined;
};

const SUPPLIERS_SETTING_KEY = "admin_suppliers_catalog";
const PRODUCT_COSTS_SETTING_KEY = "admin_product_costs_map";

const DEFAULT_SUPPLIERS: Supplier[] = [];

export async function fetchSuppliers(): Promise<Supplier[]> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SUPPLIERS_SETTING_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      // Local fallback
      const local =
        typeof window !== "undefined" ? localStorage.getItem(SUPPLIERS_SETTING_KEY) : null;
      if (local) {
        try {
          const parsed = JSON.parse(local);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          /* ignore */
        }
      }
      return [];
    }

    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSuppliers(suppliers: Supplier[]): Promise<void> {
  const json = JSON.stringify(suppliers);
  if (typeof window !== "undefined") {
    localStorage.setItem(SUPPLIERS_SETTING_KEY, json);
  }

  // Persist to site_settings
  const { data: existing } = await supabase
    .from("site_settings")
    .select("id")
    .eq("key", SUPPLIERS_SETTING_KEY)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("site_settings")
      .update({ value: json, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("site_settings").insert({
      key: SUPPLIERS_SETTING_KEY,
      value: json,
      group: "suppliers",
      description: "سجل قائمة الموردين والحسابات",
    });
  }
}

export async function fetchProductCosts(): Promise<Record<string, ProductCost>> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", PRODUCT_COSTS_SETTING_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      const local =
        typeof window !== "undefined" ? localStorage.getItem(PRODUCT_COSTS_SETTING_KEY) : null;
      if (local) {
        try {
          return JSON.parse(local);
        } catch {
          /* ignore */
        }
      }
      return {};
    }

    return JSON.parse(data.value);
  } catch {
    return {};
  }
}

export async function saveProductCosts(costs: Record<string, ProductCost>): Promise<void> {
  const json = JSON.stringify(costs);
  if (typeof window !== "undefined") {
    localStorage.setItem(PRODUCT_COSTS_SETTING_KEY, json);
  }

  const { data: existing } = await supabase
    .from("site_settings")
    .select("id")
    .eq("key", PRODUCT_COSTS_SETTING_KEY)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("site_settings")
      .update({ value: json, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("site_settings").insert({
      key: PRODUCT_COSTS_SETTING_KEY,
      value: json,
      group: "inventory",
      description: "أسعار التكلفة وربط المنتجات بالموردين",
    });
  }
}

export function useSuppliers() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "suppliers"],
    queryFn: fetchSuppliers,
  });

  const mutation = useMutation({
    mutationFn: saveSuppliers,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
    },
  });

  return {
    ...query,
    suppliers: query.data ?? [],
    saveSuppliers: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useProductCosts() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "product-costs"],
    queryFn: fetchProductCosts,
  });

  const mutation = useMutation({
    mutationFn: saveProductCosts,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "product-costs"] });
      qc.invalidateQueries({ queryKey: ["admin", "profits"] });
    },
  });

  return {
    ...query,
    costs: query.data ?? {},
    saveProductCosts: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
