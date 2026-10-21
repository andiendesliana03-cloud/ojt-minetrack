
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Khusus satu persetujuan pengujian.
const TEST_APPROVAL_ENABLED = false;

const TEST_REQUEST_ID =
  "97f39c14-216f-4bc9-9a1e-da2383ab9271";

const TEST_PARTICIPANT_ID =
  "4e1256e3-ef0b-457d-a7a5-162dc8a1f332";

const TEST_MENTOR_ID =
  "21393f8a-dfd4-4ee9-b08b-0166fdf246cc";

function reply(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(message, status = 400) {
  return reply(
    { success: false, error: message },
    status
  );
}

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return fail(
        "Konfigurasi server belum lengkap.",
        503
      );
    }

    const admin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return fail("Silakan login sebagai mentor.", 401);
    }

    const token = authorization.slice(7).trim();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return fail("Sesi login tidak valid.", 401);
    }

    const mentorId = authData.user.id;

    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", mentorId)
      .maybeSingle();

    if (mentorError) throw mentorError;

    if (
      mentor?.role !== "mentor" ||
      mentorId !== TEST_MENTOR_ID
    ) {
      return fail(
        "Hanya Mentor OJT pengujian yang diizinkan.",
        403
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Format permintaan tidak valid.");
    }

    const requestId = body?.request_id;
    const decision = body?.decision;
    const dryRun = body?.dry_run === true;

    if (requestId !== TEST_REQUEST_ID) {
      return fail(
        "Pengajuan ini tidak termasuk pengujian.",
        403
      );
    }

    if (decision !== "approved") {
      return fail(
        "Pengujian ini hanya mengizinkan persetujuan.",
        403
      );
    }

    const {
      data: registration,
      error: registrationError,
    } = await admin
      .from("ojt_registration_requests")
      .select(
        "id,participant_id,status,site,start_date,end_date"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (registrationError) throw registrationError;

    if (!registration) {
      return fail("Pengajuan tidak ditemukan.", 404);
    }

    if (
      registration.participant_id !==
      TEST_PARTICIPANT_ID
    ) {
      return fail(
        "Identitas peserta tidak sesuai.",
        403
      );
    }

    if (registration.status !== "pending") {
      return fail(
        "Pengajuan sudah diproses.",
        409
      );
    }

    // Jalur simulasi tetap tersedia.
    if (dryRun) {
      return reply({
        success: true,
        dry_run: true,
        database_changed: false,
        message:
          "Simulasi persetujuan berhasil. Data tidak diubah.",
        preview: {
          request_id: requestId,
          participant_id:
            registration.participant_id,
          mentor_id: mentorId,
          decision,
          site: registration.site,
          start_date: registration.start_date,
          end_date: registration.end_date,
        },
      });
    }

    // Pengaman khusus satu pengajuan.
    if (!TEST_APPROVAL_ENABLED) {
      return fail(
        "Persetujuan asli belum diaktifkan.",
        403
      );
    }

    // Panggil fungsi transaksi Supabase.
    const {
      data: result,
      error: rpcError,
    } = await admin.rpc(
      "review_ojt_registration",
      {
        p_request_id: requestId,
        p_mentor_id: mentorId,
        p_decision: "approved",
      }
    );

    if (rpcError) {
      console.error(
        "Review OJT error:",
        rpcError.code
      );

      return fail(
        "Persetujuan gagal. Periksa status pengajuan.",
        409
      );
    }

    const approved = Array.isArray(result)
      ? result[0]
      : result;

    if (
      approved?.registration_status !==
        "approved" ||
      !approved?.program_id
    ) {
      return fail(
        "Hasil persetujuan tidak sesuai. Periksa database sebelum mencoba lagi.",
        500
      );
    }

    return reply({
      success: true,
      dry_run: false,
      registration_id:
        approved.registration_id,
      status: approved.registration_status,
      program_id: approved.program_id,
      message:
        "Pengajuan berhasil disetujui. Program OJT aktif telah dibuat.",
    });
  } catch (error) {
    console.error(
      "Mentor review error:",
      error
    );

    return fail(
      "Terjadi kesalahan server.",
      500
    );
  }
}
