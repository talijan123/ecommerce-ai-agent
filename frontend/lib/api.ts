/**
 * Frontend API Client for AutoCommerce Autonomous AI Agent Backend.
 * Uses Axios with automated Authorization Bearer token attachment and error handling.
 */

import { apiClient, API_BASE_URL, getStoredToken, setStoredToken, clearStoredToken } from "./axios";

export { API_BASE_URL, getStoredToken, setStoredToken, clearStoredToken, apiClient };

// ==========================================
// Authentication Schemas & Interfaces
// ==========================================

export interface UserResponse {
  id: string;
  email: string;
  full_name?: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface SignupResponse {
  message: string;
  email: string;
  is_verified: boolean;
  verification_token?: string | null;
}

export interface VerifyEmailRequest {
  email: string;
  verification_token: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  is_verified: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: UserResponse | null;
}

// ==========================================
// Store & Product Schemas
// ==========================================

export interface StoreResponse {
  id: string;
  owner_id: string;
  name: string;
  owner_email: string;
  whatsapp_phone_number_id: string;
  system_prompt?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface StoreCreateRequest {
  name: string;
  whatsapp_phone_number_id?: string;
  whatsapp_access_token?: string;
  system_prompt?: string;
  owner_email?: string;
}

export interface StoreUpdateRequest {
  name?: string;
  system_prompt?: string;
  whatsapp_access_token?: string;
  is_active?: boolean;
}

export interface WhatsAppVerifyRequest {
  whatsapp_phone_number_id?: string;
  whatsapp_access_token?: string;
}

export interface WhatsAppVerifyResponse {
  status: "connected" | "failed";
  verified_name?: string;
  display_phone_number?: string;
  quality_rating?: string;
  details?: any;
  error?: string;
  status_code?: number;
}

export interface CSVImportSummary {
  total_rows: number;
  imported: number;
  errors: string[];
  sample_imported: any[];
}

export interface ProductVariant {
  size: string;
  stock: number;
}

export interface Product {
  id: number;
  store_id?: string;
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

// ==========================================
// Error Helper
// ==========================================

export function formatApiError(err: any): string {
  if (err?.response?.data?.detail) {
    const detail = err.response.data.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
    }
    return JSON.stringify(detail);
  }
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message) return err.message;
  return "An unexpected network or server error occurred.";
}

// ==========================================
// Unified API Service
// ==========================================

export const api = {
  // ----------------------------------------
  // Auth API Endpoints
  // ----------------------------------------
  async signup(data: SignupRequest): Promise<SignupResponse> {
    const res = await apiClient.post<SignupResponse>("/api/v1/auth/signup", data);
    return res.data;
  },

  async verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    const res = await apiClient.post<VerifyEmailResponse>("/api/v1/auth/verify-email", data);
    return res.data;
  },

  async login(data: LoginRequest): Promise<TokenResponse> {
    const res = await apiClient.post<TokenResponse>("/api/v1/auth/login", data);
    if (res.data.access_token) {
      setStoredToken(res.data.access_token);
    }
    return res.data;
  },

  async getMe(): Promise<UserResponse> {
    const res = await apiClient.get<UserResponse>("/api/v1/auth/me");
    return res.data;
  },

  logout(): void {
    clearStoredToken();
  },

  // ----------------------------------------
  // Stores API Endpoints
  // ----------------------------------------
  async createStore(data: StoreCreateRequest): Promise<StoreResponse> {
    const res = await apiClient.post<StoreResponse>("/api/v1/stores", data);
    return res.data;
  },

  async listStores(params?: { skip?: number; limit?: number; is_active?: boolean }): Promise<StoreResponse[]> {
    const res = await apiClient.get<StoreResponse[]>("/api/v1/stores", { params });
    return res.data;
  },

  async getStore(storeId: string): Promise<StoreResponse> {
    const res = await apiClient.get<StoreResponse>(`/api/v1/stores/${encodeURIComponent(storeId)}`);
    return res.data;
  },

  async updateStore(storeId: string, data: StoreUpdateRequest): Promise<StoreResponse> {
    const res = await apiClient.patch<StoreResponse>(`/api/v1/stores/${encodeURIComponent(storeId)}`, data);
    return res.data;
  },

