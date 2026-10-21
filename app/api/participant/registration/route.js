
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PENGAMAN UTAMA
// Jangan ubah menjadi true sampai seluruh
// alur pendaftaran umum siap.
const GENERAL_SUBMISSION_ENABLED = false;

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
    {
      success: false,
      error: message,
    },
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

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function createAdminClient() {
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

    // Pengajuan nyata tetap ditutup
    // selama pengembangan.
    if (!dryRun && !GENERAL_SUBMISSION_ENABLED) {
      return fail(
        "Pengajuan OJT untuk peserta umum belum diaktifkan.",
        403
      );
    }

    // Identitas pengguna berasal dari token Auth.
    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return fail(
        "Silakan login sebagai peserta.",
        401
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return fail(
        "Token login tidak tersedia.",
        401
      );
    }

    const admin = createAdminClient();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return fail(
        "Sesi login tidak valid.",
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

    // Periksa profil pada server.
    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role,department")
      .eq("id", participantId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || profile.role !== "participant") {
      return fail(
        "Akun tidak memiliki profil peserta yang valid.",
        403
      );
    }

    // Validasi data pengajuan.
    const fullName =
      typeof body?.full_name === "string"
        ? body.full_name.trim().replace(/\s+/g, " ")
        : "";

    const profileName = String(
      profile.full_name || ""
    )
      .trim()
      .replace(/\s+/g, " ");

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
      fullName !== profileName
    ) {
      return fail(
        "Nama pengajuan tidak sesuai dengan profil peserta."
      );
    }

    if (department !== "ER & SS") {
      return fail(
        "Departemen harus ER & SS."
      );
    }

    if (
      profile.department &&
      profile.department !== "ER & SS"
    ) {
      return fail(
        "Departemen profil tidak sesuai. Hubungi administrator.",
        409
      );
    }

    if (!ALLOWED_SITES.includes(site)) {
      return fail("Site OJT tidak valid.");
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      endDate < startDate
    ) {
      return fail(
        "Periode OJT tidak valid."
      );
    }

    // Cegah peserta yang sudah memiliki
    // program aktif mengajukan kembali.
    const {
      data: activePrograms,
      error: programError,
    } = await admin
      .from("ojt_programs")
      .select("id")
      .eq("participant_id", participantId)
      .eq("status", "active")
      .limit(1);

    if (programError) throw programError;

    if (activePrograms?.length) {
      return fail(
        "Peserta sudah mempunyai program OJT aktif.",
        409
      );
    }

    // Lindungi pendaftaran dari sistem lama.
    const {
      data: legacyRequests,
      error: legacyError,
    } = await admin
      .from("participant_registrations")
      .select("id,status")
      .eq("user_id", participantId)
      .limit(1);

    if (legacyError) throw legacyError;

    if (legacyRequests?.length) {
      return fail(
        "Peserta sudah memiliki riwayat pendaftaran pada sistem lama.",
        409
      );
    }

    // Untuk tahap awal, satu akun hanya
    // diperbolehkan memiliki satu riwayat
    // pengajuan pada sistem baru.
    const {
      data: existingRequests,
      error: existingError,
    } = await admin
      .from("ojt_registration_requests")
      .select("id,status")
      .eq("participant_id", participantId)
      .limit(1);

    if (existingError) throw existingError;

    if (existingRequests?.length) {
      return fail(
        "Peserta sudah mempunyai pengajuan OJT. Silakan periksa statusnya.",
        409
      );
    }

    // SIMULASI: tanpa perubahan database.
    if (dryRun) {
      return respond({
        success: true,
        dry_run: true,
        database_changed: false,
        message:
          "Validasi pengajuan berhasil. Data belum disimpan.",
        preview: {
          participant_id: participantId,
          full_name: profileName,
          email: user.email,
          department,
          site,
          start_date: startDate,
          end_date: endDate,
          status: "pending",
        },
      });
    }

    // PENYIMPANAN NYATA
    // Hanya bisa dicapai setelah pengaman
    // GENERAL_SUBMISSION_ENABLED diaktifkan.
    //
    // Fungsi SQL melakukan validasi ulang
    // dan pemeriksaan duplikasi dalam transaksi.
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
        "Pengajuan tidak dapat disimpan. Periksa status pendaftaran atau hubungi administrator.",
        409
      );
    }

    if (!requestId) {
      return fail(
        "Hasil penyimpanan tidak dapat dipastikan. Periksa status pengajuan.",
        500
      );
    }

    return respond(
      {
        success: true,
        dry_run: false,
        request_id: requestId,
        status: "pending",
        message:
          "Pengajuan OJT berhasil disimpan dan menunggu persetujuan mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "Participant registration API error:",
      error
    );

    return fail(
      "Terjadi kesalahan server saat memproses pengajuan.",
      500
    );
  }
}
