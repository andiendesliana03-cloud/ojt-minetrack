
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
  const id = params?.id;

  const [program, setProgram] = useState(null);
  const [pencapaian, setPencapaian] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aktif = true;

    async function ambilData() {
      if (!id) return;

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profil, error: profilError } =
          await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profilError) throw profilError;

        if (profil?.role !== "mentor") {
          throw new Error(
            "Halaman ini hanya dapat diakses Mentor."
          );
        }

        const { data: dataProgram, error: programError } =
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
            .eq("id", id)
            .single();

        if (programError) throw programError;

        const {
          data: dataPencapaian,
          error: pencapaianError,
        } = await supabase
          .from("achievement_records")
          .select("*")
          .eq("program_id", id);

        if (pencapaianError) throw pencapaianError;

        if (aktif) {
          setProgram(dataProgram);
          setPencapaian(dataPencapaian || []);
        }
      } catch (err) {
        if (aktif) {
          setError(err.message || "Gagal memuat data.");
        }
      } finally {
        if (aktif) setLoading(false);
      }
    }

    ambilData();

    return () => {
      aktif = false;
    };
  }, [id, router]);

  const halaman = {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 18,
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
  };

  return (
    <main style={halaman}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header
          style={{
            background: "#0f172a",
            color: "#ffffff",
            padding: 24,
            borderRadius: 16,
            marginBottom: 24,
          }}
        >
          <h1>Detail Peserta OJT</h1>
          <p>OJT MineTrack v2.0</p>
        </header>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 20,
            cursor: "pointer",
          }}
        >
          ← Kembali ke Dashboard
        </button>

        {loading && <p>Memuat data peserta...</p>}

        {error && (
          <div style={card}>
            <p style={{ color: "#b91c1c" }}>{error}</p>
          </div>
        )}

        {!loading && program && (
          <>
            <div style={card}>
              <h2>
                {program.peserta?.full_name ||
                  "Peserta OJT"}
              </h2>

              <p>
                Departemen:{" "}
                {program.peserta?.department || "-"}
              </p>

              <p>Mulai: {program.start_date}</p>
              <p>Selesai: {program.end_date}</p>
              <p>Status: {program.status}</p>
            </div>

            <h2>Enam Pencapaian OJT</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 12,
              }}
            >
              {kategori.map((nama, index) => (
                <div key={nama} style={card}>
                  <small>
                    Pencapaian {index + 1}
                  </small>

                  <h3>{nama}</h3>

                  <p>
                    Monitoring pencapaian peserta
                  </p>
                </div>
              ))}
            </div>

            <h2>Catatan Pencapaian</h2>

            <div style={card}>
              <p>
                Total catatan tersimpan:{" "}
                <strong>{pencapaian.length}</strong>
              </p>

              {pencapaian.length === 0 && (
                <p>
                  Belum ada catatan pencapaian.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
