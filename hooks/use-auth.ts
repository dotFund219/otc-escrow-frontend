"use client";

import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useEffect, useCallback, useRef } from "react";
import useSWR from "swr";
import type { User, ApiResponse } from "@/lib/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ApiResponse<User>>);

export function useAuth() {
  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const isAuthenticating = useRef(false);

  const {
    data: authData,
    mutate,
    isLoading,
  } = useSWR<ApiResponse<User>>("/api/auth/me", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const user = authData?.success ? authData.data : null;

  const authenticate = useCallback(async () => {
    if (!address || isAuthenticating.current) return;
    isAuthenticating.current = true;

    try {
      const message = `Sign this message to authenticate with OTC Platform.\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: address, signature, message }),
      });

      const data: ApiResponse<{ user: User; token: string }> =
        await res.json();
      if (data.success) {
        await mutate();
      }
    } catch (err) {
      console.error("Auth failed:", err);
    } finally {
      isAuthenticating.current = false;
    }
  }, [address, signMessageAsync, mutate]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      disconnect();
      await mutate(undefined, { revalidate: false });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }, [disconnect, mutate]);

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (isConnected && address && !user && !isLoading) {
      authenticate();
    }
  }, [isConnected, address, user, isLoading, authenticate]);

  return {
    user,
    address,
    isConnected,
    isLoading,
    chain,
    authenticate,
    logout,
    mutate,
  };
}
