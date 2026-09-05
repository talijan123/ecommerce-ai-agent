"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  api,
  UserResponse,
  LoginRequest,
  SignupRequest,
  SignupResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  TokenResponse,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  formatApiError,
} from "@/lib/api";

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<TokenResponse>;
  signup: (payload: SignupRequest) => Promise<SignupResponse>;
  verifyEmail: (payload: VerifyEmailRequest) => Promise<VerifyEmailResponse>;
  logout: () => void;
  fetchMe: () => Promise<UserResponse | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch current authenticated user profile
  const fetchMe = useCallback(async (): Promise<UserResponse | null> => {
    try {
      const activeToken = getStoredToken();
      if (!activeToken) {
        setUser(null);
        setToken(null);
        return null;
      }

      setToken(activeToken);
      const userProfile = await api.getMe();
      setUser(userProfile);
      return userProfile;
    } catch (err) {
      console.warn("Session expired or invalid token:", formatApiError(err));
      clearStoredToken();
      setUser(null);
      setToken(null);
      return null;
    }
  }, []);

  // Hydrate auth session on mount
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        const stored = getStoredToken();
        if (stored) {
          setToken(stored);
          const userProfile = await api.getMe();
          if (isMounted) {
            setUser(userProfile);
          }
        }
      } catch {
        if (isMounted) {
          clearStoredToken();
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Login handler
  const login = async (credentials: LoginRequest): Promise<TokenResponse> => {
    setIsLoading(true);
    try {
      const res = await api.login(credentials);
      setToken(res.access_token);
      setStoredToken(res.access_token);

      if (res.user) {
        setUser(res.user);
      } else {
        const profile = await api.getMe();
        setUser(profile);
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  // Signup handler
  const signup = async (payload: SignupRequest): Promise<SignupResponse> => {
    return await api.signup(payload);
  };

  // Verify email handler
  const verifyEmail = async (payload: VerifyEmailRequest): Promise<VerifyEmailResponse> => {
    return await api.verifyEmail(payload);
  };

  // Logout handler
  const logout = () => {
    api.logout();
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    signup,
    verifyEmail,
    logout,
    fetchMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
