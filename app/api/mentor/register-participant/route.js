
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ALLOWED_SITES = [
  "LMO",
  "SMO",
  "GMO NORTH",
  "GMO SOUTH",
  "BMO 1",
  "BMO 2",
  "BMO 3",
  "SRN",
  "HO",
];

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

    // Periksa token login.
    const authHeader =
      request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();

    const authClient = createClient(url, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: "Sesi login tidak valid." },
        { status: 401 }
      );
    }

    const admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Hanya mentor yang boleh mendaftarkan peserta.
    const { data: mentor, error: mentorError } =
      await admin
        .from("profiles")
        .select("id,role")
        .eq("id", authData.user.id)
        .single();

    if (mentorError || mentor?.role !== "mentor") {
      return NextResponse.json(
        { error: "Akses hanya untuk mentor." },
        { status: 403 }
      );
    }

    // Data formulir pendaftaran.
    const body = await request.json();

    const fullName = String(
      body.full_name || ""
    ).trim();

    const email = String(
      body.email || ""
    ).trim().toLowerCase();

    const department = String(
      body.department || "ER & SS"
    ).trim();

    const site = String(
      body.site || ""
    ).trim().toUpperCase();

    if (!fullName || !email) {
      return NextResponse.json(
        {
          error:
            "Nama dan email peserta wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        {
          error:
            "Format email peserta tidak valid.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_SITES.includes(site)) {
      return NextResponse.json(
        {
          error:
            "Silakan pilih site penempatan yang valid.",
        },
        { status: 400 }
      );
    }

    // Kirim undangan aktivasi akun.
    const {
      data: invited,
      error: inviteError,
    } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: fullName,
        },
      }
    );

    if (inviteError) {
      return NextResponse.json(
        {
          error:
            inviteError.message ||
            "Gagal mengirim undangan peserta.",
        },
        { status: 400 }
      );
    }

    const participantId = invited?.user?.id;

    if (!participantId) {
      return NextResponse.json(
        {
          error:
            "Akun peserta tidak berhasil dibuat.",
        },
        { status: 500 }
      );
    }

    // Simpan profil dan site peserta.
    const {
      error: profileError,
    } = await admin
      .from("profiles")
      .upsert(
        {
          id: participantId,
          full_name: fullName,
          department,
          role: "participant",
          site,
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      console.error(
        "Gagal menyimpan profil peserta:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Undangan akun berhasil dibuat, tetapi profil atau site gagal disimpan. Periksa data sebelum mencoba lagi.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Undangan peserta berhasil dibuat dan site penempatan tersimpan. Peserta perlu membuka email undangan.",
      participant_id: participantId,
      site,
    });
  } catch (error) {
    console.error(
      "Register participant:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
