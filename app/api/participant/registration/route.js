
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PENGAMAN PENGUJIAN
// Tetap false sampai tombol pengajuan asli siap diuji.
const TEST_SUBMISSION_ENABLED = true;

// Hanya peserta ini yang boleh mengikuti uji
// pengajuan sungguhan ketika pengaman dibuka.
const TEST_PARTICIPANT_ID =
  "4e1256e3-ef0b-457d-a7a5-162dc8a1f332";

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

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function fail(message, status = 400) {
  return respond(
    { success: false, error: message },
    status
  );
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const d = new Date(value + "T00:00:00Z");

  return (
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === value
  );
}

function getAdmin() {
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
      return fail("Format permintaan tidak valid.");
    }

    const dryRun = body?.dry_run === true;

    if (!dryRun && !TEST_SUBMISSION_ENABLED) {
      return fail(
        "Penyimpanan pengajuan masih dinonaktifkan.",
        403
      );
    }

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return fail("Silakan login terlebih dahulu.", 401);
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return fail("Token login tidak tersedia.", 401);
    }

    const admin = getAdmin();

    // Validasi login menggunakan Supabase Auth.
    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return fail("Sesi login tidak valid.", 401);
    }

    const user = authData.user;

    // Pembatasan akun pengujian dilakukan di server.
    if (user.id !== TEST_PARTICIPANT_ID) {
      return fail(
        "Pengujian ini hanya tersedia untuk akun Peserta OJT.",
        403
      );
    }

    if (!user.email_confirmed_at) {
      return fail(
        "Email peserta belum diverifikasi.",
        403
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role,department")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || profile.role !== "participant") {
      return fail(
        "Profil peserta tidak valid.",
        403
      );
    }

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
      fullName.length > 120 ||
      fullName !== profile.full_name?.trim()
    ) {
      return fail(
        "Nama peserta tidak sesuai dengan profil."
      );
    }

    if (department !== "ER & SS") {
      return fail("Departemen harus ER & SS.");
    }

    if (!SITES.includes(site)) {
      return fail("Site OJT tidak valid.");
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      endDate < startDate
    ) {
      return fail("Periode OJT tidak valid.");
    }

    // Periksa program aktif.
    const {
      data: programs,
      error: programError,
    } = await admin
      .from("ojt_programs")
      .select("id")
      .eq("participant_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (programError) throw programError;

    if (programs?.length) {
      return fail(
        "Peserta sudah mempunyai program aktif.",
        409
      );
    }

    // Periksa pengajuan lama.
    const {
      data: legacy,
      error: legacyError,
    } = await admin
      .from("participant_registrations")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (legacyError) throw legacyError;

    if (legacy?.length) {
      return fail(
        "Peserta sudah mempunyai riwayat pendaftaran lama.",
        409
      );
    }

    // Periksa pengajuan sistem baru.
    const {
      data: existing,
      error: existingError,
    } = await admin
      .from("ojt_registration_requests")
      .select("id,status")
      .eq("participant_id", user.id)
      .limit(1);

    if (existingError) throw existingError;

    if (existing?.length) {
      return fail(
        "Peserta sudah memiliki pengajuan OJT.",
        409
      );
    }

    // Simulasi: tidak menyimpan data.
    if (dryRun) {
      return respond({
        success: true,
        dry_run: true,
        database_changed: false,
        message: "Simulasi pengajuan berhasil.",
        preview: {
          participant_id: user.id,
          full_name: profile.full_name,
          department,
          site,
          start_date: startDate,
          end_date: endDate,
          status: "pending",
        },
      });
    }

    // Penyimpanan nyata: hanya dapat dijalankan
    // jika TEST_SUBMISSION_ENABLED = true.
    const {
      data: requestId,
      error: rpcError,
    } = await admin.rpc("submit_ojt_request", {
      p_participant_id: user.id,
      p_department: department,
      p_site: site,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (rpcError) {
      console.error(
        "submit_ojt_request:",
        rpcError.code
      );

      return fail(
        "Pengajuan gagal disimpan atau sudah pernah diajukan.",
        409
      );
    }

    return respond(
      {
        success: true,
        dry_run: false,
        request_id: requestId,
        status: "pending",
        message:
          "Pengajuan berhasil disimpan dan menunggu persetujuan mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "Participant registration error:",
      error
    );

    return fail(
      "Terjadi kesalahan server.",
      500
    );
  }
}
