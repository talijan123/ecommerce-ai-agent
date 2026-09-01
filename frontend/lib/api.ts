/**
 * Typed API Client for FastAPI Autonomous E-Commerce Backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export interface ToolInvocationLog {
  tool_name: string;
  arguments: Record<string, any>;
  result: any;
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
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
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
}

export interface ConversationSummary {
  session_id: string;
  message_count: number;
  preview: string;
  last_active?: string;
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
  description?: string;
  category: string;
  price: number;
  stock_quantity: number;
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
      throw new Error(`Chat API error: ${res.statusText}`);
    }
    return res.json();
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

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
