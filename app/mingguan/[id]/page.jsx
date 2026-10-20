
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 18,
  marginBottom: 16,
};

const button = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const CATEGORIES = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

function parseDate(value) {
  if (!value) return null;

  const parts = value.slice(0, 10).split("-").map(Number);

  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }

  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "-";

  const date = parseDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function weekOf(dateValue, startValue) {
  const date = parseDate(dateValue);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const difference = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  if (difference < 0) return null;

  return Math.floor(difference / 7) + 1;
}

function average(items) {
  const values = items
    .map((item) => Number(item.score))
    .filter((number) => Number.isFinite(number));

  if (!values.length) return null;

  return values.reduce((sum, value) => sum + value, 0) /
    values.length;
}

function displayScore(value) {
  return value === null || value === undefined
    ? "-"
    : Number(value).toFixed(2);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function Stat({ title, value, subtitle }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13 }}>
        {title}
      </div>

      <div
        style={{
          fontSize: 25,
          fontWeight: 800,
          marginTop: 6,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>

      {subtitle && (
        <div
          style={{
            color: "#64748b",
            fontSize: 12,
            marginTop: 5,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default function EvaluasiMingguanOJT() {
  const params = useParams();
  const router = useRouter();
  const programId = params?.id;

  const [program, setProgram] = useState(null);
  const [categories, setCategories] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practice, setPractice] = useState([]);
  const [samapta, setSamapta] = useState([]);

  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!programId) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (profile?.role !== "mentor") {
          router.replace("/dashboard-peserta");
          return;
        }

        const { data: programData, error: programError } =
          await supabase
            .from("ojt_programs")
            .select(`
              id,start_date,end_date,status,
              peserta:profiles!ojt_programs_participant_id_fkey(
                full_name,department
              )
            `)
            .eq("id", programId)
            .single();

        if (programError) throw programError;

        const [
          categoryResult,
          achievementResult,
          postTestResult,
          practiceResult,
          samaptaResult,
        ] = await Promise.all([
          supabase
            .from("achievement_types")
            .select("code,name"),

          supabase
            .from("achievement_records")
            .select(
              "id,type_code,activity_date,status,description"
            )
            .eq("program_id", programId),

          supabase
            .from("post_test_scores")
            .select("id,test_date,score,notes")
            .eq("program_id", programId),

          supabase
            .from("practice_scores")
            .select("*")
            .eq("program_id", programId),

          supabase
            .from("samapta_records")
            .select(
              "id,test_date,test_type,score,outcome,result_value"
            )
            .eq("program_id", programId),
        ]);

        if (categoryResult.error) {
          throw categoryResult.error;
        }

        if (achievementResult.error) {
          throw achievementResult.error;
        }

        if (postTestResult.error) {
          throw postTestResult.error;
        }

        // Data praktik bersifat opsional sampai nama tabel
        // dan kolom dikonfirmasi sesuai database proyek.
        if (practiceResult.error) {
          console.warn(
            "Data praktik belum dapat dimuat:",
            practiceResult.error.message
          );
        }

        if (samaptaResult.error) {
          throw samaptaResult.error;
        }

        if (!active) return;

        setProgram(programData);
        setCategories(categoryResult.data || []);
        setAchievements(achievementResult.data || []);
        setPostTests(postTestResult.data || []);
        setPractice(practiceResult.data || []);
        setSamapta(samaptaResult.data || []);

        const today = new Date();
        const todayISO = [
          today.getFullYear(),
          String(today.getMonth() + 1).padStart(2, "0"),
          String(today.getDate()).padStart(2, "0"),
        ].join("-");

        const currentWeek = weekOf(
          todayISO,
          programData.start_date
        );

        setWeek(Math.max(1, currentWeek || 1));
      } catch (err) {
        if (active) {
          setError(err.message || "Gagal memuat evaluasi.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  const totalWeeks = useMemo(() => {
    if (!program?.start_date) return 1;

    const start = parseDate(program.start_date);
    const end = parseDate(program.end_date);

    if (!start) return 1;

    const today = new Date();

    const todayUTC = new Date(
      Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      )
    );

    const last = end || todayUTC;

    const days = Math.max(
      0,
      Math.round(
        (last.getTime() - start.getTime()) / 86400000
      )
    );

    return Math.max(1, Math.ceil((days + 1) / 7));
  }, [program]);

  const weekly = useMemo(() => {
    if (!program?.start_date) return null;

    const start = parseDate(program.start_date);
    if (!start) return null;

    const weekStart = addDays(start, (week - 1) * 7);
    const weekEnd = addDays(weekStart, 6);

    const startISO = isoDate(weekStart);
    const endISO = isoDate(weekEnd);

    const inWeek = (date) =>
      Boolean(date && date >= startISO && date <= endISO);

    const weeklyAchievements = achievements.filter(
      (item) => inWeek(item.activity_date)
    );

    const weeklyPostTests = postTests.filter(
      (item) => inWeek(item.test_date)
    );

    const weeklyPractice = practice.filter((item) => {
      const date =
        item.practice_date ||
        item.test_date ||
        item.activity_date ||
        item.assessment_date ||
        null;

      return inWeek(date);
    });

    const weeklySamapta = samapta.filter(
      (item) => inWeek(item.test_date)
    );

    const practiceScores = weeklyPractice.map((item) => ({
      score:
        item.score ??
        item.final_score ??
        item.practice_score ??
        null,
    }));

    const samaptaDates = [
      ...new Set(
        weeklySamapta.map((item) => item.test_date)
      ),
    ].sort();

    let samaptaFinal = null;
    let samaptaDate = null;

    for (const date of samaptaDates) {
      const records = weeklySamapta.filter(
        (item) => item.test_date === date
      );

      const getScore = (keywords) => {
        const found = records.find((item) =>
          keywords.some((keyword) =>
            normalize(item.test_type).includes(keyword)
          )
        );

        if (!found) return null;

        const score = Number(found.score);

        return found.score !== null &&
          Number.isFinite(score)
          ? score
          : null;
      };

      const run = getScore(["lari", "run"]);
      const pull = getScore(["pull"]);
      const push = getScore(["push"]);
      const sit = getScore(["sit"]);
      const shuttle = getScore(["shuttle"]);

      if (
        [run, pull, push, sit, shuttle].every(
          (value) => value !== null
        )
      ) {
        const b = (pull + push + sit + shuttle) / 4;
        samaptaFinal = (run + b) / 2;
        samaptaDate = date;
      }
    }

    const categorySummary = CATEGORIES.map((name) => {
      const category = categories.find(
        (item) => normalize(item.name) === normalize(name)
      );

      const code = category?.code;

      const records = code
        ? weeklyAchievements.filter(
            (item) => item.type_code === code
          )
        : [];

      return {
        name,
        total: records.length,
        verified: records.filter(
          (item) => item.status === "verified"
        ).length,
        pending: records.filter(
          (item) => item.status === "pending"
        ).length,
      };
    });

    return {
      startISO,
      endISO,
      weeklyAchievements,
      weeklyPostTests,
      weeklyPractice,
      weeklySamapta,
      categorySummary,
      theoryAverage: average(weeklyPostTests),
      practiceAverage: average(practiceScores),
      samaptaFinal,
      samaptaDate,
      verified: weeklyAchievements.filter(
        (item) => item.status === "verified"
      ).length,
      pending: weeklyAchievements.filter(
        (item) => item.status === "pending"
      ).length,
    };
  }, [
    program,
    week,
    achievements,
    postTests,
    practice,
    samapta,
    categories,
  ]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Evaluasi Mingguan OJT</h2>
        <p>Memuat data peserta...</p>
      </main>
    );
  }

  if (error || !program || !weekly) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Evaluasi Mingguan OJT</h2>
        <p style={{ color: "#b91c1c" }}>
          {error || "Data belum tersedia."}
        </p>
        <button
          style={button}
          onClick={() => router.back()}
        >
          Kembali
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 16,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header
          style={{
            background: "#0f172a",
            color: "#ffffff",
            borderRadius: 16,
            padding: 22,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            OJT MINETRACK · EMERGENCY RESPONSE GROUP
          </div>

          <h1 style={{ marginBottom: 8 }}>
            Evaluasi Mingguan OJT
          </h1>

          <p style={{ marginBottom: 4 }}>
            <strong>
              {program.peserta?.full_name || "Peserta OJT"}
            </strong>
          </p>

          <p style={{ margin: 0, opacity: 0.85 }}>
            {program.peserta?.department || "-"}
          </p>
        </header>

        <button
          type="button"
          style={{
            ...button,
            background: "#475569",
            marginBottom: 16,
          }}
          onClick={() =>
            router.push(`/peserta/${programId}`)
          }
        >
          ← Kembali ke Detail Peserta
        </button>

        <section style={card}>
          <h2>Pilih Minggu Evaluasi</h2>

          <p style={{ color: "#64748b" }}>
            Minggu dihitung setiap tujuh hari sejak
            tanggal mulai OJT peserta.
          </p>

          <select
            value={week}
            onChange={(e) =>
              setWeek(Number(e.target.value))
            }
            style={{
              width: "100%",
              padding: 13,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontSize: 16,
            }}
          >
            {Array.from(
              { length: totalWeeks },
              (_, index) => index + 1
            ).map((number) => (
              <option key={number} value={number}>
                Minggu {number}
              </option>
            ))}
          </select>

          <p>
            <strong>
              {formatDate(weekly.startISO)}
              {" – "}
              {formatDate(weekly.endISO)}
            </strong>
          </p>
        </section>

        <section style={card}>
          <h2>Ringkasan Minggu {week}</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 10,
            }}
          >
            <Stat
              title="Rata-rata Teori"
              value={displayScore(
                weekly.theoryAverage
              )}
              subtitle={`${weekly.weeklyPostTests.length} Post-Test`}
            />

            <Stat
              title="Rata-rata Praktik"
              value={displayScore(
                weekly.practiceAverage
              )}
              subtitle={`${weekly.weeklyPractice.length} penilaian`}
            />

            <Stat
              title="Nilai Samapta"
              value={displayScore(
                weekly.samaptaFinal
              )}
              subtitle={
                weekly.samaptaDate
                  ? formatDate(weekly.samaptaDate)
                  : "Belum ada 5 komponen lengkap"
              }
            />

            <Stat
              title="Pencapaian Terverifikasi"
              value={weekly.verified}
              subtitle={`${weekly.pending} menunggu verifikasi`}
            />
          </div>
        </section>

        <section style={card}>
          <h2>Enam Pencapaian OJT</h2>

          <div style={{ display: "grid", gap: 10 }}>
            {weekly.categorySummary.map((item) => (
              <div
                key={item.name}
                style={{
                  padding: 14,
                  background: "#f8fafc",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                <strong>{item.name}</strong>

                <p style={{ marginBottom: 0 }}>
                  Total: {item.total} · Terverifikasi:{" "}
                  {item.verified} · Pending: {item.pending}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section style={card}>
          <h2>Riwayat Post-Test Minggu {week}</h2>

          {weekly.weeklyPostTests.length === 0 ? (
            <p>Belum ada Post-Test minggu ini.</p>
          ) : (
            weekly.weeklyPostTests.map((item) => (
              <div
                key={item.id}
                style={{
                  borderBottom: "1px solid #e2e8f0",
                  padding: "12px 0",
                }}
              >
                <strong>
                  {formatDate(item.test_date)}
                </strong>
                <div>Nilai: {item.score}</div>
                <div>{item.notes || "-"}</div>
              </div>
            ))
          )}
        </section>

        <section style={card}>
          <h2>Perkembangan Evaluasi</h2>

          <p style={{ color: "#64748b" }}>
            Gunakan pilihan minggu di atas untuk
            membandingkan hasil evaluasi peserta
            dari minggu ke minggu.
          </p>

          <button
            type="button"
            style={{
              ...button,
              width: "100%",
              background: "#0f766e",
            }}
            onClick={() => window.print()}
          >
            Cetak / Simpan Evaluasi Mingguan
          </button>
        </section>

        <footer
          style={{
            textAlign: "center",
            color: "#64748b",
            padding: 20,
            fontSize: 13,
          }}
        >
          OJT MineTrack — PT Berau Coal 2026
        </footer>
      </div>
    </main>
  );
}
