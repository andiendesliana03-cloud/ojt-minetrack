
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
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

export async function GET(request) {
  try {
    const authorization =
      request.headers.get("authorization") || "";

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
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

    // Validasi sesi login pengguna.
    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return respond(
        {
          success: false,
          error: "Sesi login tidak valid.",
        },
        401
      );
    }

    // Semua akun mentor boleh membaca
    // seluruh daftar pengajuan OJT.
    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (mentorError) {
      throw mentorError;
    }

    if (mentor?.role !== "mentor") {
      return respond(
        {
          success: false,
          error: "Akses hanya untuk mentor.",
        },
        403
      );
    }

    // Ambil pengajuan sistem baru,
    // termasuk alasan penolakan.
    const {
      data: newRequests,
      error: newError,
    } = await admin
      .from("ojt_registration_requests")
      .select(`
        id,
        participant_id,
        department,
        site,
        start_date,
        end_date,
        status,
        rejection_reason,
        reviewed_by,
        reviewed_at,
        created_at,
        peserta:profiles!ojt_registration_requests_participant_id_fkey(
          full_name
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (newError) {
      console.error(
        "New registration query failed:",
        newError
      );

      return respond(
        {
          success: false,
          error:
            "Gagal membaca pengajuan dari sistem baru.",
        },
        500
      );
    }

    // Ambil riwayat pendaftaran sistem lama.
    const {
      data: oldRequests,
      error: oldError,
    } = await admin
      .from("participant_registrations")
      .select(`
        id,
        user_id,
        full_name,
        email,
        department,
        site,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      });

    if (oldError) {
      console.error(
        "Old registration query failed:",
        oldError
      );

      return respond(
        {
          success: false,
          error:
            "Gagal membaca riwayat pendaftaran lama.",
        },
        500
      );
    }

    // Samakan struktur pengajuan sistem baru.
    const currentRegistrations = (
      newRequests || []
    ).map((item) => ({
      id: item.id,
      participant_id: item.participant_id,
      user_id: item.participant_id,
      full_name:
        item.peserta?.full_name ||
        "Nama belum tersedia",
      email: null,
      department: item.department,
      site: item.site,
      start_date: item.start_date,
      end_date: item.end_date,
      status: item.status,
      reviewed_by: item.reviewed_by,
      reviewed_at: item.reviewed_at,

      // Alasan penolakan sistem baru.
      rejection_reason:
        item.rejection_reason || null,

      created_at: item.created_at,
      source: "new",
    }));

    // Pertahankan seluruh riwayat sistem lama.
    const legacyRegistrations = (
      oldRequests || []
    ).map((item) => ({
      id: item.id,
      participant_id: item.user_id,
      user_id: item.user_id,
      full_name: item.full_name,
      email: item.email,
      department: item.department,
      site: item.site,
      start_date: null,
      end_date: null,
      status: item.status,
      reviewed_by: item.reviewed_by,
      reviewed_at: item.reviewed_at,
      rejection_reason:
        item.rejection_reason || null,
      created_at: item.created_at,
      source: "legacy",
    }));

    // Gabungkan dan urutkan berdasarkan tanggal.
    const registrations = [
      ...currentRegistrations,
      ...legacyRegistrations,
    ].sort((a, b) => {
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });

    return respond({
      success: true,
      registrations,
      total: registrations.length,
      new_count: currentRegistrations.length,
      legacy_count: legacyRegistrations.length,
    });
  } catch (error) {
    console.error(
      "GET mentor registrations:",
      error
    );

    return respond(
      {
        success: false,
        error:
          "Terjadi kesalahan saat mengambil daftar pengajuan.",
      },
      500
    );
  }
}
