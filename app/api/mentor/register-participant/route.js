
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !publicKey || !secretKey) {
      return NextResponse.json(
        { error: "Konfigurasi server belum lengkap." },
        { status: 500 }
      );
    }

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const token = authorization.slice(7).trim();

    const authClient = createClient(url, publicKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sesi login tidak valid." },
        { status: 401 }
      );
    }

    const admin = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: mentor, error: mentorError } =
      await admin
        .from("profiles")
        .select("id,role")
        .eq("id", user.id)
        .single();

    if (mentorError || mentor?.role !== "mentor") {
      return NextResponse.json(
        { error: "Hanya mentor yang dapat mendaftarkan peserta." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const department = String(
      body.department || "ER & SS"
    ).trim();

    if (
      fullName.length < 3 ||
      fullName.length > 120 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      department.length < 2 ||
      department.length > 100
    ) {
      return NextResponse.json(
        { error: "Nama, email, atau departemen tidak valid." },
        { status: 400 }
      );
    }

    // Buat undangan melalui Supabase Auth.
    // Password tidak dikirim atau disimpan oleh mentor.
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
      });

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      );
    }

    const participantId = invited?.user?.id;

    if (!participantId) {
      return NextResponse.json(
        { error: "Undangan tidak menghasilkan ID peserta." },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: participantId,
          full_name: fullName,
          department,
          role: "participant",
        },
        { onConflict: "id" }
      );

    if (profileError) {
      return NextResponse.json(
        {
          error:
            "Undangan dibuat, tetapi profil gagal disimpan: " +
            profileError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Undangan peserta berhasil dibuat. Peserta perlu membuka email undangan.",
      participant_id: participantId,
    });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
