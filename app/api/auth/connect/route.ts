import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { createToken } from "@/lib/auth";
import type { User } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { wallet_address } = await req.json();

    if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    const addr = wallet_address.toLowerCase();

    // Check if user exists
    let user = await queryOne<User>(
      "SELECT * FROM users WHERE wallet_address = ?",
      [addr]
    );

    if (!user) {
      // Create new user with Tier 1 KYC (wallet only)
      const result = await execute(
        "INSERT INTO users (wallet_address, role, kyc_tier, kyc_status) VALUES (?, 'TRADER', 'TIER_1', 'APPROVED')",
        [addr]
      );
      user = await queryOne<User>("SELECT * FROM users WHERE id = ?", [
        result.insertId,
      ]);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Failed to create user" },
        { status: 500 }
      );
    }

    const token = await createToken({
      id: user.id,
      wallet_address: user.wallet_address,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          wallet_address: user.wallet_address,
          role: user.role,
          kyc_tier: user.kyc_tier,
          kyc_status: user.kyc_status,
          email: user.email,
          company_name: user.company_name,
        },
        token,
      },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Auth connect error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
