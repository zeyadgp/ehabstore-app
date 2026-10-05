import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  rate: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

export type ProductPrice = {
  product_id: string;
  currency_code: string;
  price: number | null;
  discount_price: number | null;
};

export async function fetchCurrencies(): Promise<Currency[]> {
  const { data } = await supabase
    .from("currencies")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return ((data as Currency[] | null) ?? []).map((c) => ({ ...c, rate: Number(c.rate) }));
}

export async function fetchProductPrices(): Promise<ProductPrice[]> {
  const { data } = await supabase
    .from("product_prices")
    .select("product_id, currency_code, price, discount_price");
  return (data as ProductPrice[] | null) ?? [];
}

export const currenciesQuery = {
  queryKey: ["currencies"],
  queryFn: fetchCurrencies,
  staleTime: 60_000,
};
export const productPricesQuery = {
  queryKey: ["product-prices"],
  queryFn: fetchProductPrices,
  staleTime: 60_000,
};

export function useCurrencies() {
  return useQuery(currenciesQuery);
}

const STORAGE_KEY = "ehab-store-currency";

type CurrencyContextValue = {
  code: string;
  setCode: (code: string) => void;
  currencies: Currency[];
  currency: Currency | null;
  symbol: string;
  rate: number;
  /** converts a base-currency (default currency) amount into the selected currency */
  convert: (base: number) => number;
  /** unit price for a product in the selected currency, honouring per-currency overrides */
  unitFor: (productId: string, baseAmount: number) => number;
  format: (base: number) => string;
  formatUnit: (productId: string, baseAmount: number) => string;
};

// نحفظ السياق عالمياً حتى لا يتكرر عند إعادة التحميل السريع أثناء التطوير
const g = globalThis as unknown as {
  __ehabCurrencyCtx?: React.Context<CurrencyContextValue | null>;
};
const CurrencyContext = (g.__ehabCurrencyCtx ??= createContext<CurrencyContextValue | null>(null));

function round(value: number, code: string) {
  // Yemeni rials are quoted without fractions
  if (code.startsWith("YER")) return Math.round(value);
  return Math.round(value * 100) / 100;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data: currencies = [] } = useQuery(currenciesQuery);
  const { data: overrides = [] } = useQuery(productPricesQuery);
  const [code, setCodeState] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCodeState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setCode = (next: string) => {
    setCodeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<CurrencyContextValue>(() => {
    const fallback = currencies.find((c) => c.is_default) ?? currencies[0] ?? null;
    const active = currencies.find((c) => c.code === code) ?? fallback;
    const activeCode = active?.code ?? "SAR";
    const rate = Number(active?.rate ?? 1) || 1;
    const symbol = active?.symbol ?? "ر.ي";

    const overrideMap = new Map<string, ProductPrice>();
    overrides.forEach((o) => overrideMap.set(`${o.product_id}:${o.currency_code}`, o));

    const convert = (base: number) => round(Number(base || 0) * rate, activeCode);

    const unitFor = (productId: string, baseAmount: number) => {
      const o = overrideMap.get(`${productId}:${activeCode}`);
      if (o) {
        if (o.discount_price != null && Number(o.discount_price) > 0)
          return Number(o.discount_price);
        if (o.price != null && Number(o.price) > 0) return Number(o.price);
      }
      return convert(baseAmount);
    };

    const fmt = (n: number) =>
      `${Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${symbol}`;

    return {
      code: activeCode,
      setCode,
      currencies,
      currency: active,
      symbol,
      rate,
      convert,
      unitFor,
      format: (base: number) => fmt(convert(base)),
      formatUnit: (productId: string, baseAmount: number) => fmt(unitFor(productId, baseAmount)),
    };
  }, [currencies, overrides, code]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

const fmtFallback = (n: number) => `${Math.round(Number(n || 0)).toLocaleString("ar")} ر.ي`;
const FALLBACK_CURRENCY: CurrencyContextValue = {
  code: "YER",
  setCode: () => {},
  currencies: [],
  currency: null,
  symbol: "ر.ي",
  rate: 1,
  convert: (b) => Number(b || 0),
  unitFor: (_id, b) => Number(b || 0),
  format: fmtFallback,
  formatUnit: (_id, b) => fmtFallback(b),
};

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  // بدل انهيار الصفحة، نعيد قيمًا افتراضية آمنة إن لم يتوفر المزوّد مؤقتًا
  return ctx ?? FALLBACK_CURRENCY;
}
