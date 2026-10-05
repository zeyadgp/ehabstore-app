import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { trackMetaAddToCart } from "@/lib/meta/pixel";
import { getCartFromIDB, saveCartToIDB, clearCartFromIDB } from "@/lib/cart-storage";

export type CartItem = {
  /** هوية العنصر داخل السلة = المنتج + اللون + المقاس */
  key: string;
  id: string;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  image: string | null;
  color?: string | null;
  /** لون العينة لعرض الدرجة داخل السلة والفاتورة */
  colorSwatch?: string | null;
  colorValueId?: string | null;

  size?: string | null;
  sizeValueId?: string | null;
  sku?: string | null;
};

export type CartInput = Omit<CartItem, "quantity" | "key">;

export function cartKey(item: {
  id: string;
  colorValueId?: string | null;
  sizeValueId?: string | null;
}) {
  return [item.id, item.colorValueId ?? "", item.sizeValueId ?? ""].join("|");
}

type CartContextValue = {
  items: CartItem[];
  add: (item: CartInput, quantity?: number) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ehab-store-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    let hasLocal = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasLocal = true;
          // سلات قديمة بدون مفتاح: نولّده حتى لا تُفقد بيانات العميل.
          setItems(parsed.map((i) => ({ ...i, key: i.key ?? cartKey(i) })));
        }
      }
    } catch {
      /* ignore corrupted storage */
    }

    // إذا لم تكن هناك عناصر في localStorage، نفحص IndexedDB كنسخة احتياطية
    if (!hasLocal) {
      void getCartFromIDB().then((backup) => {
        if (backup && backup.length > 0) {
          setItems(backup.map((i) => ({ ...i, key: i.key ?? cartKey(i) })));
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(backup));
          } catch {
            /* ignore */
          }
        }
      });
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
    // حفظ احتياطي في IndexedDB
    void saveCartToIDB(items);
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      add: (item, quantity = 1) => {
        try {
          trackMetaAddToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity,
            sku: item.sku,
            color: item.color,
            size: item.size,
          });
        } catch {
          /* ignore tracking errors */
        }
        setItems((prev) => {
          const key = cartKey(item);
          const found = prev.find((p) => p.key === key);
          if (found) {
            return prev.map((p) => (p.key === key ? { ...p, quantity: p.quantity + quantity } : p));
          }
          return [...prev, { ...item, key, quantity }];
        });
      },
      remove: (key) => setItems((prev) => prev.filter((p) => p.key !== key)),
      setQuantity: (key, quantity) =>
        setItems((prev) =>
          prev.map((p) => (p.key === key ? { ...p, quantity: Math.max(1, quantity) } : p)),
        ),
      clear: () => {
        setItems([]);
        void clearCartFromIDB();
      },
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      count: items.reduce((sum, i) => sum + i.quantity, 0),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

const EMPTY_CART: CartContextValue = {
  items: [],
  add: () => {},
  remove: () => {},
  setQuantity: () => {},
  clear: () => {},
  total: 0,
  count: 0,
};

export function useCart() {
  // أثناء التحديث السريع قد يُعاد تركيب المزوّد؛ نرجع سلة فارغة بدل تعطيل الصفحة.
  return useContext(CartContext) ?? EMPTY_CART;
}
