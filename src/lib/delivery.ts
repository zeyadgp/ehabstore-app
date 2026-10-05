import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryZone = {
  id: string;
  governorate: string;
  fee: number;
  is_active: boolean;
  sort_order: number;
};

export const deliveryZonesQuery = {
  queryKey: ["delivery-zones"],
  queryFn: async (): Promise<DeliveryZone[]> => {
    const { data, error } = await supabase
      .from("delivery_zones")
      .select("id, governorate, fee, is_active, sort_order")
      .order("sort_order");
    if (error) throw error;
    return (data as unknown as DeliveryZone[]) ?? [];
  },
};

export function useDeliveryZones() {
  return useQuery(deliveryZonesQuery);
}

/** رسوم التوصيل لمحافظة معيّنة اعتماداً على المناطق المعرّفة في لوحة التحكم. */
export function feeForCity(zones: DeliveryZone[], city: string, fallback = 2000) {
  const z = zones.find((x) => x.is_active && x.governorate.trim() === (city ?? "").trim());
  return z ? Number(z.fee) : fallback;
}
