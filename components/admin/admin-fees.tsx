"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWriteContract, useReadContract } from "wagmi";
import { CONFIG_ABI, CONFIG_CONTRACT_ADDRESS } from "@/lib/contracts";

function toNumber(v: unknown, fallback = 0) {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function AdminFees() {
  const { writeContractAsync } = useWriteContract();

  const { data: onChainFeeBps, refetch: refetchFee } = useReadContract({
    address: CONFIG_CONTRACT_ADDRESS as `0x${string}`,
    abi: CONFIG_ABI,
    functionName: "feeBps",
    query: { enabled: !!CONFIG_CONTRACT_ADDRESS },
  });

  const { data: onChainSpreadBps, refetch: refetchSpread } = useReadContract({
    address: CONFIG_CONTRACT_ADDRESS as `0x${string}`,
    abi: CONFIG_ABI,
    functionName: "spreadBps",
    query: { enabled: !!CONFIG_CONTRACT_ADDRESS },
  });

  const [feeBps, setFeeBps] = useState("");
  const [spreadBps, setSpreadBps] = useState("");
  const [busy, setBusy] = useState<"fee" | "spread" | null>(null);

  useEffect(() => {
    if (onChainFeeBps !== undefined && onChainFeeBps !== null) {
      setFeeBps(String(toNumber(onChainFeeBps, 0)));
    }
  }, [onChainFeeBps]);

  useEffect(() => {
    if (onChainSpreadBps !== undefined && onChainSpreadBps !== null) {
      setSpreadBps(String(toNumber(onChainSpreadBps, 0)));
    }
  }, [onChainSpreadBps]);

  const feeValue = useMemo(() => toNumber(feeBps, NaN), [feeBps]);
  const spreadValue = useMemo(() => toNumber(spreadBps, NaN), [spreadBps]);

  async function saveFee() {
    if (!CONFIG_CONTRACT_ADDRESS) {
      toast.error("Missing Config contract address.");
      return;
    }
    if (!Number.isFinite(feeValue) || feeValue < 0) {
      toast.error("Invalid feeBps value.");
      return;
    }

    setBusy("fee");
    try {
      const txHash = await writeContractAsync({
        address: CONFIG_CONTRACT_ADDRESS as `0x${string}`,
        abi: CONFIG_ABI,
        functionName: "setFeeBps",
        args: [BigInt(Math.floor(feeValue))],
      });

      toast.info("Waiting confirmation...");
      toast.success("Fee update submitted.");

      await refetchFee();
      toast.success("Fee updated on-chain.");
      return txHash;
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message?.slice(0, 200) || "Fee update failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveSpread() {
    if (!CONFIG_CONTRACT_ADDRESS) {
      toast.error("Missing Config contract address.");
      return;
    }
    if (!Number.isFinite(spreadValue) || spreadValue < 0) {
      toast.error("Invalid spreadBps value.");
      return;
    }

    setBusy("spread");
    try {
      const txHash = await writeContractAsync({
        address: CONFIG_CONTRACT_ADDRESS as `0x${string}`,
        abi: CONFIG_ABI,
        functionName: "setSpreadBps",
        args: [BigInt(Math.floor(spreadValue))],
      });

      toast.info("Waiting confirmation...");
      toast.success("Spread update submitted.");

      await refetchSpread();
      toast.success("Spread updated on-chain.");
      return txHash;
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message?.slice(0, 200) || "Spread update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Protocol Fee</h2>
        <Input
          type="number"
          placeholder="Fee bps (ex: 30)"
          value={feeBps}
          onChange={(e) => setFeeBps(e.target.value)}
        />
        <Button onClick={saveFee} className="mt-3" disabled={busy !== null}>
          {busy === "fee" ? "Saving..." : "Save Fee"}
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Spread</h2>
        <Input
          type="number"
          placeholder="Spread bps (ex: 50)"
          value={spreadBps}
          onChange={(e) => setSpreadBps(e.target.value)}
        />
        <Button onClick={saveSpread} className="mt-3" disabled={busy !== null}>
          {busy === "spread" ? "Saving..." : "Save Spread"}
        </Button>
      </div>
    </div>
  );
}
