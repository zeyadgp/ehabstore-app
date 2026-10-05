import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SavedAddress = {
  id: string;
  label: string;
  city: string;
  district: string;
  address: string;
  is_default: boolean;
};

export type CustomerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  governorate: string | null;
  district: string | null;
  address: string | null;
  avatar_url: string | null;
  addresses: SavedAddress[] | null;
  latitude: number | null;
  longitude: number | null;
  referral_code?: string | null;
  referred_by?: string | null;
};

/** جلسة العميل الحالية (المعرف والبريد) مع متابعة تغيّر حالة الدخول. */
export function useSessionUser() {
  const [state, setState] = useState<{
    loading: boolean;
    userId: string | null;
    email: string | null;
  }>({
    loading: true,
    userId: null,
    email: null,
  });

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setState({
        loading: false,
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
      });
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setState({
        loading: false,
        userId: data.user?.id ?? null,
        email: data.user?.email ?? null,
      });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** الملف الشخصي للعميل الحالي. */
export function useCustomerProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<CustomerProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CustomerProfile) ?? null;
    },
  });
}

export function profileIncomplete(profile: CustomerProfile | null | undefined) {
  return !profile?.full_name?.trim() || !profile?.phone?.trim();
}

export function defaultAddress(profile: CustomerProfile | null | undefined): SavedAddress | null {
  const list = profile?.addresses ?? [];
  return list.find((a) => a.is_default) ?? list[0] ?? null;
}

export const WELCOME_KEY = "ehab-welcome-shown";
