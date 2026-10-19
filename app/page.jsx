
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const pencapaian = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

const penilaian = [
  {
    nama: "Post-Test Teori",
    keterangan: "Setiap Selasa dan Kamis",
  },
  {
    nama: "Praktik Mingguan",
    keterangan: "Evaluasi setiap minggu",
  },
  {
    nama: "Samapta",
    keterangan: "Monitoring selama masa OJT",
  },
  {
    nama: "SIMPER",
    keterangan: "Monitoring proses dan kelulusan",
  },
];

export default function Home() {
  const [dataPencapaian, setDataPencapaian] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pesanError, setPesanError] = useState("");

  useEffect(() => {
    async function ambilData() {
      try {
        const { data, error } = await supabase
          .from("achievement_records")
          .select("*");

        if (error) {
          setPesanError(error.message);
        } else {
          setDataPencapaian(data || []);
        }
      } catch (error) {
        setPesanError(error.message);
      } finally {
        setLoading(false);
      }
    }

    ambilData();
  }, []);

  const card = {
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #e2e8f0",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 20,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header
          style={{
            background: "#0f172a",
            color: "white",
            borderRadius: 18,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h1 style={{ margin: 0 }}>OJT MineTrack v2.0</h1>
          <p>Sistem Monitoring dan Evaluasi OJT</p>
          <small>Dashboard Monitoring Peserta</small>
        </header>

        <h2>Ringkasan Monitoring</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            ["Pencapaian OJT", "6 Kategori"],
            ["Post-Test", "Selasa & Kamis"],
            ["Praktik", "Mingguan"],
            ["SIMPER", "Dalam Monitoring"],
          ].map(([judul, isi]) => (
            <div key={judul} style={card}>
              <small style={{ color: "#64748b" }}>
                {judul}
              </small>
              <h3>{isi}</h3>
            </div>
          ))}
        </div>

        <h2>Enam Pencapaian OJT</h2>

        {loading && <p>Memuat data Supabase...</p>}

        {pesanError && (
          <p style={{ color: "#b91c1c" }}>
            Gagal membaca data: {pesanError}
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {pencapaian.map((nama, index) => (
            <div key={nama} style={card}>
              <small style={{ color: "#64748b" }}>
                Pencapaian {index + 1}
              </small>

              <h3>{nama}</h3>

              <p style={{ fontSize: 14 }}>
                {loading
                  ? "Memuat..."
                  : "Data pencapaian siap dimonitor"}
              </p>

              <div
                style={{
                  height: 8,
                  background: "#e2e8f0",
                  borderRadius: 8,
                }}
              />
            </div>
          ))}
        </div>

        <h2>Monitoring Penilaian</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {penilaian.map((item) => (
            <div key={item.nama} style={card}>
              <h3>{item.nama}</h3>
              <p>{item.keterangan}</p>
              <small>Belum ada data penilaian</small>
            </div>
          ))}
        </div>

        <div style={{ ...card, marginTop: 24 }}>
          <h3>Status Koneksi Supabase</h3>

          {loading ? (
            <p>Memeriksa koneksi...</p>
          ) : pesanError ? (
            <p style={{ color: "#b91c1c" }}>
              Gagal membaca data Supabase
            </p>
          ) : (
            <>
              <p style={{ color: "#15803d" }}>
                Permintaan data berhasil
              </p>
              <p>
                Jumlah catatan pencapaian yang dapat dibaca:{" "}
                <strong>{dataPencapaian.length}</strong>
              </p>
            </>
          )}
        </div>

        <footer
          style={{
            textAlign: "center",
            marginTop: 36,
            color: "#64748b",
            fontSize: 14,
          }}
        >
          OJT MineTrack v2.0 — Dashboard Monitoring
        </footer>
      </div>
    </main>
  );
}
