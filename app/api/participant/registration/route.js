
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tetap nonaktif sampai alur penggunaan umum siap.
const GENERAL_SUBMISSION_ENABLED =
  process.env.OJT_SUBMISSION_ENABLED === "true";

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

    if (!dryRun && !GENERAL_SUBMISSION_ENABLED) {
      return fail(
        "Pengajuan OJT belum diaktifkan untuk penggunaan umum.",
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

    const admin = createAdminClient();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return fail("Sesi login tidak valid.", 401);
    }

    const user = authData.user;
    const participantId = user.id;

    if (!user.email_confirmed_at) {
      return fail(
        "Email peserta belum terverifikasi.",
        403
      );
    }

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
      return fail("Profil peserta tidak valid.", 403);
    }

    const fullName =
      typeof body?.full_name === "string"
        ? body.full_name.trim().replace(/\s+/g, " ")
        : "";

    const profileName = String(profile.full_name || "")
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
        "Nama tidak sesuai dengan profil peserta."
      );
    }

    if (
      department !== "ER & SS" ||
      (profile.department &&
        profile.department !== "ER & SS")
    ) {
      return fail(
        "Departemen peserta harus ER & SS."
      );
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

    // Periksa program OJT aktif.
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
        "Peserta sudah memiliki program OJT aktif.",
        409
      );
    }

    // Lindungi pendaftaran sistem lama.
    const {
      data: legacyRequests,
      error: legacyError,
    } = await admin
      .from("participant_registrations")
      .select("id")
      .eq("user_id", participantId)
      .limit(1);

    if (legacyError) throw legacyError;

    if (legacyRequests?.length) {
      return fail(
        "Peserta memiliki riwayat pendaftaran lama. Hubungi administrator.",
        409
      );
    }

    // Periksa seluruh status pengajuan baru.
    const {
      data: previousRequests,
      error: requestError,
    } = await admin
      .from("ojt_registration_requests")
      .select("id,status")
      .eq("participant_id", participantId);

    if (requestError) throw requestError;

    const requests = previousRequests || [];

    if (requests.some((r) => r.status === "pending")) {
      return fail(
        "Pengajuan masih menunggu persetujuan mentor.",
        409
      );
    }

    if (requests.some((r) => r.status === "approved")) {
      return fail(
        "Peserta sudah memiliki pengajuan yang disetujui.",
        409
      );
    }

    // Hanya riwayat rejected:
    // peserta boleh mengirim pengajuan baru.
    const rejectionCount = requests.filter(
      (r) => r.status === "rejected"
    ).length;

    if (dryRun) {
      return respond({
        success: true,
        dry_run: true,
        database_changed: false,
        message:
          "Validasi berhasil. Pengajuan dapat dibuat tanpa menghapus riwayat sebelumnya.",
        preview: {
          participant_id: participantId,
          full_name: profileName,
          email: user.email,
          department,
          site,
          start_date: startDate,
          end_date: endDate,
          status: "pending",
          jumlah_riwayat_penolakan: rejectionCount,
        },
      });
    }

    // Penyimpanan nyata hanya dijalankan
    // saat GENERAL_SUBMISSION_ENABLED = true.
    // Fungsi SQL memeriksa kembali kondisi
    // dan mencegah duplikasi dalam transaksi.
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
        "submit_ojt_request error:",
        rpcError.code
      );

      return fail(
        "Pengajuan tidak dapat disimpan. Periksa status pengajuan sebelum mencoba lagi.",
        409
      );
    }

    if (!requestId) {
      return fail(
        "Status penyimpanan belum dapat dipastikan. Periksa riwayat pengajuan.",
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
          "Pengajuan OJT berhasil dikirim dan menunggu persetujuan mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "Participant registration API:",
      error
    );

    return fail(
      "Terjadi kesalahan server.",
      500
    );
  }
}
