
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function jsonError(message, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
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
        "Konfigurasi Supabase pada server belum lengkap.",
        500
      );
    }

    // 1. Siapkan koneksi Supabase.
    const authClient = createClient(url, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 2. Periksa token login.
    const authHeader =
      request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonError(
        "Silakan login terlebih dahulu.",
        401
      );
    }

    const token = authHeader.slice(7).trim();

    const {
      data: authData,
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return jsonError(
        "Sesi login tidak valid. Silakan login kembali.",
        401
      );
    }

    // 3. Verifikasi akses mentor.
    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", authData.user.id)
      .single();

    if (mentorError || mentor?.role !== "mentor") {
      return jsonError(
        "Akses pendaftaran hanya untuk mentor.",
        403
      );
    }

    // 4. Baca data formulir.
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Format data pendaftaran tidak valid."
      );
    }

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

    const dryRun = body.dry_run === true;

    // 5. Validasi data.
    if (fullName.length < 3) {
      return jsonError(
        "Nama peserta minimal 3 karakter."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return jsonError(
        "Format email peserta tidak valid."
      );
    }

    if (!department) {
      return jsonError(
        "Departemen wajib diisi."
      );
    }

    if (!ALLOWED_SITES.includes(site)) {
      return jsonError(
        "Site OJT tidak valid. Pilih salah satu dari 9 site."
      );
    }

    if (!validDate(startDate)) {
      return jsonError(
        "Tanggal mulai OJT tidak valid."
      );
    }

    if (!validDate(endDate)) {
      return jsonError(
        "Tanggal selesai OJT tidak valid."
      );
    }

    if (endDate < startDate) {
      return jsonError(
        "Tanggal selesai tidak boleh lebih awal dari tanggal mulai."
      );
    }

    // 6. MODE SIMULASI.
    // Tidak membuat akun, mengirim undangan,
    // atau menulis data ke database.
    if (dryRun) {
      return NextResponse.json(
        {
          success: true,
          dry_run: true,
          message:
            "Simulasi berhasil. Validasi data dan akses mentor berhasil diperiksa.",
          preview: {
            full_name: fullName,
            email,
            department,
            site,
            start_date: startDate,
            end_date: endDate,
            status: "active",
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // 7. PENDAFTARAN ASLI.
    // Periksa email yang sudah terdaftar.
    let page = 1;

    while (true) {
      const {
        data: usersData,
        error: usersError,
      } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (usersError) {
        console.error(
          "Failed to list users:",
          usersError
        );

        return jsonError(
          "Gagal memeriksa email peserta.",
          500
        );
      }

      const users = usersData?.users || [];

      const existingUser = users.find(
        (user) =>
          user.email?.toLowerCase() === email
      );

      if (existingUser) {
        return jsonError(
          "Email sudah terdaftar. Gunakan email peserta yang belum terdaftar.",
          409
        );
      }

      if (users.length < 1000) {
        break;
      }

      page += 1;
    }

    // 8. Buat akun peserta dan kirim undangan.
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
      console.error(
        "Invitation failed:",
        inviteError
      );

      return jsonError(
        "Gagal membuat akun atau mengirim undangan peserta.",
        500
      );
    }

    const participantId = invited?.user?.id;

    if (!participantId) {
      return jsonError(
        "Akun peserta tidak berhasil dibuat.",
        500
      );
    }

    // 9. Simpan profil peserta.
    // PERBAIKAN: tidak menyimpan kolom site
    // pada tabel profiles.
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
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      console.error(
        "Failed to save profile:",
        profileError
      );

      return jsonError(
        "Akun peserta sudah dibuat, tetapi profil gagal disimpan. Jangan mendaftar ulang sebelum diperiksa administrator.",
        500
      );
    }

    // 10. Periksa program aktif.
    const {
      data: existingPrograms,
      error: checkError,
    } = await admin
      .from("ojt_programs")
      .select("id")
      .eq("participant_id", participantId)
      .eq("status", "active")
      .limit(1);

    if (checkError) {
      console.error(
        "Failed to check OJT program:",
        checkError
      );

      return jsonError(
        "Akun peserta sudah dibuat, tetapi pemeriksaan program OJT gagal. Hubungi administrator.",
        500
      );
    }

    if (existingPrograms?.length) {
      return jsonError(
        "Peserta sudah memiliki program OJT aktif.",
        409
      );
    }

    // 11. Buat program OJT.
    // Site disimpan hanya pada ojt_programs.
    const {
      data: program,
      error: programError,
    } = await admin
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
        "Failed to create OJT program:",
        programError
      );

      return jsonError(
        "Akun dan profil peserta sudah dibuat, tetapi program OJT gagal disimpan. Hubungi administrator sebelum mencoba kembali.",
        500
      );
    }

    // 12. Respons pendaftaran berhasil.
    return NextResponse.json(
      {
        success: true,
        dry_run: false,
        message:
          "Peserta berhasil didaftarkan dan program OJT berhasil dibuat.",
        participant_id: participantId,
        program_id: program.id,
        site,
        start_date: startDate,
        end_date: endDate,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Register participant error:",
      error
    );

    return jsonError(
      "Terjadi kesalahan pada server. Periksa status pendaftaran sebelum mencoba kembali.",
      500
    );
  }
}
