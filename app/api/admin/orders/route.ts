import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { Order } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const asset = searchParams.get("asset");
    const status = searchParams.get("status");

    let sql =
      "SELECT o.*, u.wallet_address FROM orders o JOIN users u ON o.user_id = u.id WHERE 1=1";
    const params: any[] = [];

    if (asset) {
      sql += " AND o.asset = ?";
      params.push(asset);
    }

    if (status) {
      sql += " AND o.status = ?";
      params.push(status);
    }

    sql += " ORDER BY o.created_at DESC LIMIT 200";

    const orders = await query<Order>(sql, params);

    return NextResponse.json({ success: true, data: orders });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
