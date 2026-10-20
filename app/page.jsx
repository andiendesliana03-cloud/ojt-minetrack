
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

const halaman = {
  minHeight: "100vh",
  padding: 18,
  boxSizing: "border-box",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
  backgroundColor: "#f1f5f9",
  backgroundImage:
    'linear-gradient(rgba(241,245,249,0.75), rgba(241,245,249,0.88)), url("/background-erg.png.PNG")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
};

const card = {
  background: "rgba(255,255,255,0.95)",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
};

const tombol = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  fontWeight: "bold",
  cursor: "pointer",
};

export default function DashboardMentor() {
  const router = useRouter();

  const [mentor, setMentor] = useState(null);
  const [peserta, setPeserta] = useState([]);
  const [memeriksa, setMemeriksa] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let aktif = true;

    async function periksaLogin() {
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
            .select("id, full_name, role, department")
            .eq("id", user.id)
            .single();

        if (profilError) throw profilError;

        if (profil?.role === "participant") {
          router.replace("/peserta");
          return;
        }

        if (profil?.role !== "mentor") {
          throw new Error(
            "Akun tidak memiliki akses Dashboard Mentor."
          );
        }

        if (aktif) setMentor(profil);
      } catch (err) {
        if (aktif) {
          setError(err.message || "Gagal memeriksa akun.");
        }
      } finally {
        if (aktif) setMemeriksa(false);
      }
    }

    periksaLogin();

    return () => {
      aktif = false;
    };
  }, [router]);

  async function ambilPeserta() {
    setLoading(true);
    setError("");

    try {
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
          .order("start_date", { ascending: false });

      if (queryError) throw queryError;

      setPeserta(data || []);
    } catch (err) {
      setError(err.message || "Gagal mengambil peserta.");
      setPeserta([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mentor) ambilPeserta();
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

  if (memeriksa) {
    return (
      <main style={halaman}>
        <h2>Monitoring OJT</h2>
        <p>Memeriksa sesi login...</p>
      </main>
    );
  }

  if (!mentor) {
    return (
      <main style={halaman}>
        <section
          style={{
            ...card,
            maxWidth: 500,
            margin: "60px auto",
          }}
        >
          <h2>Akses Dashboard Mentor</h2>

          <p style={{ color: "#b91c1c" }}>
            {error || "Akses tidak diizinkan."}
          </p>

          <button onClick={logout} style={tombol}>
            Keluar dan Login Ulang
          </button>
        </section>
      </main>
    );
  }

  const ringkasan = [
    ["Peserta Aktif", loading ? "..." : peserta.length],
    ["Pencapaian OJT", "6 Kategori"],
    ["Post-Test", "Selasa & Kamis"],
    ["Praktik", "Mingguan"],
    ["Samapta", "Monitoring"],
    ["SIMPER", "Monitoring"],
  ];

  return (
    <main style={halaman}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header
          style={{
            background: "rgba(15,23,42,0.95)",
            color: "#ffffff",
            padding: 24,
            borderRadius: 16,
            marginBottom: 24,
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            Monitoring OJT
          </h1>

          <h2 style={{ fontSize: 19 }}>
            Emergency Response Group
          </h2>

          <p>PT Berau Coal 2026</p>

          <small>Dashboard Mentor</small>

          <div style={{ marginTop: 22 }}>
            <p>
              Login sebagai:{" "}
              <strong>{mentor.full_name}</strong>
            </p>

            <p>
              Departemen: {mentor.department || "-"}
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            style={{
              ...tombol,
              background: "#dc2626",
              marginTop: 12,
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
            marginBottom: 26,
          }}
        >
          {ringkasan.map(([judul, nilai]) => (
            <section key={judul} style={card}>
              <p
                style={{
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                {judul}
              </p>

              <strong>{nilai}</strong>
            </section>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2>Daftar Peserta OJT Aktif</h2>

          <button
            type="button"
            onClick={ambilPeserta}
            disabled={loading}
            style={tombol}
          >
            {loading ? "Memuat..." : "Refresh Data"}
          </button>
        </div>

        {error && (
          <section style={card}>
            <p style={{ color: "#b91c1c" }}>
              {error}
            </p>
          </section>
        )}

        {loading && <p>Memuat data peserta...</p>}

        {!loading &&
          !error &&
          peserta.length === 0 && (
            <section style={card}>
              Belum ada peserta OJT aktif.
            </section>
          )}

        <div style={{ display: "grid", gap: 12 }}>
          {peserta.map((item) => (
            <section key={item.id} style={card}>
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
                type="button"
                onClick={() =>
                  router.push(`/peserta/${item.id}`)
                }
                style={{
                  ...tombol,
                  width: "100%",
                  marginTop: 12,
                }}
              >
                Lihat Detail Peserta
              </button>
            </section>
          ))}
        </div>

        <h2 style={{ marginTop: 28 }}>
          Enam Pencapaian OJT
        </h2>

        <div style={{ display: "grid", gap: 12 }}>
          {kategori.map((nama, index) => (
            <section key={nama} style={card}>
              <small>Pencapaian {index + 1}</small>
              <h3>{nama}</h3>
              <p>Monitoring pencapaian peserta</p>
            </section>
          ))}
        </div>

        <h2 style={{ marginTop: 28 }}>
          Monitoring Penilaian
        </h2>

        <div style={{ display: "grid", gap: 12 }}>
          {[
            [
              "Post-Test Teori",
              "Setiap Selasa dan Kamis",
            ],
            [
              "Praktik Mingguan",
              "Evaluasi setiap minggu",
            ],
            [
              "Samapta",
              "Monitoring selama OJT",
            ],
            [
              "SIMPER",
              "Monitoring proses dan kelulusan",
            ],
          ].map(([nama, keterangan]) => (
            <section key={nama} style={card}>
              <h3>{nama}</h3>
              <p>{keterangan}</p>
              <small>
                Data penilaian belum ditampilkan
              </small>
            </section>
          ))}
        </div>

        <footer
          style={{
            textAlign: "center",
            padding: 24,
            color: "#475569",
            fontWeight: 600,
          }}
        >
          Monitoring OJT — Emergency Response Group
          <p>PT Berau Coal 2026</p>
        </footer>
      </div>
    </main>
  );
}
