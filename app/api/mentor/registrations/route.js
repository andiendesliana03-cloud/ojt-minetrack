
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
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
    // ================================================
    // 1. VALIDASI TOKEN
    // ================================================

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

    // ================================================
    // 2. VALIDASI ROLE MENTOR
    // ================================================

    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", authData.user.id)
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

    // ================================================
    // 3. AMBIL PENGAJUAN SISTEM BARU
    // ================================================

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
        created_at
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

    // ================================================
    // 4. AMBIL RIWAYAT SISTEM LAMA
    // ================================================

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

    // ================================================
    // 5. KUMPULKAN ID SELURUH PEMILIK PENGAJUAN
    // ================================================

    const participantIds = [
      ...(newRequests || []).map(
        (item) => item.participant_id
      ),
      ...(oldRequests || []).map(
        (item) => item.user_id
      ),
    ].filter(Boolean);

    const uniqueIds = [
      ...new Set(participantIds),
    ];

    // ================================================
    // 6. VERIFIKASI ROLE MELALUI PROFILES
    // ================================================

    let profiles = [];

    if (uniqueIds.length > 0) {
      const {
        data,
        error: profileError,
      } = await admin
        .from("profiles")
        .select("id, full_name, role")
        .in("id", uniqueIds);

      if (profileError) {
        console.error(
          "Participant profile query failed:",
          profileError
        );

        return respond(
          {
            success: false,
            error:
              "Gagal memverifikasi identitas peserta.",
          },
          500
        );
      }

      profiles = data || [];
    }

    const profileMap = new Map(
      profiles.map((profile) => [
        profile.id,
        profile,
      ])
    );

    // Hanya role participant yang diperbolehkan.
    // Admin, mentor, dan profil yang tidak ditemukan
    // tidak dimasukkan ke daftar peserta.

    const isParticipant = (userId) => {
      const profile = profileMap.get(userId);

      return profile?.role === "participant";
    };

    // ================================================
    // 7. FILTER PENGAJUAN SISTEM BARU
    // ================================================

    const validNewRequests = (
      newRequests || []
    ).filter((item) =>
      isParticipant(item.participant_id)
    );

    const currentRegistrations =
      validNewRequests.map((item) => {
        const profile = profileMap.get(
          item.participant_id
        );

        return {
          id: item.id,
          participant_id: item.participant_id,
          user_id: item.participant_id,

          full_name:
            profile?.full_name ||
            "Nama belum tersedia",

          email: null,
          department: item.department,
          site: item.site,
          start_date: item.start_date,
          end_date: item.end_date,
          status: item.status,
          reviewed_by: item.reviewed_by,
          reviewed_at: item.reviewed_at,

          rejection_reason:
            item.rejection_reason || null,

          created_at: item.created_at,
          source: "new",
        };
      });

    // ================================================
    // 8. FILTER RIWAYAT SISTEM LAMA
    // ================================================

    const validOldRequests = (
      oldRequests || []
    ).filter((item) =>
      isParticipant(item.user_id)
    );

    const legacyRegistrations =
      validOldRequests.map((item) => ({
        id: item.id,
        participant_id: item.user_id,
        user_id: item.user_id,

        full_name:
          item.full_name ||
          profileMap.get(item.user_id)?.full_name ||
          "Nama belum tersedia",

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

    // ================================================
    // 9. GABUNGKAN DATA YANG SUDAH TERVERIFIKASI
    // ================================================

    const registrations = [
      ...currentRegistrations,
      ...legacyRegistrations,
    ].sort((a, b) => {
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });

    // ================================================
    // 10. HASIL AKHIR
    // ================================================

    const rawTotal =
      (newRequests || []).length +
      (oldRequests || []).length;

    return respond({
      success: true,

      registrations,

      total: registrations.length,

      new_count:
        currentRegistrations.length,

      legacy_count:
        legacyRegistrations.length,

      // Informasi diagnostik.
      // Tidak mengubah database.
      excluded_non_participant_count:
        rawTotal - registrations.length,
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
