
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const kategori = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 12,
};

export default function DetailPeserta() {
  const params = useParams();
  const router = useRouter();
  const programId = params?.id;

  const [program, setProgram] = useState(null);
  const [jumlah, setJumlah] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!programId) return;

    let aktif = true;

    async function ambilData() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const { data: profil, error: profilError } =
          await supabase
            .from("profiles")
            .select("role")
            .eq("id", authData.user.id)
            .single();

        if (profilError) throw profilError;

        if (profil?.role !== "mentor") {
          throw new Error("Halaman ini khusus Mentor.");
        }

        const { data, error: programError } =
          await supabase
            .from("ojt_programs")
            .select(`
              id,
              start_date,
              end_date,
              status,
              peserta:profiles!ojt_programs_participant_id_fkey(
                full_name,
                department
              )
            `)
            .eq("id", programId)
            .single();

        if (programError) throw programError;

        const { count, error: countError } =
          await supabase
            .from("achievement_records")
            .select("id", { count: "exact", head: true })
            .eq("program_id", programId);

        if (countError) throw countError;

        if (aktif) {
          setProgram(data);
          setJumlah(count ?? 0);
        }
      } catch (err) {
        if (aktif) {
          setError(err.message || "Terjadi kesalahan.");
        }
      } finally {
        if (aktif) setLoading(false);
      }
    }

    ambilData();

    return () => {
      aktif = false;
    };
  }, [programId, router]);

  const tombol = {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
    padding: "12px 16px",
    cursor: "pointer",
    marginBottom: 20,
  };

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
      <div style={{ maxWidth: 900, margin: "auto" }}>
        <header
          style={{
            background: "#0f172a",
            color: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h1>Detail Peserta OJT</h1>
          <p>OJT MineTrack v2.0</p>
          <small>Monitoring dan Evaluasi Mentor</small>
        </header>

        <button
          onClick={() => router.push("/")}
          style={tombol}
        >
          ← Kembali ke Dashboard
        </button>

        {loading && <p>Memuat data peserta...</p>}

        {error && (
          <div style={card}>
            <p style={{ color: "#b91c1c" }}>
              {error}
            </p>
          </div>
        )}

        {!loading && !error && program && (
          <>
            <section style={card}>
              <h2>
                {program.peserta?.full_name || "Peserta OJT"}
              </h2>

              <p>
                Departemen:{" "}
                {program.peserta?.department || "-"}
              </p>

              <p>Mulai: {program.start_date}</p>
              <p>Selesai: {program.end_date}</p>
              <p>Status: {program.status}</p>
            </section>

            <section style={card}>
              <h2>Ringkasan Pencapaian</h2>
              <p>Total catatan pencapaian:</p>
              <h1>{jumlah}</h1>
              <small>
                Berdasarkan data achievement_records
              </small>
            </section>

            <h2>Enam Pencapaian OJT</h2>

            {kategori.map((nama, index) => (
              <div key={nama} style={card}>
                <small>Kategori {index + 1}</small>
                <h3>{nama}</h3>
                <p>
                  Monitoring pencapaian {nama}
                </p>
              </div>
            ))}

            <h2>Monitoring Penilaian</h2>

            {[
              ["Post-Test Teori", "Selasa dan Kamis"],
              ["Praktik Mingguan", "Setiap minggu"],
              ["Samapta", "Selama masa OJT"],
              ["SIMPER", "Proses dan kelulusan"],
            ].map(([nama, info]) => (
              <div key={nama} style={card}>
                <h3>{nama}</h3>
                <p>{info}</p>
                <small>
                  Detail penilaian akan ditambahkan
                </small>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