  async deleteStore(storeId: string): Promise<{ success: boolean; message: string; store_id: string; is_active: boolean }> {
    const res = await apiClient.delete(`/api/v1/stores/${encodeURIComponent(storeId)}`);
    return res.data;
  },

  async uploadProductsCSV(storeId: string, file: File): Promise<CSVImportSummary> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post<CSVImportSummary>(
      `/api/v1/stores/${encodeURIComponent(storeId)}/products/upload-csv`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return res.data;
  },

  async verifyWhatsApp(storeId: string, payload?: WhatsAppVerifyRequest): Promise<WhatsAppVerifyResponse> {
    const res = await apiClient.post<WhatsAppVerifyResponse>(
      `/api/v1/stores/${encodeURIComponent(storeId)}/verify-whatsapp`,
      payload || {}
    );
    return res.data;
  },

  async getStoreProducts(storeId: string): Promise<Product[]> {
    const res = await apiClient.get<Product[]>(`/api/v1/stores/${encodeURIComponent(storeId)}/products`);
    return res.data;
  },

  getSampleCsvUrl(): string {
    return `${API_BASE_URL}/api/v1/stores/sample-products-csv`;
  },

  async downloadSampleProductsCsv(): Promise<void> {
    try {
      const res = await apiClient.get("/api/v1/stores/sample-products-csv", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "sample_products_template.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download sample CSV template:", err);
      window.open(`${API_BASE_URL}/api/v1/stores/sample-products-csv`, "_blank");
    }
  },

  // ----------------------------------------
  // Chat APIs
  // ----------------------------------------
  async sendChatMessage(sessionId: string, message: string, customerEmail?: string): Promise<ChatResponse> {
    try {
      const res = await apiClient.post<ChatResponse>("/api/v1/chat", {
        session_id: sessionId,
        message,
        customer_email: customerEmail || undefined,
      });
      return res.data;
    } catch (err: any) {
      throw new Error(formatApiError(err));
    }
  },

  async getChatHistory(sessionId: string): Promise<ChatHistoryRecord[]> {
    const res = await apiClient.get<ChatHistoryRecord[]>(`/api/v1/chat/history/${encodeURIComponent(sessionId)}`);
    return res.data;
  },

  // ----------------------------------------
  // Admin & Stats APIs
  // ----------------------------------------
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await apiClient.get<DashboardStats>("/api/v1/admin/stats");
    return res.data;
  },

  async getConversations(): Promise<ConversationSummary[]> {
    const res = await apiClient.get<ConversationSummary[]>("/api/v1/admin/conversations");
    return res.data;
  },

  async getProducts(): Promise<Product[]> {
    const res = await apiClient.get<Product[]>("/api/v1/admin/products");
    return res.data;
  },

  async getOrders(): Promise<Order[]> {
    const res = await apiClient.get<Order[]>("/api/v1/admin/orders");
    return res.data;
  },

  // ----------------------------------------
  // Webhook Simulation APIs
  // ----------------------------------------
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
    const res = await apiClient.post("/api/v1/webhooks/orders/create", payload);
    return res.data;
  },

  async simulateInventoryWebhook(sku: string, available: number, size?: string) {
    const res = await apiClient.post("/api/v1/webhooks/inventory/update", { sku, available, size });
    return res.data;
  },

  async triggerWhatsAppCartRecovery(sessionId?: string, includeAlreadySent: boolean = false) {
    const params: any = {};
    if (sessionId) params.session_id = sessionId;
    if (includeAlreadySent) params.include_already_sent = "true";
    const res = await apiClient.post("/api/v1/admin/recovery/trigger-whatsapp", null, { params });
    return res.data;
  },

  async checkHealth(): Promise<boolean> {
    const healthEndpoints = ["/health", "/api/health", "/api/v1/health", "/"];
    for (const ep of healthEndpoints) {
      try {
        const res = await apiClient.get(ep, { timeout: 3000 });
        if (
          res.status === 200 ||
          res.data?.status === "healthy" ||
          res.data?.status === "operational" ||
          res.data?.operational === true
        ) {
          return true;
        }
      } catch {
        // try next endpoint
      }
    }
    return false;
  },
};
