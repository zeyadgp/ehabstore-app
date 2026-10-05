import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PaymentMethod = {
  id: string;
  name: string;
  icon: string | null;
  account_details: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await supabase
    .from("payment_methods")
    .select("id, name, icon, account_details, instructions, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return (data as PaymentMethod[] | null) ?? [];
}

export async function fetchAllPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await supabase
    .from("payment_methods")
    .select("id, name, icon, account_details, instructions, is_active, sort_order")
    .order("sort_order");
  return (data as PaymentMethod[] | null) ?? [];
}

export const paymentMethodsQuery = {
  queryKey: ["payment-methods"],
  queryFn: fetchPaymentMethods,
  staleTime: 60_000,
};

export function usePaymentMethods() {
  return useQuery(paymentMethodsQuery);
}

export function useAllPaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods", "all"],
    queryFn: fetchAllPaymentMethods,
    staleTime: 10_000,
  });
}
