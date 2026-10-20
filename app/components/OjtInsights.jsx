
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const box = {
  background: "#fff",
  border: "1px solid #dbe3ef",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
};

const btn = {
  background: "#2563eb",
  color: "white",
  padding: "12px 16px",
  border: 0,
  borderRadius: 9,
  fontWeight: 700,
  cursor: "pointer",
};

const stages = [
  "administration_status",
  "training_status",
  "theory_status",
  "practice_status",
];

const labels = {
  pass: "Lulus",
  fail: "Tidak Lulus",
  pending: "Menunggu",
  passed: "Lulus",
  failed: "Tidak Lulus",
  in_progress: "Dalam Proses",
  not_started: "Belum Proses",
};

function average(rows) {
  const numbers = rows
    .map((x) => Number(x.score))
    .filter((x) => Number.isFinite(x));

  return numbers.length
    ? (
        numbers.reduce((a, b) => a + b, 0) /
        numbers.length
      ).toFixed(1)
    : "-";
}

function date(value) {
  return value
    ? String(value)
        .slice(0, 10)
        .split("-")
        .reverse()
        .join("/")
    : "-";
}

function Bar({ name, pct, color = "#2563eb" }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <strong>{name}</strong>
        <strong>{pct}%</strong>
      </div>

      <div
        style={{
          height: 12,
          background: "#e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          marginTop: 8,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function ScoreList({
  title,
  rows,
  dateKey,
  nameKey,
  showOutcome = false,
}) {
  return (
    <section style={box}>
      <h3>{title}</h3>

      {!rows.length && <p>Belum ada data.</p>}

      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            padding: "12px 0",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <strong>Nilai: {r.score ?? "-"}</strong>
          <p style={{ margin: "5px 0" }}>
            Tanggal: {date(r[dateKey])}
          </p>
          {nameKey && r[nameKey] && (
            <p style={{ margin: "5px 0" }}>
              Jenis: {r[nameKey]}
            </p>
          )}
          {showOutcome && (
            <p style={{ margin: "5px 0" }}>
              Hasil: {labels[r.outcome] || "-"}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

export default function OjtInsights({ id, mode }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let alive = true;

    async function run() {
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
            .select("id,full_name,role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        const { data: program, error: programError } =
          await supabase
            .from("ojt_programs")
            .select(`
              id,participant_id,start_date,end_date,status,
              peserta:profiles!ojt_programs_participant_id_fkey(
                full_name,department
              )
            `)
            .eq("id", id)
            .single();

        if (programError) throw programError;

        if (
          profile.role !== "mentor" &&
          program.participant_id !== user.id
        ) {
          throw new Error(
            "Anda tidak memiliki akses ke data peserta ini."
          );
        }

        const results = await Promise.all([
          supabase
            .from("achievement_types")
            .select("code,name"),

          supabase
            .from("achievement_records")
            .select("id,type_code,status")
            .eq("program_id", id),

          supabase
            .from("post_test_scores")
            .select("id,test_date,score")
            .eq("program_id", id)
            .order("test_date"),

          supabase
            .from("weekly_practice_scores")
            .select(
              "id,practice_date,practice_name,score"
            )
            .eq("program_id", id)
            .order("practice_date"),

          supabase
            .from("samapta_records")
            .select(
              "id,test_date,test_type,score,outcome"
            )
            .eq("program_id", id)
            .order("test_date"),

          supabase
            .from("simper_records")
            .select(`
              status,
              administration_status,
              training_status,
              theory_status,
              practice_status,
              graduation_date
            `)
            .eq("program_id", id)
            .maybeSingle(),
        ]);

        for (const result of results) {
          if (result.error) throw result.error;
        }

        if (alive) {
          setData({
            profile,
            program,
            types: results[0].data || [],
            ach: results[1].data || [],
            post: results[2].data || [],
            practice: results[3].data || [],
            samapta: results[4].data || [],
            simper: results[5].data,
          });
        }
      } catch (err) {
        if (alive) {
          setError(err.message || "Gagal memuat data.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [id, router]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        Memuat data OJT...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main style={{ padding: 24, color: "#b91c1c" }}>
        {error || "Data tidak tersedia."}
      </main>
    );
  }

  const {
    program,
    types,
    ach,
    post,
    practice,
    samapta,
    simper,
  } = data;

  const verified = new Set(
    ach
      .filter((x) => x.status === "verified")
      .map((x) => x.type_code)
  );

  const totalCategories = types.length || 6;

  const achPct = Math.round(
    (verified.size / totalCategories) * 100
  );

  const passedStages = simper
    ? stages.filter(
        (key) => simper[key] === "passed"
      ).length
    : 0;

  const simperPct = passedStages * 25;

  const passedSamapta = samapta.filter(
    (x) => x.outcome === "pass"
  ).length;

  const checks = [
    {
      title: "Enam kategori OJT terverifikasi",
      ok: verified.size >= totalCategories,
    },
    {
      title: "Memiliki nilai Post-Test",
      ok: post.length > 0,
    },
    {
      title: "Memiliki penilaian praktik",
      ok: practice.length > 0,
    },
    {
      title: "Memiliki hasil Samapta",
      ok: samapta.length > 0,
    },
    {
      title: "SIMPER berstatus lulus",
      ok: simper?.status === "passed",
    },
  ];

  const checksPassed = checks.filter(
    (x) => x.ok
  ).length;

  const pageTitle = {
    analisis: "Grafik Perkembangan OJT",
    evaluasi: "Evaluasi Kesiapan Kelulusan",
    laporan: "Laporan Monitoring OJT",
  }[mode] || "Monitoring OJT";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 18,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: 850,
          margin: "auto",
        }}
      >
        <div
          className="no-print"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 15,
          }}
        >
          <button
            style={btn}
            onClick={() => router.back()}
          >
            ← Kembali
          </button>

          {mode === "laporan" && (
            <button
              style={{
                ...btn,
                background: "#0f766e",
              }}
              onClick={() => window.print()}
            >
              Cetak / Simpan PDF
            </button>
          )}
        </div>

        <header
          style={{
            ...box,
            background: "#0f172a",
            color: "white",
          }}
        >
          <h1>{pageTitle}</h1>
          <p>
            Emergency Response Group
          </p>
          <p>PT Berau Coal 2026</p>

          <h2>
            {program.peserta?.full_name ||
              "Peserta OJT"}
          </h2>

          <p>
            {program.peserta?.department || "-"}
          </p>

          <p>
            {date(program.start_date)} –{" "}
            {date(program.end_date)}
          </p>
        </header>

        {(mode === "analisis" ||
          mode === "laporan") && (
          <>
            <section style={box}>
              <h2>Grafik Progres OJT</h2>

              <Bar
                name="Enam Pencapaian OJT"
                pct={achPct}
              />

              <Bar
                name="Tahapan SIMPER"
                pct={simperPct}
                color="#7c3aed"
              />

              <p>
                {verified.size} dari{" "}
                {totalCategories} kategori
                terverifikasi.
              </p>

              <p>
                {passedStages} dari 4 tahapan
                SIMPER lulus.
              </p>
            </section>

            <section style={box}>
              <h2>Ringkasan Nilai</h2>

              <p>
                Post-Test:{" "}
                <strong>{average(post)}</strong>{" "}
                ({post.length} tes)
              </p>

              <p>
                Praktik Mingguan:{" "}
                <strong>
                  {average(practice)}
                </strong>{" "}
                ({practice.length} penilaian)
              </p>

              <p>
                Samapta:{" "}
                <strong>
                  {average(samapta)}
                </strong>{" "}
                ({samapta.length} tes,{" "}
                {passedSamapta} lulus)
              </p>

              <p>
                SIMPER:{" "}
                <strong>
                  {labels[simper?.status] ||
                    "Belum Proses"}
                </strong>
              </p>
            </section>

            <ScoreList
              title="Riwayat Post-Test"
              rows={post}
              dateKey="test_date"
            />

            <ScoreList
              title="Riwayat Praktik Mingguan"
              rows={practice}
              dateKey="practice_date"
              nameKey="practice_name"
            />

            <ScoreList
              title="Riwayat Samapta"
              rows={samapta}
              dateKey="test_date"
              nameKey="test_type"
              showOutcome
            />
          </>
        )}

        {(mode === "evaluasi" ||
          mode === "laporan") && (
          <section style={box}>
            <h2>Evaluasi Kesiapan OJT</h2>

            <Bar
              name="Kelengkapan Indikator"
              pct={checksPassed * 20}
              color="#16a34a"
            />

            {checks.map((item) => (
              <p key={item.title}>
                {item.ok ? "✓" : "○"}{" "}
                {item.title} —{" "}
                <strong>
                  {item.ok
                    ? "Terpenuhi"
                    : "Belum Terpenuhi"}
                </strong>
              </p>
            ))}

            <p
              style={{
                fontSize: 13,
                color: "#475569",
              }}
            >
              Evaluasi ini hanya indikator
              kelengkapan awal, bukan keputusan
              kelulusan resmi. Standar nilai
              dan persyaratan akhir harus
              mengikuti SOP perusahaan.
            </p>
          </section>
        )}

        {mode === "laporan" && (
          <section style={box}>
            <h2>Catatan Evaluasi</h2>

            <p>
              Keputusan kelulusan ditetapkan
              oleh Mentor atau penanggung
              jawab sesuai standar resmi.
            </p>

            <p>
              Tanggal laporan:{" "}
              {new Date().toLocaleDateString(
                "id-ID"
              )}
            </p>

            <div style={{ marginTop: 50 }}>
              Mengetahui,
              <p>Mentor / Penilai</p>
              <br />
              <br />
              ____________________________
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          main {
            padding: 0 !important;
            background: white !important;
          }
          section,
          header {
            break-inside: avoid;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
