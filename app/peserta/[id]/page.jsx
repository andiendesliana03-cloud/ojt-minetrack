
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const button = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

export default function Home() {
  const router = useRouter();

  const [mentor, setMentor] = useState(null);
  const [checking, setChecking] = useState(true);
  const [peserta, setPeserta] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkLogin() {
      try {
        const { data, error: authError } =
          await supabase.auth.getUser();

        if (authError || !data.user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, full_name, role, department")
            .eq("id", data.user.id)
            .single();

        if (profileError) throw profileError;

        if (profile?.role !== "mentor") {
          throw new Error(
            "Akun ini tidak memiliki akses Mentor."
          );
        }

        if (active) {
          setMentor(profile);
          setChecking(false);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          setChecking(false);
        }
      }
    }

    checkLogin();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!mentor) return;

    let active = true;

    async function loadPeserta() {
      setLoading(true);
      setError("");

      const { data, error: queryError } =
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
          .eq("status", "active")
          .order("start_date", {
            ascending: false,
          });

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
      } else {
        setPeserta(data || []);
      }

      setLoading(false);
    }

    loadPeserta();

    return () => {
      active = false;
    };
  }, [mentor]);

  async function logout() {
    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  const page = {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 18,
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
  };

  if (checking) {
    return (
      <main style={page}>
        <h2>OJT MineTrack v2.0</h2>
        <p>Memeriksa login...</p>
      </main>
    );
  }

  if (!mentor) {
    return (
      <main style={page}>
        <div style={card}>
          <h2>Akses Ditolak</h2>
          <p style={{ color: "#b91c1c" }}>
            {error || "Akses tidak diizinkan."}
          </p>
          <button onClick={logout} style={button}>
            Logout
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={{ maxWidth: 1000, margin: "auto" }}>
        <header
          style={{
            background: "#0f172a",
            color: "white",
            padding: 24,
            borderRadius: 16,
            marginBottom: 24,
          }}
        >
          <h1>OJT MineTrack v2.0</h1>
          <p>Sistem Monitoring dan Evaluasi OJT</p>
          <small>Dashboard Monitoring Mentor</small>

          <p style={{ marginTop: 22 }}>
            Login sebagai:{" "}
            <strong>{mentor.full_name}</strong>
          </p>
          <p>
            Departemen: {mentor.department || "-"}
          </p>

          <button
            onClick={logout}
            style={{
              ...button,
              background: "#dc2626",
            }}
          >
            Logout
          </button>
        </header>

        <h2>Ringkasan Monitoring</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            ["Peserta Aktif", loading ? "..." : peserta.length],
            ["Pencapaian OJT", "6 Kategori"],
            ["Post-Test", "Selasa & Kamis"],
            ["Praktik", "Mingguan"],
            ["Samapta", "Monitoring"],
            ["SIMPER", "Monitoring"],
          ].map(([title, value]) => (
            <div key={title} style={card}>
              <p style={{ color: "#64748b", fontSize: 13 }}>
                {title}
              </p>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <h2>Daftar Peserta OJT Aktif</h2>

        {loading && <p>Memuat data peserta...</p>}

        {error && (
          <p style={{ color: "#b91c1c" }}>{error}</p>
        )}

        {!loading && !error && peserta.length === 0 && (
          <div style={card}>
            Belum ada peserta aktif.
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {peserta.map((item) => (
            <div key={item.id} style={card}>
              <h3>
                {item.peserta?.full_name ||
                  "Peserta OJT"}
              </h3>

              <p>
                Departemen:{" "}
                {item.peserta?.department || "-"}
              </p>
              <p>Mulai: {item.start_date}</p>
              <p>Selesai: {item.end_date}</p>
              <p>Status: {item.status}</p>

              <button
                onClick={() =>
                  router.push(`/peserta/${item.id}`)
                }
                style={button}
              >
                Lihat Detail Peserta
              </button>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: 28 }}>
          Enam Pencapaian OJT
        </h2>

        <div style={{ display: "grid", gap: 12 }}>
          {kategori.map((nama, index) => (
            <div key={nama} style={card}>
              <small>Pencapaian {index + 1}</small>
              <h3>{nama}</h3>
              <p>Monitoring pencapaian peserta</p>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: 28 }}>
          Monitoring Penilaian
        </h2>

        <div style={{ display: "grid", gap: 12 }}>
          {[
            ["Post-Test Teori", "Selasa dan Kamis"],
            ["Praktik Mingguan", "Setiap minggu"],
            ["Samapta", "Selama masa OJT"],
            ["SIMPER", "Proses dan kelulusan"],
          ].map(([nama, info]) => (
            <div key={nama} style={card}>
              <h3>{nama}</h3>
              <p>{info}</p>
              <small>Monitoring penilaian</small>
            </div>
          ))}
        </div>

        <footer
          style={{
            textAlign: "center",
            color: "#64748b",
            padding: 24,
          }}
        >
          OJT MineTrack v2.0 — Dashboard Mentor
        </footer>
      </div>
    </main>
  );
}
