import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { Order } from "@/lib/types";

type PatchBody = {
  status?: "PENDING" | "ESCROWED" | "DELIVERED" | "COMPLETED" | "CANCELLED" | "DISPUTED";
  escrow_tx_hash?: string | null;
  delivery_tx_hash?: string | null;
  trade_id?: number | null;

  // Never trust this from the client for authorization decisions.
  // We will ignore it except for server-side assignment on accept.
  counterparty_id?: number | null;
};

function isHexTxHash(v: unknown): v is string {
  return typeof v === "string" && /^0x([A-Fa-f0-9]{64})$/.test(v);
}

function isFiniteInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const order = await queryOne<Order>(
      `SELECT o.*, u.wallet_address, u.company_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [id]
    );

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("Get order error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await req.json()) as PatchBody;

    const order = await queryOne<any>("SELECT * FROM orders WHERE id = ?", [id]);
    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const role = String(user.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";
    const isSeller = Number(order.user_id) === Number(user.id);
    const isBuyer = order.counterparty_id != null && Number(order.counterparty_id) === Number(user.id);

    const currentStatus = String(order.status || "");
    const nextStatus = body.status ? String(body.status) : null;

    // Reject no-op requests early
    const hasAnyUpdate =
      nextStatus ||
      body.escrow_tx_hash != null ||
      body.delivery_tx_hash != null ||
      body.trade_id != null ||
      body.counterparty_id != null;

    if (!hasAnyUpdate) {
      return NextResponse.json({ success: false, error: "No updates provided" }, { status: 400 });
    }

    // Never allow client to overwrite counterparty after it is set.
    // Also never use client-provided counterparty_id for authorization.
    if (body.counterparty_id != null) {
      // Only allow counterparty assignment during accept flow (PENDING -> ESCROWED),
      // and it will be forced to the current user.id anyway.
      if (!(nextStatus === "ESCROWED" && currentStatus === "PENDING")) {
        return NextResponse.json(
          { success: false, error: "counterparty_id cannot be set/changed directly" },
          { status: 400 }
        );
      }
    }

    // Enforce strict status transitions aligned with on-chain intent
    // PENDING -> ESCROWED (buyer accept)
    // PENDING -> CANCELLED (seller cancel)
    // ESCROWED -> DELIVERED (seller submits delivery)
    // DELIVERED -> COMPLETED (buyer confirms)
    // DELIVERED -> DISPUTED (buyer rejects)
    // DISPUTED -> COMPLETED/CANCELLED (admin resolves)
    const allowedTransitions: Record<string, string[]> = {
      PENDING: ["ESCROWED", "CANCELLED"],
      ESCROWED: ["DELIVERED"],
      DELIVERED: ["COMPLETED", "DISPUTED"],
      DISPUTED: ["COMPLETED", "CANCELLED"],
    };

    if (nextStatus) {
      const ok =
        allowedTransitions[currentStatus] &&
        allowedTransitions[currentStatus].includes(nextStatus);

      if (!ok) {
        return NextResponse.json(
          { success: false, error: `Cannot transition from ${currentStatus} to ${nextStatus}` },
          { status: 400 }
        );
      }
    }

    // Action-based authorization and required fields
    // This prevents "any user can patch anything" bugs.
    if (nextStatus === "ESCROWED") {
      // Buyer accepts. Buyer must not be seller. Counterparty must be empty.
      if (currentStatus !== "PENDING") {
        return NextResponse.json({ success: false, error: "Order is not pending" }, { status: 400 });
      }
      if (isSeller) {
        return NextResponse.json({ success: false, error: "Seller cannot accept own order" }, { status: 403 });
      }
      if (order.counterparty_id != null) {
        return NextResponse.json({ success: false, error: "Order already has a counterparty" }, { status: 400 });
      }
      if (!isHexTxHash(body.escrow_tx_hash)) {
        return NextResponse.json({ success: false, error: "escrow_tx_hash is required (valid 0x... hash)" }, { status: 400 });
      }
      if (body.trade_id != null && !isFiniteInt(body.trade_id)) {
        return NextResponse.json({ success: false, error: "trade_id must be an integer" }, { status: 400 });
      }
    }

    if (nextStatus === "CANCELLED") {
      if (currentStatus === "PENDING") {
        if (!isSeller && !isAdmin) {
          return NextResponse.json({ success: false, error: "Only seller or admin can cancel a pending order" }, { status: 403 });
        }
      } else if (currentStatus === "DISPUTED") {
        if (!isAdmin) {
          return NextResponse.json({ success: false, error: "Only admin can cancel a disputed order" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, error: "Cancel not allowed in current status" }, { status: 400 });
      }
    }

    if (nextStatus === "DELIVERED") {
      if (!isSeller) {
        return NextResponse.json({ success: false, error: "Only seller can mark delivered" }, { status: 403 });
      }
      if (currentStatus !== "ESCROWED") {
        return NextResponse.json({ success: false, error: "Order must be escrowed first" }, { status: 400 });
      }
      if (!isHexTxHash(body.delivery_tx_hash)) {
        return NextResponse.json({ success: false, error: "delivery_tx_hash is required (valid 0x... hash)" }, { status: 400 });
      }
    }

    if (nextStatus === "COMPLETED") {
      if (currentStatus === "DELIVERED") {
        if (!isBuyer) {
          return NextResponse.json({ success: false, error: "Only buyer can complete after delivery" }, { status: 403 });
        }
      } else if (currentStatus === "DISPUTED") {
        if (!isAdmin) {
          return NextResponse.json({ success: false, error: "Only admin can resolve disputed orders" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, error: "Complete not allowed in current status" }, { status: 400 });
      }
    }

    if (nextStatus === "DISPUTED") {
      if (currentStatus !== "DELIVERED") {
        return NextResponse.json({ success: false, error: "Only delivered orders can be disputed" }, { status: 400 });
      }
      if (!isBuyer) {
        return NextResponse.json({ success: false, error: "Only buyer can dispute after delivery" }, { status: 403 });
      }
    }

    // If client tries to patch hashes without the matching status change, restrict it.
    // This keeps DB consistent with on-chain actions.
    if (!nextStatus) {
      if (body.escrow_tx_hash != null || body.trade_id != null) {
        return NextResponse.json(
          { success: false, error: "escrow_tx_hash/trade_id updates require status=ESCROWED" },
          { status: 400 }
        );
      }
      if (body.delivery_tx_hash != null) {
        return NextResponse.json(
          { success: false, error: "delivery_tx_hash updates require status=DELIVERED" },
          { status: 400 }
        );
      }
    }

    // Build safe UPDATE statement
    const updates: string[] = [];
    const values: any[] = [];

    if (nextStatus) {
      updates.push("status = ?");
      values.push(nextStatus);
    }

    if (nextStatus === "ESCROWED") {
      // Server-enforced counterparty assignment
      updates.push("counterparty_id = ?");
      values.push(user.id);

      updates.push("escrow_tx_hash = ?");
      values.push(body.escrow_tx_hash);

      if (body.trade_id != null) {
        updates.push("trade_id = ?");
        values.push(body.trade_id);
      }
    }

    if (nextStatus === "DELIVERED") {
      updates.push("delivery_tx_hash = ?");
      values.push(body.delivery_tx_hash);
    }

    // Allow admin to attach trade_id when resolving, if needed
    if (isAdmin && body.trade_id != null && nextStatus !== "ESCROWED") {
      if (!isFiniteInt(body.trade_id)) {
        return NextResponse.json({ success: false, error: "trade_id must be an integer" }, { status: 400 });
      }
      updates.push("trade_id = ?");
      values.push(body.trade_id);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: "No valid updates provided" }, { status: 400 });
    }

    values.push(id);
    await execute(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`, values);

    const updated = await queryOne<Order>("SELECT * FROM orders WHERE id = ?", [id]);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Update order error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
