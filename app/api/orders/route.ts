import { NextRequest, NextResponse } from "next/server";
import { query, execute, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Order } from "@/lib/types";

/**
 * GET /api/orders
 *
 * Returns orders from DB.
 * DB is a mirror + UI snapshot fields (indicative pricing).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const asset = searchParams.get("asset");
    const quoteToken = searchParams.get("quote_token");
    const mine = searchParams.get("mine") === "true";

    let sql =
      `SELECT o.*, u.wallet_address, u.company_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE 1 = 1`;
    const params: any[] = [];

    if (mine) {
      sql += " AND o.user_id = ?";
      params.push(user.id);
    }

    if (status) {
      sql += " AND o.status = ?";
      params.push(status);
    }

    if (asset) {
      sql += " AND o.asset = ?";
      params.push(asset);
    }

    if (quoteToken) {
      sql += " AND o.quote_token = ?";
      params.push(quoteToken);
    }

    sql += " ORDER BY o.created_at DESC LIMIT 100";

    const orders = await query<Order>(sql, params);
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/orders
 *
 * Mirrors an on-chain order into DB.
 * Also stores UI-only pricing snapshot (price_per_unit, total_amount).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (user.kyc_status !== "APPROVED") {
      return NextResponse.json({ success: false, error: "KYC not approved" }, { status: 403 });
    }

    const {
      id,                 // on-chain orderId
      create_tx_hash,     // createOrder tx hash
      asset,              // BTC / ETH
      quote_token,        // USDT / USDC
      quantity,           // UI quantity
      price_per_unit,     // UI snapshot (spot price at creation)
      total_amount        // UI snapshot
    } = await req.json();

    if (
      typeof id !== "number" ||
      !create_tx_hash ||
      !asset ||
      !quote_token ||
      quantity === undefined ||
      price_per_unit === undefined ||
      total_amount === undefined
    ) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    if (!["WBTC", "WETH", "USDT", "USDC"].includes(asset)) {
      return NextResponse.json({ success: false, error: "Invalid asset" }, { status: 400 });
    }

    if (!["WBTC", "WETH", "USDT", "USDC"].includes(quote_token)) {
      return NextResponse.json({ success: false, error: "Invalid quote_token" }, { status: 400 });
    }

    const qty = Number(quantity);
    const ppu = Number(price_per_unit);
    const total = Number(total_amount);

    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ success: false, error: "Invalid quantity" }, { status: 400 });
    }

    if (!Number.isFinite(ppu) || ppu < 0) {
      return NextResponse.json({ success: false, error: "Invalid price_per_unit" }, { status: 400 });
    }

    if (!Number.isFinite(total) || total < 0) {
      return NextResponse.json({ success: false, error: "Invalid total_amount" }, { status: 400 });
    }

    // Prevent duplicates if the same on-chain order is mirrored twice.
    const exists = await queryOne<{ id: number }>("SELECT id FROM orders WHERE id = ?", [id]);
    if (exists?.id) {
      return NextResponse.json({ success: true, message: "Order already mirrored" });
    }

    await execute(
      `INSERT INTO orders (
        id,
        user_id,
        asset,
        quote_token,
        quantity,
        price_per_unit,
        total_amount,
        is_indicative_price,
        status,
        create_tx_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', ?)`,
      [id, user.id, asset, quote_token, qty, ppu, total, create_tx_hash]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Create order mirror error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
