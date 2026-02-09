import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { User } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const kycStatus = searchParams.get("kyc_status");

    let sql = "SELECT * FROM users WHERE 1=1";
    const params: any[] = [];

    if (role) {
      sql += " AND role = ?";
      params.push(role);
    }
    if (kycStatus) {
      sql += " AND kyc_status = ?";
      params.push(kycStatus);
    }

    sql += " ORDER BY created_at DESC";

    const users = await query<User>(sql, params);
    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : error.message?.includes("Admin") ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status }
    );
  }
}
