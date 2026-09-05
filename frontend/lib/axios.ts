import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/**
 * Base API URL configured via environment variables with fallback to localhost:8000.
 * Supports NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_API_URL, and default backend port.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

/**
 * Token key constants for consistent storage across localStorage & cookies.
 */
export const AUTH_TOKEN_KEY = "autocommerce_token";
export const AUTH_USER_KEY = "autocommerce_user";

/**
 * Helper to retrieve stored auth token safely in client environment.
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Helper to store auth token in both localStorage and client cookie.
 */
export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    // Set 7-day cookie for middleware or SSR access
    document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
  } catch (err) {
    console.error("Failed to persist auth token:", err);
  }
}

/**
 * Helper to clear auth token from localStorage and client cookie.
 */
export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    document.cookie = `${AUTH_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  } catch (err) {
    console.error("Failed to clear auth token:", err);
  }
}

/**
 * Configured Axios instance with request and response interceptors.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request Interceptor: Automatically attach Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // If unauthorized on protected endpoints (excluding login endpoint itself), clear token
      const requestUrl = error.config?.url || "";
      if (!requestUrl.includes("/auth/login") && !requestUrl.includes("/auth/signup")) {
        clearStoredToken();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
