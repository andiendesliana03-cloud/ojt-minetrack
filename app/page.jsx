
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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
};

export default function Home() {
  const [peserta, setPeserta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function ambilPeserta() {
      const { data, error } = await supabase
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
        .eq("status", "active");

      if (error) {
        setError(error.message);
      } else {
        setPeserta(data || []);
      }

      setLoading(false);
    }

    ambilPeserta();
  }, []);

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f1f5f9",
      padding: 18,
      fontFamily: "Arial, sans-serif",
      color: "#0f172a"
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{
          background: "#0f172a",
          color: "white",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24
        }}>
          <h1>OJT MineTrack v2.0</h1>
          <p>Sistem Monitoring dan Evaluasi OJT</p>
          <small>Dashboard Monitoring Mentor</small>
        </header>

        <h2>Ringkasan Monitoring</h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          marginBottom: 26
        }}>
          {[
            ["Peserta Aktif", loading ? "..." : peserta.length],
            ["Pencapaian OJT", "6 Kategori"],
            ["Post-Test", "Selasa & Kamis"],
            ["Praktik", "Mingguan"],
            ["Samapta", "Monitoring"],
            ["SIMPER", "Monitoring"]
          ].map(([judul, nilai]) => (
            <div key={judul} style={card}>
              <p style={{ color: "#64748b", fontSize: 13 }}>{judul}</p>
              <strong>{nilai}</strong>
            </div>
          ))}
        </div>

        <h2>Daftar Peserta OJT Aktif</h2>

        {loading && <p>Memuat data peserta...</p>}
        {error && (
          <p style={{ color: "#b91c1c" }}>
            Gagal mengambil data: {error}
          </p>
        )}

        {!loading && !error && peserta.length === 0 && (
          <div style={card}>
            Belum ada peserta yang dapat ditampilkan.
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {peserta.map((item) => (
            <div key={item.id} style={card}>
              <h3>{item.peserta?.full_name || "Peserta OJT"}</h3>
              <p>Departemen: {item.peserta?.department || "-"}</p>
              <p>Mulai: {item.start_date}</p>
              <p>Selesai: {item.end_date}</p>
              <p>Status: {item.status}</p>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: 28 }}>Enam Pencapaian OJT</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {kategori.map((nama, index) => (
            <div key={nama} style={card}>
              <small>Pencapaian {index + 1}</small>
              <h3>{nama}</h3>
              <p>Monitoring pencapaian peserta</p>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: 28 }}>Monitoring Penilaian</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {[
            ["Post-Test Teori", "Setiap Selasa dan Kamis"],
            ["Praktik Mingguan", "Evaluasi setiap minggu"],
            ["Samapta", "Monitoring selama OJT"],
            ["SIMPER", "Monitoring proses dan kelulusan"]
          ].map(([nama, keterangan]) => (
            <div key={nama} style={card}>
              <h3>{nama}</h3>
              <p>{keterangan}</p>
              <small>Data penilaian belum ditampilkan</small>
            </div>
          ))}
        </div>

        <footer style={{
          textAlign: "center",
          padding: 24,
          color: "#64748b"
        }}>
          OJT MineTrack v2.0 — Dashboard Mentor
        </footer>
      </div>
    </main>
  );
}
