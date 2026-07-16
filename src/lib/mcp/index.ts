import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listOrdersTool from "./tools/list-orders";
import getOrderTool from "./tools/get-order";
import listProductsTool from "./tools/list-products";
import listCategoriesTool from "./tools/list-categories";
import listBranchesTool from "./tools/list-branches";
import updateOrderStatusTool from "./tools/update-order-status";

// Direct Supabase issuer (never the .lovable.cloud proxy). See app-mcp-server-authoring.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "restocloud-mcp",
  title: "RestoCloud MCP",
  version: "0.1.0",
  instructions:
    "Herramientas para consultar y operar un restaurante en RestoCloud (multitenant SaaS). " +
    "Todas las llamadas se ejecutan como el usuario autenticado y respetan el aislamiento por " +
    "restaurante y sucursal (RLS). Empezá con `whoami` para verificar la sesión, luego usá " +
    "`list_orders`, `list_products`, `list_categories`, `list_branches`, `get_order` para leer, " +
    "y `update_order_status` para cambiar el estado de un pedido.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listOrdersTool,
    getOrderTool,
    listProductsTool,
    listCategoriesTool,
    listBranchesTool,
    updateOrderStatusTool,
  ],
});
