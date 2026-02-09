import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { User } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { kyc_tier, kyc_status, role } = body;

    const user = await queryOne<User>("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const updates: string[] = [];
    const updateParams: any[] = [];

    if (kyc_tier && ["TIER_1", "TIER_2"].includes(kyc_tier)) {
      updates.push("kyc_tier = ?");
      updateParams.push(kyc_tier);
    }
    if (kyc_status && ["PENDING", "APPROVED", "REJECTED"].includes(kyc_status)) {
      updates.push("kyc_status = ?");
      updateParams.push(kyc_status);
    }
    if (role && ["TRADER", "ADMIN"].includes(role)) {
      updates.push("role = ?");
      updateParams.push(role);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid updates" },
        { status: 400 }
      );
    }

    updateParams.push(id);
    await execute(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      updateParams
    );

    const updated = await queryOne<User>("SELECT * FROM users WHERE id = ?", [id]);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : error.message?.includes("Admin") ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status }
    );
  }
}
