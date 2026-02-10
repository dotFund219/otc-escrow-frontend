import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { bscTestnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "OTC Trading Platform",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  // Phase 1: BNB Smart Chain Testnet
  chains: [bscTestnet],
  ssr: false,
});
