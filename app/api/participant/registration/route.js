
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PENGAMAN SERVER
// API ini khusus simulasi.
// Tidak ada operasi INSERT, UPDATE, atau DELETE.
const REGISTRATION_ENABLED = false;

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

function errorResponse(message, status = 400) {
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

function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    // 1. Hanya menerima permintaan simulasi.
    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Format permintaan tidak valid."
      );
    }

    if (!REGISTRATION_ENABLED && body?.dry_run !== true) {
      return errorResponse(
        "Pendaftaran asli masih dinonaktifkan. Gunakan mode simulasi.",
        403
      );
    }

    // 2. Periksa token login.
    const authorization =
      request.headers.get("authorization") || "";

    const token =
      authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";

    if (!token) {
      return errorResponse(
        "Silakan login terlebih dahulu.",
        401
      );
    }

    const admin = getAdminClient();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return errorResponse(
        "Sesi login tidak valid.",
        401
      );
    }

    const user = authData.user;
    const participantId = user.id;

    // 3. Pastikan email terverifikasi.
    if (!user.email_confirmed_at) {
      return errorResponse(
        "Silakan verifikasi email terlebih dahulu.",
        403
      );
    }

    // 4. Periksa role peserta.
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
      return errorResponse(
        "Profil peserta belum tersedia. Hubungi administrator.",
        409
      );
    }

    if (profile.role !== "participant") {
      return errorResponse(
        "Hanya akun peserta yang dapat mengajukan OJT.",
        403
      );
    }

    // 5. Validasi data pengajuan.
    const fullName =
      typeof body?.full_name === "string"
        ? body.full_name.trim().replace(/\s+/g, " ")
        : "";

    const department =
      typeof body?.department === "string"
        ? body.department.trim()
        : "ER & SS";

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
      return errorResponse(
        "Nama lengkap harus 3 sampai 120 karakter."
      );
    }

    if (department !== "ER & SS") {
      return errorResponse(
        "Departemen harus ER & SS."
      );
    }

    if (!ALLOWED_SITES.includes(site)) {
      return errorResponse(
        "Site OJT tidak valid."
      );
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate)
    ) {
      return errorResponse(
        "Tanggal OJT tidak valid."
      );
    }

    if (endDate < startDate) {
      return errorResponse(
        "Tanggal selesai tidak boleh sebelum tanggal mulai."
      );
    }

    // 6. Periksa program OJT aktif.
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
      return errorResponse(
        "Peserta sudah memiliki program OJT aktif.",
        409
      );
    }

    // 7. Periksa pendaftaran sistem lama.
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
      return errorResponse(
        "Akun sudah mempunyai riwayat pengajuan pada sistem lama. Hubungi mentor untuk pemeriksaan.",
        409
      );
    }

    // 8. Periksa pengajuan sistem baru.
    const {
      data: newRequests,
      error: requestError,
    } = await admin
      .from("ojt_registration_requests")
      .select("id,status")
      .eq("participant_id", participantId)
      .limit(1);

    if (requestError) throw requestError;

    if (newRequests?.length) {
      return errorResponse(
        "Akun sudah memiliki pengajuan OJT. Periksa status pengajuan sebelum mencoba lagi.",
        409
      );
    }

    // 9. MODE SIMULASI.
    // Tidak menyimpan profil atau pengajuan.
    if (!REGISTRATION_ENABLED) {
      return respond({
        success: true,
        dry_run: true,
        message:
          "Simulasi pengajuan berhasil. Validasi akun, data, dan pemeriksaan duplikasi telah dilewati.",
        preview: {
          participant_id: participantId,
          full_name: fullName,
          email: user.email,
          department,
          site,
          start_date: startDate,
          end_date: endDate,
          status: "pending",
        },
        database_changed: false,
      });
    }

    // 10. PENDAFTARAN ASLI BELUM DIIMPLEMENTASIKAN.
    // Fungsi penyimpanan baru perlu dibuat dan diuji
    // sebelum pengaman server dapat dibuka.
    return errorResponse(
      "Pendaftaran asli belum tersedia.",
      503
    );
  } catch (error) {
    console.error(
      "POST participant registration:",
      error
    );

    return errorResponse(
      "Terjadi kesalahan server saat memeriksa pengajuan.",
      500
    );
  }
}
