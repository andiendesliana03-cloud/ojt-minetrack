
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

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function jsonError(message, status = 400) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !publicKey || !secretKey) {
      return jsonError(
        "Konfigurasi server belum lengkap.",
        500
      );
    }

    const authHeader =
      request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonError(
        "Silakan login terlebih dahulu.",
        401
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
      return jsonError(
        "Sesi login tidak valid.",
        401
      );
    }

    const admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: mentor, error: mentorError } =
      await admin
        .from("profiles")
        .select("id,role")
        .eq("id", authData.user.id)
        .single();

    if (mentorError || mentor?.role !== "mentor") {
      return jsonError(
        "Akses hanya untuk mentor.",
        403
      );
    }

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

    const startDate = String(
      body.start_date || ""
    ).trim();

    const endDate = String(
      body.end_date || ""
    ).trim();

    if (!fullName || !email || !department) {
      return jsonError(
        "Nama, email, dan departemen wajib diisi."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return jsonError(
        "Format email tidak valid."
      );
    }

    if (!ALLOWED_SITES.includes(site)) {
      return jsonError(
        "Silakan pilih site penempatan yang valid."
      );
    }

    if (
      !isValidDate(startDate) ||
      !isValidDate(endDate)
    ) {
      return jsonError(
        "Tanggal mulai dan selesai OJT wajib diisi dengan benar."
      );
    }

    if (endDate < startDate) {
      return jsonError(
        "Tanggal selesai tidak boleh lebih awal dari tanggal mulai."
      );
    }

    // Cegah pendaftaran ulang email yang sudah ada.
    // Pemeriksaan ini membantu, tetapi bukan pengganti
    // pengamanan unik pada database.
    let page = 1;

    while (true) {
      const { data, error } =
        await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });

      if (error) throw error;

      const users = data?.users || [];

      const existing = users.find(
        (user) =>
          user.email?.toLowerCase() === email
      );

      if (existing) {
        return jsonError(
          "Email sudah terdaftar. Jangan membuat akun atau program OJT ganda.",
          409
        );
      }

      if (users.length < 1000) break;
      page++;
    }

    // Buat akun dan kirim undangan.
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name: fullName,
          },
        }
      );

    if (inviteError) {
      return jsonError(
        inviteError.message ||
          "Gagal mengirim undangan peserta."
      );
    }

    const participantId = invited?.user?.id;

    if (!participantId) {
      return jsonError(
        "Akun peserta gagal dibuat.",
        500
      );
    }

    // Simpan profil dan site awal peserta.
    const { error: profileError } =
      await admin
        .from("profiles")
        .upsert(
          {
            id: participantId,
            full_name: fullName,
            department,
            role: "participant",
            site,
          },
          { onConflict: "id" }
        );

    if (profileError) {
      console.error(
        "Profile creation failed:",
        profileError
      );

      return jsonError(
        "Undangan sudah dibuat, tetapi profil gagal disimpan. Hubungi administrator sebelum mencoba kembali.",
        500
      );
    }

    // Pemeriksaan tambahan agar tidak membuat
    // program aktif kedua untuk peserta yang sama.
    const { data: existingPrograms, error: checkError } =
      await admin
        .from("ojt_programs")
        .select("id")
        .eq("participant_id", participantId)
        .eq("status", "active")
        .limit(1);

    if (checkError) throw checkError;

    if (existingPrograms?.length) {
      return jsonError(
        "Peserta sudah memiliki program OJT aktif.",
        409
      );
    }

    // Buat program OJT menggunakan periode
    // dan site yang ditentukan mentor.
    const { data: program, error: programError } =
      await admin
        .from("ojt_programs")
        .insert({
          participant_id: participantId,
          mentor_id: mentor.id,
          start_date: startDate,
          end_date: endDate,
          status: "active",
          site,
        })
        .select("id")
        .single();

    if (programError) {
      console.error(
        "Program creation failed:",
        programError
      );

      return jsonError(
        "Akun dan profil peserta sudah dibuat, tetapi program OJT gagal disimpan. Hubungi administrator sebelum mencoba kembali.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Peserta berhasil didaftarkan. Undangan akun dan program OJT telah dibuat.",
      participant_id: participantId,
      program_id: program.id,
      site,
      start_date: startDate,
      end_date: endDate,
    });
  } catch (error) {
    console.error(
      "Register participant error:",
      error
    );

    return jsonError(
      "Terjadi kesalahan pada server. Periksa data sebelum mencoba kembali.",
      500
    );
  }
}
