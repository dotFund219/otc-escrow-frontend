"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  BarChart3,
  LayoutDashboard,
  Shield,
  LogOut,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Check if the current route matches the given path
  const isActive = (path: string) => pathname.startsWith(path);

  // Shared nav button style with active state support
  const navButtonClass = (active: boolean) =>
    active
      ? "gap-2 bg-secondary text-foreground"
      : "gap-2 text-muted-foreground hover:text-foreground";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/trade" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ArrowLeftRight className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">
              OTC Desk
            </span>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/trade">
                <Button
                  variant="ghost"
                  size="sm"
                  className={navButtonClass(isActive("/trade"))}
                >
                  <BarChart3 className="h-4 w-4" />
                  Trade
                </Button>
              </Link>

              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className={navButtonClass(isActive("/dashboard"))}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>

              {user.role === "ADMIN" && (
                <Link href="/admin">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={navButtonClass(isActive("/admin"))}
                  >
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden items-center gap-2 md:flex">
              <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                {user.kyc_tier === "TIER_2" ? "Verified" : "Basic"}
              </span>
              <span className="text-xs text-muted-foreground">
                {user.wallet_address.slice(0, 6)}...
                {user.wallet_address.slice(-4)}
              </span>
            </div>
          )}

          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
          />

          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Logout</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
