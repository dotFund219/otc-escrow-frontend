"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { User, ApiResponse } from "@/lib/types";
import { Users } from "lucide-react";
import { useWriteContract } from "wagmi";
import { ADMIN_ABI, ADMIN_CONTRACT_ADDRESS } from "@/lib/contracts";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ApiResponse<User[]>>);

export function AdminUsers() {
  const { data, isLoading, mutate } = useSWR<ApiResponse<User[]>>(
    "/api/admin/users",
    fetcher
  );
  const users = data?.success ? data.data || [] : [];

  const { writeContractAsync } = useWriteContract();

  async function setFrozen(user: string, frozen: boolean) {
    await writeContractAsync({
      address: ADMIN_CONTRACT_ADDRESS,
      abi: ADMIN_ABI,
      functionName: "setFrozen",
      args: [user, frozen],
    });
    toast.success(frozen ? "User frozen" : "User unfrozen");
    mutate();
  }

  async function setBanned(user: string, banned: boolean) {
    await writeContractAsync({
      address: ADMIN_CONTRACT_ADDRESS,
      abi: ADMIN_ABI,
      functionName: "setBanned",
      args: [user, banned],
    });
    toast.success(banned ? "User banned" : "User unbanned");
    mutate();
  }

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">
          Registered Users ({users.length})
        </h2>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="rounded-xl border border-border bg-card p-4 flex justify-between items-center"
          >
            <div>
              <p className="font-mono text-sm">{u.wallet_address}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">
                  {u.role}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    u.frozen ? "border-warning text-warning" : "border-success"
                  }
                >
                  {u.frozen ? "Frozen" : "Active"}
                </Badge>
                {u.banned && (
                  <Badge variant="destructive">Banned</Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFrozen(u.wallet_address, !u.frozen)}
              >
                {u.frozen ? "Unfreeze" : "Freeze"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBanned(u.wallet_address, !u.banned)}
              >
                {u.banned ? "Unban" : "Ban"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
