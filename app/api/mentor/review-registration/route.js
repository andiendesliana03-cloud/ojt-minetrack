
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PENGAMAN UTAMA
// Persetujuan sungguhan tetap nonaktif.
const GENERAL_APPROVAL_ENABLED = false;

// Penolakan sungguhan juga belum diaktifkan.
const GENERAL_REJECTION_ENABLED = false;

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

function getAdminClient() {
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

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function POST(request) {
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Format JSON tidak valid.");
    }

    const requestId = body?.request_id;
    const decision = body?.decision;
    const dryRun = body?.dry_run === true;

    if (!isUuid(requestId)) {
      return fail("ID pengajuan tidak valid.");
    }

    if (
      decision !== "approved" &&
      decision !== "rejected"
    ) {
      return fail("Keputusan mentor tidak valid.");
    }

    // Tutup proses nyata selama tahap persiapan.
    if (
      !dryRun &&
      decision === "approved" &&
      !GENERAL_APPROVAL_ENABLED
    ) {
      return fail(
        "Persetujuan OJT umum belum diaktifkan.",
        403
      );
    }

    if (
      !dryRun &&
      decision === "rejected" &&
      !GENERAL_REJECTION_ENABLED
    ) {
      return fail(
        "Penolakan OJT umum belum diaktifkan.",
        403
      );
    }

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return fail(
        "Silakan login sebagai mentor.",
        401
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return fail("Token login tidak tersedia.", 401);
    }

    const admin = getAdminClient();

    // Identitas mentor berasal dari token Auth.
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

    const mentorId = authData.user.id;

    // Pastikan akun benar-benar mentor.
    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", mentorId)
      .maybeSingle();

    if (mentorError) throw mentorError;

    if (!mentor || mentor.role !== "mentor") {
      return fail(
        "Hanya mentor yang boleh memproses pengajuan.",
        403
      );
    }

    // Ambil pengajuan berdasarkan ID.
    const {
      data: registration,
      error: registrationError,
    } = await admin
      .from("ojt_registration_requests")
      .select(
        "id,participant_id,department,site,start_date,end_date,status"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (registrationError) {
      throw registrationError;
    }

    if (!registration) {
      return fail(
        "Pengajuan tidak ditemukan.",
        404
      );
    }

    if (registration.status !== "pending") {
      return fail(
        "Pengajuan sudah diproses.",
        409
      );
    }

    if (registration.participant_id === mentorId) {
      return fail(
        "Mentor tidak dapat memproses pengajuannya sendiri.",
        403
      );
    }

    // Periksa profil peserta.
    const {
      data: participant,
      error: participantError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", registration.participant_id)
      .maybeSingle();

    if (participantError) {
      throw participantError;
    }

    if (
      !participant ||
      participant.role !== "participant"
    ) {
      return fail(
        "Profil peserta tidak valid.",
        409
      );
    }

    // Pemeriksaan awal untuk simulasi.
    // Pemeriksaan final tetap dilakukan
    // oleh fungsi SQL saat transaksi nyata.
    if (decision === "approved") {
      const {
        data: programs,
        error: programError,
      } = await admin
        .from("ojt_programs")
        .select("id")
        .eq(
          "participant_id",
          registration.participant_id
        )
        .eq("status", "active")
        .limit(1);

      if (programError) throw programError;

      if (programs?.length) {
        return fail(
          "Peserta sudah memiliki program OJT aktif.",
          409
        );
      }
    }

    // SIMULASI: tidak menulis data.
    if (dryRun) {
      return respond({
        success: true,
        dry_run: true,
        database_changed: false,
        message:
          "Simulasi keputusan mentor berhasil. Data tidak berubah.",
        preview: {
          registration_id: requestId,
          participant_name: participant.full_name,
          mentor_name: mentor.full_name,
          mentor_id: mentorId,
          decision,
          site: registration.site,
          start_date: registration.start_date,
          end_date: registration.end_date,
        },
      });
    }

    // PERSETUJUAN / PENOLAKAN NYATA
    // Hanya bisa dicapai setelah pengaman
    // yang sesuai diaktifkan.
    //
    // Transaksi SQL akan memeriksa ulang
    // role, status dan duplikasi.
    const {
      data: rpcResult,
      error: rpcError,
    } = await admin.rpc(
      "review_ojt_registration",
      {
        p_request_id: requestId,
        p_mentor_id: mentorId,
        p_decision: decision,
      }
    );

    if (rpcError) {
      console.error(
        "review_ojt_registration:",
        rpcError.code
      );

      return fail(
        "Keputusan belum dapat disimpan. Periksa status pengajuan sebelum mencoba lagi.",
        409
      );
    }

    const result = Array.isArray(rpcResult)
      ? rpcResult[0]
      : rpcResult;

    if (
      !result ||
      result.registration_status !== decision ||
      (decision === "approved" && !result.program_id)
    ) {
      return fail(
        "Hasil proses belum dapat dipastikan. Periksa database sebelum mengulangi.",
        500
      );
    }

    return respond({
      success: true,
      dry_run: false,
      registration_id: result.registration_id,
      status: result.registration_status,
      program_id: result.program_id || null,
      message:
        decision === "approved"
          ? "Pengajuan disetujui dan program OJT aktif berhasil dibuat."
          : "Pengajuan OJT telah ditolak.",
    });
  } catch (error) {
    console.error("Mentor review API:", error);

    return fail(
      "Terjadi kesalahan server.",
      500
    );
  }
}
