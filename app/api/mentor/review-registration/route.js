
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  canReviewOjt,
  getOjtAccessConfig,
} from "../../../../lib/ojt-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_SITES = [
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
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(message, status = 400) {
  return respond(
    { success: false, error: message },
    status
  );
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function getAdmin() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).trim();

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  ).trim();

  if (!url || !key) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function findRegistration(admin, id, source) {
  // Pendaftaran baru dengan periode individual.
  async function findNew() {
    const { data, error } = await admin
      .from("ojt_registration_requests")
      .select(
        "id,participant_id,department,site,start_date,end_date,status"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    return data
      ? {
          source: "new",
          registration: data,
          participantId: data.participant_id,
        }
      : null;
  }

  // Pendaftaran melalui formulir /daftar.
  async function findLegacy() {
    const { data, error } = await admin
      .from("participant_registrations")
      .select(
        "id,user_id,department,site,status"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    return data
      ? {
          source: "legacy",
          registration: data,
          participantId: data.user_id,
        }
      : null;
  }

  if (source === "new") {
    return findNew();
  }

  if (source === "legacy") {
    return findLegacy();
  }

  // Kompatibilitas frontend lama yang belum
  // mengirimkan source.
  const newer = await findNew();

  if (newer) return newer;

  return findLegacy();
}

function normalizeRpcResult(data) {
  const raw = Array.isArray(data) ? data[0] : data;

  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return raw;
}

export async function POST(request) {
  try {
    // ===============================================
    // 1. BACA PERMINTAAN
    // ===============================================

    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Format JSON tidak valid.");
    }

    const requestId = body?.request_id;
    const decision = body?.decision;
    const dryRun = body?.dry_run === true;

    const source =
      body?.source === "new" ||
      body?.source === "legacy"
        ? body.source
        : null;

    const rejectionReason =
      typeof body?.rejection_reason === "string"
        ? body.rejection_reason.trim()
        : "";

    if (!isUuid(requestId)) {
      return fail("ID pengajuan tidak valid.");
    }

    if (
      body?.source != null &&
      !["new", "legacy"].includes(body.source)
    ) {
      return fail("Sumber pengajuan tidak valid.");
    }

    if (
      decision !== "approved" &&
      decision !== "rejected"
    ) {
      return fail("Keputusan Mentor tidak valid.");
    }

    if (
      decision === "rejected" &&
      (
        rejectionReason.length < 5 ||
        rejectionReason.length > 1000
      )
    ) {
      return fail(
        "Alasan penolakan harus 5–1000 karakter."
      );
    }

    // ===============================================
    // 2. VERIFIKASI LOGIN
    // ===============================================

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return fail(
        "Silakan login sebagai Mentor.",
        401
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return fail("Token login tidak tersedia.", 401);
    }

    const admin = getAdmin();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return fail("Sesi login tidak valid.", 401);
    }

    const mentorId = authData.user.id;

    // ===============================================
    // 3. VALIDASI ROLE MENTOR
    // ===============================================

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
        "Hanya Mentor yang dapat memproses pengajuan.",
        403
      );
    }

    // ===============================================
    // 4. CARI PENGAJUAN DI TABEL YANG BENAR
    // ===============================================

    const found = await findRegistration(
      admin,
      requestId,
      source
    );

    if (!found) {
      return fail(
        "Pengajuan tidak ditemukan pada sumber data yang dipilih.",
        404
      );
    }

    const {
      source: actualSource,
      registration,
      participantId,
    } = found;

    if (registration.status !== "pending") {
      return fail(
        "Pengajuan sudah diproses atau bukan pending.",
        409
      );
    }

    if (!isUuid(participantId)) {
      return fail(
        "Identitas peserta tidak valid.",
        409
      );
    }

    if (participantId === mentorId) {
      return fail(
        "Mentor tidak dapat menyetujui pengajuan sendiri.",
        403
      );
    }

    // ===============================================
    // 5. PERIODE OJT INDIVIDUAL
    // ===============================================

    let site = registration.site || null;
    let startDate = null;
    let endDate = null;

    if (actualSource === "new") {
      startDate = registration.start_date;
      endDate = registration.end_date;

      if (decision === "approved") {
        if (!site || !VALID_SITES.includes(site)) {
          return fail("Site OJT tidak valid.");
        }

        if (
          !isDate(startDate) ||
          !isDate(endDate) ||
          endDate < startDate
        ) {
          return fail(
            "Periode OJT peserta tidak valid.",
            400
          );
        }
      }
    }

    if (actualSource === "legacy") {
      if (decision === "approved") {
        site =
          typeof body?.site === "string"
            ? body.site.trim()
            : registration.site;

        startDate = body?.start_date || null;
        endDate = body?.end_date || null;

        if (!VALID_SITES.includes(site)) {
          return fail(
            "Site OJT tidak valid.",
            400
          );
        }

        if (
          !isDate(startDate) ||
          !isDate(endDate) ||
          endDate < startDate
        ) {
          return fail(
            "Tanggal mulai dan selesai OJT wajib diisi dengan benar.",
            400
          );
        }
      }
    }

    // ===============================================
    // 6. BATASAN AKSES KEPUTUSAN
    // ===============================================

    if (
      !dryRun &&
      !canReviewOjt(
        mentorId,
        participantId,
        decision
      )
    ) {
      return fail(
        "Keputusan belum diizinkan oleh konfigurasi server.",
        403
      );
    }

    // ===============================================
    // 7. PERIKSA PROFIL PESERTA
    // ===============================================

    const {
      data: participant,
      error: participantError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", participantId)
      .maybeSingle();

    if (participantError) throw participantError;

    if (
      !participant ||
      participant.role !== "participant"
    ) {
      return fail(
        "Profil peserta tidak valid.",
        409
      );
    }

    // ===============================================
    // 8. PERIKSA AKUN AUTH
    // ===============================================

    const {
      data: participantAuth,
      error: participantAuthError,
    } = await admin.auth.admin.getUserById(
      participantId
    );

    if (
      participantAuthError ||
      !participantAuth?.user
    ) {
      return fail(
        "Akun peserta tidak ditemukan di Supabase Auth.",
        409
      );
    }

    if (!participantAuth.user.email_confirmed_at) {
      return fail(
        "Akun peserta belum berstatus terkonfirmasi pada Supabase Auth.",
        409
      );
    }

    // ===============================================
    // 9. CEGAH PROGRAM GANDA
    // ===============================================

    if (decision === "approved") {
      let query = admin
        .from("ojt_programs")
        .select("id")
        .eq("participant_id", participantId);

      if (actualSource === "new") {
        query = query.eq("status", "active");
      }

      const {
        data: existing,
        error: existingError,
      } = await query.limit(1);

      if (existingError) throw existingError;

      if (existing?.length) {
        return fail(
          actualSource === "legacy"
            ? "Peserta sudah memiliki program OJT."
            : "Peserta sudah memiliki program OJT aktif.",
          409
        );
      }
    }

    // ===============================================
    // 10. DRY RUN
    // ===============================================

    if (dryRun) {
      return respond({
        success: true,
        dry_run: true,
        database_changed: false,
        source: actualSource,
        preview: {
          registration_id: requestId,
          participant_id: participantId,
          participant_name: participant.full_name,
          mentor_name: mentor.full_name,
          decision,
          site,
          start_date: startDate,
          end_date: endDate,
          rejection_reason:
            decision === "rejected"
              ? rejectionReason
              : null,
        },
      });
    }

    // ===============================================
    // 11. VALIDASI FINAL
    // ===============================================

    if (
      !canReviewOjt(
        mentorId,
        participantId,
        decision
      )
    ) {
      return fail(
        "Transaksi tidak diizinkan oleh konfigurasi server.",
        403
      );
    }

    const accessConfig = getOjtAccessConfig();

    if (
      accessConfig.testModeEnabled &&
      (
        !accessConfig.testParticipantId ||
        !accessConfig.testMentorId
      )
    ) {
      return fail(
        "Konfigurasi akun pengujian belum lengkap.",
        403
      );
    }

    // ===============================================
    // 12. RPC SESUAI JENIS PENDAFTARAN
    // ===============================================

    let rpcData;
    let rpcError;

    if (actualSource === "new") {
      const result = await admin.rpc(
        "review_ojt_registration",
        {
          p_request_id: requestId,
          p_mentor_id: mentorId,
          p_decision: decision,
          p_rejection_reason:
            decision === "rejected"
              ? rejectionReason
              : null,
        }
      );

      rpcData = result.data;
      rpcError = result.error;
    } else {
      const result = await admin.rpc(
        "review_ojt_registration",
        {
          p_registration_id: requestId,
          p_mentor_id: mentorId,
          p_action:
            decision === "approved"
              ? "approve"
              : "reject",
          p_site: site,
          p_start_date: startDate,
          p_end_date: endDate,
          p_rejection_reason:
            decision === "rejected"
              ? rejectionReason
              : null,
        }
      );

      rpcData = result.data;
      rpcError = result.error;
    }

    if (rpcError) {
      console.error(
        "[MENTOR REVIEW] RPC error:",
        rpcError.code,
        rpcError.message
      );

      return fail(
        "Persetujuan gagal diproses oleh database. " +
        "Status pengajuan belum dapat dipastikan.",
        409
      );
    }

    // ===============================================
    // 13. VALIDASI HASIL
    // ===============================================

    const result = normalizeRpcResult(rpcData);

    const resultRegistrationId =
      result?.registration_id ??
      result?.result_registration_id ??
      null;

    const resultStatus =
      result?.registration_status ??
      result?.result_status ??
      null;

    const programId =
      result?.program_id ??
      result?.result_program_id ??
      null;

    if (
      !result ||
      resultStatus !== decision ||
      !resultRegistrationId ||
      String(resultRegistrationId) !== requestId ||
      (
        decision === "approved" &&
        !programId
      )
    ) {
      return fail(
        "Hasil transaksi belum dapat dipastikan. " +
        "Periksa status pengajuan sebelum mencoba ulang.",
        500
      );
    }

    // ===============================================
    // 14. RESPONS SUKSES
    // ===============================================

    return respond({
      success: true,
      dry_run: false,
      source: actualSource,
      registration_id: resultRegistrationId,
      status: resultStatus,
      program_id: programId,
      site,
      start_date: startDate,
      end_date: endDate,
      message:
        decision === "approved"
          ? "Pengajuan berhasil disetujui dan program OJT dibuat."
          : "Pengajuan berhasil ditolak.",
    });
  } catch (error) {
    console.error(
      "[MENTOR REVIEW] Server error:",
      error
    );

    return fail(
      "Terjadi kesalahan server saat memproses keputusan.",
      500
    );
  }
}
