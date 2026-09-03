/**
 * Frontend API Client for AutoCommerce Autonomous AI Agent Backend.
 * Seamlessly connects to FastAPI running locally or on Render/Supabase.
 */

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, "");

export interface ToolInvocationLog {
  tool_name: string;
  arguments: Record<string, any>;
  result: Record<string, any>;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  tools_invoked: ToolInvocationLog[];
  success: boolean;
  error?: string | null;
}

export interface ChatHistoryRecord {
  id: number;
  session_id: string;
  role: string;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any;
  created_at?: string;
}

export interface DashboardStats {
  total_conversations: number;
  total_messages: number;
  total_orders: number;
  shipped_orders: number;
  low_stock_alerts: number;
  total_cart_sessions: number;
  cart_recovery_rate_pct: number;
  error?: string;
}

export interface ConversationSummary {
  session_id: string;
  channel: string;
  message_count: number;
  preview: string;
  last_active: string | null;
  tools_used: string[];
  status: string;
}

export interface ProductVariant {
  size: string;
  stock: number;
}

export interface Product {
  id: number;
  sku: string;
  title: string;
  name?: string;
  description: string;
  category: string;
  price: number;
  stock_quantity: number;
  stock?: number;
  rating?: number;
  image_url?: string;
  size_variants: ProductVariant[];
  created_at?: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string;
  items: Array<{ name: string; size?: string; quantity: number; price: number }>;
  total_amount: number;
  shipping_address?: string;
  created_at?: string;
}

export const api = {
  // Chat APIs
  async sendChatMessage(sessionId: string, message: string, customerEmail?: string): Promise<ChatResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message,
          customer_email: customerEmail || undefined,
        }),
      });

      if (!res.ok) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData?.detail || errData?.message || errData?.response || errData?.error || JSON.stringify(errData);
        } catch {
          detail = await res.text().catch(() => "");
        }
        const errorText = detail && detail.trim() ? detail : `Server returned HTTP ${res.status} (${res.statusText})`;
        throw new Error(errorText);
      }

      return await res.json();
    } catch (err: any) {
      if (err instanceof Error && err.message) {
        throw err;
      }
      throw new Error(String(err) || "Failed to reach chat service.");
    }
  },

  async getChatHistory(sessionId: string): Promise<ChatHistoryRecord[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat/history/${sessionId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch history: ${res.statusText}`);
    }
    return res.json();
  },

  // Admin APIs
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/stats`);
    if (!res.ok) {
      throw new Error(`Failed to fetch stats: ${res.statusText}`);
    }
    return res.json();
  },

  async getConversations(): Promise<ConversationSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/conversations`);
    if (!res.ok) {
      throw new Error(`Failed to fetch conversations: ${res.statusText}`);
    }
    return res.json();
  },

  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/products`);
    if (!res.ok) {
      throw new Error(`Failed to fetch products: ${res.statusText}`);
    }
    return res.json();
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/orders`);
    if (!res.ok) {
      throw new Error(`Failed to fetch orders: ${res.statusText}`);
    }
    return res.json();
  },

  // Webhook Simulation APIs
  async simulateOrderWebhook(payload: {
    order_number: string;
    email: string;
    customer_name: string;
    fulfillment_status: string;
    carrier: string;
    tracking_number: string;
    total_price: number;
    line_items: Array<{ title: string; size?: string; quantity: number; price: number }>;
  }) {
    const res = await fetch(`${API_BASE_URL}/api/v1/webhooks/orders/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async simulateInventoryWebhook(sku: string, available: number, size?: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/webhooks/inventory/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, available, size }),
    });
    return res.json();
  },

  // WhatsApp Abandoned Cart Recovery Trigger API
  async triggerWhatsAppCartRecovery(sessionId?: string, includeAlreadySent: boolean = false) {
    const params = new URLSearchParams();
    if (sessionId) params.append("session_id", sessionId);
    if (includeAlreadySent) params.append("include_already_sent", "true");
    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/recovery/trigger-whatsapp${queryStr}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  },

  async checkHealth(): Promise<boolean> {
    const healthEndpoints = ["/health", "/api/health", "/api/v1/health", "/"];
    for (const ep of healthEndpoints) {
      try {
        const res = await fetch(`${API_BASE_URL}${ep}`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (
            !data ||
            data.status === "healthy" ||
            data.status === "operational" ||
            data.operational === true ||
            res.status === 200
          ) {
            return true;
          }
        }
      } catch {
        // try next endpoint
      }
    }
    return false;
  },
};
