
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !publicKey || !secretKey) {
      return NextResponse.json(
        { error: "Konfigurasi server belum lengkap." },
        { status: 500 }
      );
    }

    const authHeader =
      request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();

    const authClient = createClient(url, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: "Sesi login tidak valid." },
        { status: 401 }
      );
    }

    const admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: mentor, error: mentorError } =
      await admin
        .from("profiles")
        .select("id,role")
        .eq("id", authData.user.id)
        .single();

    if (mentorError || mentor?.role !== "mentor") {
      return NextResponse.json(
        { error: "Akses hanya untuk mentor." },
        { status: 403 }
      );
    }

    const { data: profiles, error: profilesError } =
      await admin
        .from("profiles")
        .select("id,full_name,department,role")
        .in("role", ["participant", "peserta"])
        .order("full_name");

    if (profilesError) throw profilesError;

    const participants = profiles || [];
    const ids = participants.map((p) => p.id);

    if (ids.length === 0) {
      return NextResponse.json(
        { participants: [] },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Ambil akun Auth, termasuk tanggal aktivasi.
    const authUsers = [];
    let page = 1;

    while (true) {
      const { data, error } =
        await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });

      if (error) throw error;

      const users = data?.users || [];
      authUsers.push(...users);

      if (users.length < 1000) break;
      page++;
    }

    const authMap = new Map(
      authUsers.map((u) => [u.id, u])
    );

    // Mengambil program OJT sekaligus site penempatan.
    const { data: programs, error: programsError } =
      await admin
        .from("ojt_programs")
        .select(
          "id,participant_id,status,site,start_date,end_date"
        )
        .in("participant_id", ids);

    if (programsError) throw programsError;

    const programIds = (programs || []).map(
      (program) => program.id
    );

    const { data: presence, error: presenceError } =
      await admin
        .from("participant_presence")
        .select("user_id,last_seen_at")
        .in("user_id", ids);

    if (presenceError) throw presenceError;

    let achievements = [];
    let postTests = [];
    let practice = [];
    let samapta = [];
    let simper = [];

    if (programIds.length > 0) {
      const results = await Promise.all([
        admin
          .from("achievement_records")
          .select("program_id,type_code,status")
          .in("program_id", programIds),

        admin
          .from("post_test_scores")
          .select("program_id,score")
          .in("program_id", programIds),

        admin
          .from("weekly_practice_scores")
          .select("program_id,score")
          .in("program_id", programIds),

        admin
          .from("samapta_records")
          .select("program_id,score,outcome")
          .in("program_id", programIds),

        admin
          .from("simper_records")
          .select("program_id,status")
          .in("program_id", programIds),
      ]);

      for (const result of results) {
        if (result.error) {
          throw result.error;
        }
      }

      [
        achievements,
        postTests,
        practice,
        samapta,
        simper,
      ] = results.map(
        (result) => result.data || []
      );
    }

    const presenceMap = new Map(
      (presence || []).map(
        (p) => [p.user_id, p]
      )
    );

    const average = (records) => {
      const values = records
        .filter(
          (r) =>
            r.score !== null &&
            r.score !== undefined &&
            r.score !== ""
        )
        .map((r) => Number(r.score))
        .filter(Number.isFinite);

      if (!values.length) return null;

      return (
        values.reduce((a, b) => a + b, 0) /
        values.length
      );
    };

    const now = Date.now();

    const output = participants.map(
      (participant) => {
        const account = authMap.get(
          participant.id
        );

        const lastSeen =
          presenceMap.get(participant.id)
            ?.last_seen_at || null;

        // Online jika ada aktivitas 2 menit terakhir.
        const online =
          lastSeen &&
          now -
            new Date(lastSeen).getTime() <
            120000;

        const participantPrograms = (
          programs || []
        )
          .filter(
            (p) =>
              p.participant_id ===
              participant.id
          )
          .sort((a, b) =>
            String(b.start_date || "").localeCompare(
              String(a.start_date || "")
            )
          );

        // Utamakan program aktif.
        const activeProgram =
          participantPrograms.find(
            (p) => p.status === "active"
          ) || participantPrograms[0];

        const programId = activeProgram?.id;

        const verifiedTypes = new Set(
          achievements
            .filter(
              (a) =>
                a.program_id === programId &&
                a.status === "verified"
            )
            .map((a) => a.type_code)
        );

        return {
          id: participant.id,
          full_name: participant.full_name,
          department: participant.department,
          email: account?.email || null,

          account_status: !account
            ? "not_found"
            : account.email_confirmed_at
            ? "activated"
            : "invited",

          online: Boolean(online),
          last_seen_at: lastSeen,

          program_id: programId || null,
          program_status:
            activeProgram?.status || null,

          // Site permanen berdasarkan program OJT.
          site: activeProgram?.site || null,

          start_date:
            activeProgram?.start_date || null,
          end_date:
            activeProgram?.end_date || null,

          achievement_count:
            verifiedTypes.size,
          achievement_total: 6,

          post_test_average: average(
            postTests.filter(
              (r) =>
                r.program_id === programId
            )
          ),

          practice_average: average(
            practice.filter(
              (r) =>
                r.program_id === programId
            )
          ),

          samapta_average: average(
            samapta.filter(
              (r) =>
                r.program_id === programId
            )
          ),

          simper_status:
            simper.find(
              (r) =>
                r.program_id === programId
            )?.status || "not_started",
        };
      }
    );

    return NextResponse.json(
      { participants: output },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Mentor participants:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Gagal memuat data monitoring peserta.",
      },
      { status: 500 }
    );
  }
}
