import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { FeeConfig } from "@/lib/types";

export async function GET() {
  try {
    await requireAdmin();
    const fees = await query<FeeConfig>(
      "SELECT * FROM fee_config ORDER BY asset"
    );
    return NextResponse.json({ success: true, data: fees });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();

    const { asset, fee_bps, spread_bps } = await req.json();

    if (!["WBTC", "WETH", "USDT", "USDC"].includes(asset)) {
      return NextResponse.json(
        { success: false, error: "Invalid asset" },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (fee_bps !== undefined) {
      updates.push("fee_bps = ?");
      params.push(fee_bps);
    }

    if (spread_bps !== undefined) {
      updates.push("spread_bps = ?");
      params.push(spread_bps);
    }

    if (!updates.length) {
      return NextResponse.json(
        { success: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    params.push(asset);

    await execute(
      `UPDATE fee_config SET ${updates.join(", ")} WHERE asset = ?`,
      params
    );

    const fees = await query<FeeConfig>(
      "SELECT * FROM fee_config ORDER BY asset"
    );

    return NextResponse.json({ success: true, data: fees });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
