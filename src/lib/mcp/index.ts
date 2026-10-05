import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listCategories from "./tools/list-categories";
import listOrders from "./tools/list-orders";
import updateOrderStatus from "./tools/update-order-status";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "ehab-store-beauty",
  title: "Ehab Store Beauty",
  version: "0.1.0",
  instructions:
    "Tools for the Ehab Store beauty shop. Browse the catalog with `search_products`, `get_product` and " +
    "`list_categories`. Store admins can also review orders with `list_orders` and move them along with " +
    "`update_order_status`. Prices are in the store's configured currency (Yemeni Rial by default).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // exactOptionalPropertyTypes rejects the SDK's optional `outputSchema`; the
  // definitions themselves are valid.
  tools: [
    searchProducts,
    getProduct,
    listCategories,
    listOrders,
    updateOrderStatus,
  ] as unknown as Parameters<typeof defineMcp>[0]["tools"],
});
