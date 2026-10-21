
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Jangan aktifkan selama pengujian.
const APPROVAL_ENABLED = false;

function respond(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function validUUID(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Konfigurasi server belum lengkap.");
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
      return respond(
        { success: false, error: "JSON tidak valid." },
        400
      );
    }

    const dryRun = body?.dry_run === true;

    // Pendaftaran asli harus tetap terkunci.
    if (!APPROVAL_ENABLED && !dryRun) {
      return respond(
        {
          success: false,
          error:
            "Persetujuan asli sedang dinonaktifkan. Gunakan simulasi.",
        },
        403
      );
    }

    const requestId = body?.request_id;
    const decision = body?.decision;

    if (!validUUID(requestId)) {
      return respond(
        {
          success: false,
          error: "ID pengajuan tidak valid.",
        },
        400
      );
    }

    if (
      decision !== "approved" &&
      decision !== "rejected"
    ) {
      return respond(
        {
          success: false,
          error: "Keputusan tidak valid.",
        },
        400
      );
    }

    const authHeader =
      request.headers.get("authorization") || "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return respond(
        {
          success: false,
          error: "Silakan login terlebih dahulu.",
        },
        401
      );
    }

    const admin = getAdminClient();

    // Verifikasi identitas melalui Supabase Auth.
    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return respond(
        {
          success: false,
          error: "Sesi tidak valid.",
        },
        401
      );
    }

    const mentorId = authData.user.id;

    // Pastikan yang login adalah mentor.
    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", mentorId)
      .maybeSingle();

    if (mentorError) throw mentorError;

    if (mentor?.role !== "mentor") {
      return respond(
        {
          success: false,
          error: "Akses hanya untuk mentor.",
        },
        403
      );
    }

    // Ambil pengajuan dari tabel baru.
    const {
      data: registration,
      error: lookupError,
    } = await admin
      .from("ojt_registration_requests")
      .select(
        "id,participant_id,department,site,start_date,end_date,status"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!registration) {
      return respond(
        {
          success: false,
          error: "Pengajuan tidak ditemukan.",
        },
        404
      );
    }

    if (registration.status !== "pending") {
      return respond(
        {
          success: false,
          error: "Pengajuan sudah diproses.",
        },
        409
      );
    }

    if (registration.participant_id === mentorId) {
      return respond(
        {
          success: false,
          error:
            "Mentor tidak boleh menjadi peserta yang disetujui.",
        },
        403
      );
    }

    // MODE SIMULASI
    // Tidak menjalankan INSERT, UPDATE, atau RPC.
    if (dryRun) {
      return respond({
        success: true,
        dry_run: true,
        message:
          "Simulasi berhasil. Tidak ada data yang diubah.",
        preview: {
          request_id: registration.id,
          participant_id: registration.participant_id,
          mentor_id: mentorId,
          decision,
          site: registration.site,
          start_date: registration.start_date,
          end_date: registration.end_date,
        },
      });
    }

    // MODE ASLI
    // Fungsi database menjalankan transaksi.
    const {
      data,
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
        "review_ojt_registration failed:",
        rpcError
      );

      return respond(
        {
          success: false,
          error:
            "Keputusan tidak dapat diproses. Perbarui daftar pengajuan dan periksa statusnya.",
        },
        409
      );
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    if (!result) {
      throw new Error(
        "Fungsi persetujuan tidak mengembalikan hasil."
      );
    }

    return respond({
      success: true,
      dry_run: false,
      registration_id: result.registration_id,
      status: result.registration_status,
      program_id: result.program_id,
      message:
        result.registration_status === "approved"
          ? "Pengajuan disetujui dan program OJT dibuat."
          : "Pengajuan ditolak.",
    });
  } catch (error) {
    console.error(
      "POST review-registration:",
      error
    );

    return respond(
      {
        success: false,
        error: "Terjadi kesalahan server.",
      },
      500
    );
  }
}
