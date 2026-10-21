
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PENGAMAN: Pendaftaran asli belum diaktifkan.
const REGISTRATION_ENABLED = false;

const SITES = [
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

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function fail(message, status = 400) {
  return json(
    { success: false, error: message },
    status
  );
}

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(value + "T00:00:00Z");

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Format JSON tidak valid.");
    }

    const dryRun = body?.dry_run === true;

    // Pengaman utama: hanya simulasi.
    if (!REGISTRATION_ENABLED && !dryRun) {
      return fail(
        "Pendaftaran asli masih dinonaktifkan.",
        403
      );
    }

    // Ambil token login dari Authorization header.
    const authHeader =
      request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return fail(
        "Silakan login terlebih dahulu.",
        401
      );
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return fail("Token login tidak tersedia.", 401);
    }

    const admin = adminClient();

    // Validasi token langsung ke Supabase Auth.
    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return fail(
        "Sesi login tidak valid atau sudah berakhir.",
        401
      );
    }

    const user = authData.user;
    const participantId = user.id;

    if (!user.email_confirmed_at) {
      return fail(
        "Email peserta belum diverifikasi.",
        403
      );
    }

    // Identitas peserta selalu berasal dari token,
    // bukan dari request body.
    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role,department")
      .eq("id", participantId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      return fail(
        "Profil peserta belum tersedia.",
        409
      );
    }

    if (profile.role !== "participant") {
      return fail(
        "Hanya peserta yang dapat membuat pengajuan OJT.",
        403
      );
    }

    // Validasi formulir.
    const fullName =
      typeof body?.full_name === "string"
        ? body.full_name.trim().replace(/\s+/g, " ")
        : "";

    const department =
      typeof body?.department === "string"
        ? body.department.trim()
        : "";

    const site =
      typeof body?.site === "string"
        ? body.site.trim().toUpperCase()
        : "";

    const startDate = body?.start_date;
    const endDate = body?.end_date;

    if (
      fullName.length < 3 ||
      fullName.length > 120
    ) {
      return fail(
        "Nama lengkap harus 3–120 karakter."
      );
    }

    if (!profile.full_name?.trim()) {
      return fail(
        "Nama pada profil peserta belum tersedia. Hubungi administrator.",
        409
      );
    }

    if (department !== "ER & SS") {
      return fail("Departemen harus ER & SS.");
    }

    if (!SITES.includes(site)) {
      return fail("Site OJT tidak valid.");
    }

    if (
      !isValidDate(startDate) ||
      !isValidDate(endDate) ||
      endDate < startDate
    ) {
      return fail("Periode OJT tidak valid.");
    }

    // Cek program aktif.
    const {
      data: programs,
      error: programsError,
    } = await admin
      .from("ojt_programs")
      .select("id")
      .eq("participant_id", participantId)
      .eq("status", "active")
      .limit(1);

    if (programsError) throw programsError;

    if (programs?.length) {
      return fail(
        "Peserta sudah memiliki program OJT aktif.",
        409
      );
    }

    // Cek riwayat pendaftaran lama.
    const {
      data: legacy,
      error: legacyError,
    } = await admin
      .from("participant_registrations")
      .select("id")
      .eq("user_id", participantId)
      .limit(1);

    if (legacyError) throw legacyError;

    if (legacy?.length) {
      return fail(
        "Peserta memiliki riwayat pendaftaran lama.",
        409
      );
    }

    // Cek pengajuan sistem baru.
    const {
      data: existing,
      error: existingError,
    } = await admin
      .from("ojt_registration_requests")
      .select("id,status")
      .eq("participant_id", participantId)
      .limit(1);

    if (existingError) throw existingError;

    if (existing?.length) {
      return fail(
        "Peserta sudah memiliki pengajuan OJT.",
        409
      );
    }

    // MODE SIMULASI:
    // Validasi berhasil, tetapi database tidak diubah.
    if (dryRun) {
      return json({
        success: true,
        dry_run: true,
        database_changed: false,
        message:
          "Simulasi berhasil. Pengajuan belum disimpan.",
        preview: {
          participant_id: participantId,
          full_name: profile.full_name,
          email: user.email,
          department,
          site,
          start_date: startDate,
          end_date: endDate,
          status: "pending",
        },
      });
    }

    // JALUR PENYIMPANAN ASLI:
    // Tidak bisa dicapai selama
    // REGISTRATION_ENABLED = false.
    //
    // Fungsi Supabase memvalidasi ulang data
    // dan menangani permintaan bersamaan.
    const {
      data: requestId,
      error: rpcError,
    } = await admin.rpc("submit_ojt_request", {
      p_participant_id: participantId,
      p_department: department,
      p_site: site,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (rpcError) {
      console.error(
        "submit_ojt_request failed:",
        rpcError.code
      );

      return fail(
        "Pengajuan tidak dapat disimpan. Periksa apakah akun sudah memiliki pengajuan atau program aktif.",
        409
      );
    }

    return json(
      {
        success: true,
        dry_run: false,
        request_id: requestId,
        status: "pending",
        message:
          "Pengajuan OJT berhasil dikirim dan menunggu persetujuan mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "Participant registration error:",
      error
    );

    return fail(
      "Terjadi kesalahan server saat memproses pengajuan.",
      500
    );
  }
}
