
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function MonitoringPesertaPage() {
  const router = useRouter();

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadParticipants() {
    setLoading(true);
    setError("");

    try {
      const { data, error: sessionError } =
        await supabase.auth.getSession();

      const token = data?.session?.access_token;

      if (sessionError || !token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/mentor/participants",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Gagal mengambil data."
        );
      }

      setParticipants(result.participants || []);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParticipants();

    const interval = setInterval(
      loadParticipants,
      60000
    );

    return () => clearInterval(interval);
  }, []);

  const activated = participants.filter(
    (p) => p.account_status === "activated"
  ).length;

  const online = participants.filter(
    (p) => p.online
  ).length;

  const filtered = participants.filter((p) =>
    `${p.full_name || ""} ${p.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const card = {
    background: "white",
    padding: 20,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
  };

  const button = {
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  };

  function score(value) {
    return value == null
      ? "-"
      : Number(value).toFixed(1);
  }

  function accountLabel(status) {
    if (status === "activated") return "Aktif";
    if (status === "invited") return "Belum Aktivasi";
    return "Akun Tidak Ditemukan";
  }

  function simperLabel(status) {
    return (
      {
        passed: "Lulus",
        failed: "Tidak Lulus",
        in_progress: "Dalam Proses",
        not_started: "Belum Mulai",
      }[status] || status
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 16,
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "auto" }}>
        <header
          style={{
            ...card,
            background: "#0f172a",
            color: "white",
            marginBottom: 18,
          }}
        >
          <h1>Monitoring Peserta OJT</h1>
          <p>Emergency Response Group</p>
          <p>PT Berau Coal 2026</p>
          <p>Dashboard Khusus Mentor</p>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              style={button}
              onClick={loadParticipants}
            >
              Refresh Data
            </button>

            <button
              style={{
                ...button,
                background: "#475569",
              }}
              onClick={() => router.push("/")}
            >
              Dashboard Mentor
            </button>

            <button
              style={{
                ...button,
                background: "#0f766e",
              }}
              onClick={() =>
                router.push("/mentor/daftar-peserta")
              }
            >
              Daftarkan Peserta
            </button>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(150px,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {[
            ["Total Terdaftar", participants.length],
            ["Akun Aktif", activated],
            ["Belum Aktif", participants.length - activated],
            ["Sedang Online", online],
          ].map(([label, value]) => (
            <div key={label} style={card}>
              <p style={{ color: "#64748b" }}>
                {label}
              </p>
              <h2 style={{ fontSize: 30 }}>
                {value}
              </h2>
            </div>
          ))}
        </section>

        <section style={{ ...card, marginBottom: 18 }}>
          <input
            type="search"
            placeholder="Cari nama atau email peserta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
        </section>

        {loading && <p>Memuat data peserta...</p>}

        {error && (
          <p style={{ color: "#dc2626" }}>
            {error}
          </p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <section style={card}>
            Belum ada peserta yang sesuai.
          </section>
        )}

        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          {!loading &&
            filtered.map((p) => (
              <section key={p.id} style={card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h2 style={{ margin: "0 0 8px" }}>
                      {p.full_name || "Peserta OJT"}
                    </h2>

                    <p>{p.department || "-"}</p>
                    <p>{p.email || "Email tidak tersedia"}</p>
                  </div>

                  <div>
                    <p>
                      <strong>Status Akun:</strong>{" "}
                      {accountLabel(p.account_status)}
                    </p>

                    <p>
                      <strong>Aktivitas:</strong>{" "}
                      <span
                        style={{
                          color: p.online
                            ? "#15803d"
                            : "#64748b",
                          fontWeight: "bold",
                        }}
                      >
                        {p.online ? "Online" : "Offline"}
                      </span>
                    </p>

                    <p
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      Aktivitas terakhir:{" "}
                      {p.last_seen_at
                        ? new Date(
                            p.last_seen_at
                          ).toLocaleString("id-ID")
                        : "Belum tercatat"}
                    </p>
                  </div>
                </div>

                <hr
                  style={{
                    border: 0,
                    borderTop: "1px solid #e2e8f0",
                    margin: "18px 0",
                  }}
                />

                <h3>Progres OJT</h3>

                <p>
                  Pencapaian Terverifikasi:{" "}
                  <strong>
                    {p.achievement_count}/
                    {p.achievement_total}
                  </strong>
                </p>

                <div
                  style={{
                    background: "#e2e8f0",
                    height: 12,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${
                        (p.achievement_count /
                          p.achievement_total) *
                        100
                      }%`,
                      background: "#0f766e",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(140px,1fr))",
                    gap: 12,
                    marginTop: 18,
                  }}
                >
                  <div>
                    <small>Rata-rata Post-Test</small>
                    <h3>{score(p.post_test_average)}</h3>
                  </div>

                  <div>
                    <small>Rata-rata Praktik</small>
                    <h3>{score(p.practice_average)}</h3>
                  </div>

                  <div>
                    <small>Rata-rata Samapta</small>
                    <h3>{score(p.samapta_average)}</h3>
                  </div>

                  <div>
                    <small>Status SIMPER</small>
                    <h3>{simperLabel(p.simper_status)}</h3>
                  </div>
                </div>

                {p.program_id && (
                  <button
                    style={{
                      ...button,
                      marginTop: 12,
                      width: "100%",
                    }}
                    onClick={() =>
                      router.push(
                        `/peserta/${p.program_id}`
                      )
                    }
                  >
                    Lihat Detail Peserta
                  </button>
                )}
              </section>
            ))}
        </div>

        <p
          style={{
            fontSize: 12,
            color: "#64748b",
            marginTop: 20,
          }}
        >
          Status online dihitung dari aktivitas aplikasi
          dalam 2 menit terakhir. Data diperbarui setiap
          60 detik.
        </p>
      </div>
    </main>
  );
}
