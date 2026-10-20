
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const SITES = [
  "LMO",
  "SMO",
  "GMO NORTH",
  "GMO SOUTH",
  "BMO 1",
  "BMO 2",
  "BMO 3",
  "SRN",
  "HO",
];

const CARD = {
  background: "white",
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
};

const BUTTON = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

function score(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(1)
    : "-";
}

function formatDate(value) {
  if (!value) return "-";

  const datePart = String(value).split("T")[0];
  const parts = datePart.split("-");

  if (parts.length !== 3) return datePart;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function accountLabel(status) {
  if (status === "activated") return "Aktif";
  if (status === "invited") return "Belum Aktivasi";

  return "Akun Tidak Ditemukan";
}

function simperLabel(status) {
  const labels = {
    passed: "Lulus",
    failed: "Tidak Lulus",
    in_progress: "Dalam Proses",
    not_started: "Belum Mulai",
  };

  return labels[status] || status || "Belum Mulai";
}

function programLabel(status) {
  const labels = {
    active: "Aktif",
    completed: "Selesai",
    finished: "Selesai",
    pending: "Menunggu",
    cancelled: "Dibatalkan",
  };

  return labels[status] || status || "Belum Ada Program";
}

function StatCard({ label, value }) {
  return (
    <div style={CARD}>
      <p
        style={{
          color: "#64748b",
          fontSize: 13,
          marginTop: 0,
        }}
      >
        {label}
      </p>

      <h2
        style={{
          fontSize: 28,
          marginBottom: 0,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

export default function MonitoringPesertaPage() {
  const router = useRouter();

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedSite, setSelectedSite] = useState("ALL");

  async function loadParticipants(silent = false) {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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
          result.error || "Gagal mengambil data peserta."
        );
      }

      setParticipants(result.participants || []);
    } catch (err) {
      setError(
        err.message || "Terjadi kesalahan saat memuat data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadParticipants();

    const interval = setInterval(() => {
      loadParticipants(true);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const totalParticipants = participants.length;

  const activated = participants.filter(
    (p) => p.account_status === "activated"
  ).length;

  const online = participants.filter(
    (p) => p.online
  ).length;

  const withSite = participants.filter(
    (p) => p.site && SITES.includes(p.site)
  ).length;

  const filtered = participants.filter((p) => {
    const keyword = search.trim().toLowerCase();

    const matchesSearch =
      `${p.full_name || ""} ${p.email || ""}`
        .toLowerCase()
        .includes(keyword);

    let matchesSite = true;

    if (selectedSite === "UNASSIGNED") {
      matchesSite = !p.site;
    } else if (selectedSite !== "ALL") {
      matchesSite = p.site === selectedSite;
    }

    return matchesSearch && matchesSite;
  });

  function siteCount(site) {
    return participants.filter(
      (p) => p.site === site
    ).length;
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
      <div
        style={{
          maxWidth: 1000,
          margin: "auto",
        }}
      >
        <header
          style={{
            ...CARD,
            background: "#0f172a",
            color: "white",
            marginBottom: 18,
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            Monitoring Peserta OJT
          </h1>

          <p>Emergency Response Group</p>
          <p>PT Berau Coal 2026</p>

          <p style={{ color: "#cbd5e1" }}>
            Dashboard Khusus Mentor
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 18,
            }}
          >
            <button
              type="button"
              style={BUTTON}
              onClick={() => loadParticipants(true)}
              disabled={refreshing || loading}
            >
              {refreshing
                ? "Memperbarui..."
                : "↻ Refresh Data"}
            </button>

            <button
              type="button"
              style={{
                ...BUTTON,
                background: "#475569",
              }}
              onClick={() => router.push("/")}
            >
              Dashboard Mentor
            </button>

            <button
              type="button"
              style={{
                ...BUTTON,
                background: "#0f766e",
              }}
              onClick={() =>
                router.push("/mentor/daftar-peserta")
              }
            >
              + Daftarkan Peserta
            </button>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(140px,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <StatCard
            label="Total Terdaftar"
            value={totalParticipants}
          />

          <StatCard
            label="Akun Aktif"
            value={activated}
          />

          <StatCard
            label="Belum Aktif"
            value={totalParticipants - activated}
          />

          <StatCard
            label="Sedang Online"
            value={online}
          />

          <StatCard
            label="Site Terisi"
            value={withSite}
          />
        </section>

        <section
          style={{
            ...CARD,
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Filter Monitoring Peserta
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
              gap: 14,
            }}
          >
            <div>
              <label
                htmlFor="search-participant"
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                Cari Peserta
              </label>

              <input
                id="search-participant"
                type="search"
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 16,
                  boxSizing: "border-box",
                  background: "white",
                  color: "#0f172a",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="filter-site"
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                Site Penempatan
              </label>

              <select
                id="filter-site"
                value={selectedSite}
                onChange={(e) =>
                  setSelectedSite(e.target.value)
                }
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 16,
                  boxSizing: "border-box",
                  background: "white",
                  color: "#0f172a",
                }}
              >
                <option value="ALL">
                  Semua Site
                </option>

                {SITES.map((site) => (
                  <option key={site} value={site}>
                    {site} ({siteCount(site)})
                  </option>
                ))}

                <option value="UNASSIGNED">
                  Belum Ditentukan
                </option>
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 14,
            }}
          >
            Menampilkan{" "}
            <strong>{filtered.length}</strong> dari{" "}
            <strong>{totalParticipants}</strong>{" "}
            peserta OJT.
          </div>

          {(search || selectedSite !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedSite("ALL");
              }}
              style={{
                ...BUTTON,
                marginTop: 12,
                background: "#64748b",
              }}
            >
              Reset Filter
            </button>
          )}
        </section>

        {loading && (
          <section style={CARD}>
            Memuat data peserta...
          </section>
        )}

        {error && (
          <section
            style={{
              ...CARD,
              marginBottom: 18,
              color: "#dc2626",
            }}
            role="alert"
          >
            {error}
          </section>
        )}

        {!loading &&
          !error &&
          filtered.length === 0 && (
            <section style={CARD}>
              <h3 style={{ marginTop: 0 }}>
                Tidak Ada Peserta
              </h3>

              <p>
                Belum ada peserta yang sesuai
                dengan pencarian atau filter site.
              </p>
            </section>
          )}

        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          {!loading &&
            filtered.map((p) => {
              const total =
                Number(p.achievement_total) || 6;

              const count =
                Number(p.achievement_count) || 0;

              const progress = Math.min(
                100,
                Math.max(
                  0,
                  (count / total) * 100
                )
              );

              return (
                <section
                  key={p.id}
                  style={CARD}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                        flex: "1 1 220px",
                      }}
                    >
                      <h2
                        style={{
                          margin: "0 0 8px",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {p.full_name ||
                          "Peserta OJT"}
                      </h2>

                      <p
                        style={{
                          margin: "6px 0",
                          color: "#475569",
                        }}
                      >
                        {p.department || "-"}
                      </p>

                      <p
                        style={{
                          margin: "6px 0",
                          color: "#64748b",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {p.email ||
                          "Email tidak tersedia"}
                      </p>

                      <div
                        style={{
                          marginTop: 12,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            background: p.site
                              ? "#dbeafe"
                              : "#f1f5f9",
                            color: p.site
                              ? "#1d4ed8"
                              : "#64748b",
                            borderRadius: 20,
                            padding: "8px 12px",
                            fontWeight: "bold",
                            fontSize: 13,
                          }}
                        >
                          Site:{" "}
                          {p.site ||
                            "Belum Ditentukan"}
                        </span>

                        <span
                          style={{
                            display: "inline-block",
                            background: "#f1f5f9",
                            color: "#475569",
                            borderRadius: 20,
                            padding: "8px 12px",
                            fontSize: 13,
                          }}
                        >
                          Program:{" "}
                          {programLabel(
                            p.program_status
                          )}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          marginTop: 12,
                        }}
                      >
                        <strong>
                          Periode OJT:
                        </strong>{" "}
                        {formatDate(
                          p.start_date
                        )}{" "}
                        -{" "}
                        {formatDate(
                          p.end_date
                        )}
                      </p>
                    </div>

                    <div
                      style={{
                        flex: "1 1 180px",
                      }}
                    >
                      <p>
                        <strong>
                          Status Akun:
                        </strong>{" "}
                        {accountLabel(
                          p.account_status
                        )}
                      </p>

                      <p>
                        <strong>
                          Aktivitas:
                        </strong>{" "}
                        <span
                          style={{
                            color: p.online
                              ? "#15803d"
                              : "#64748b",
                            fontWeight: "bold",
                          }}
                        >
                          {p.online
                            ? "Online"
                            : "Offline"}
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
                            ).toLocaleString(
                              "id-ID"
                            )
                          : "Belum tercatat"}
                      </p>
                    </div>
                  </div>

                  <hr
                    style={{
                      border: 0,
                      borderTop:
                        "1px solid #e2e8f0",
                      margin: "18px 0",
                    }}
                  />

                  <h3>
                    Enam Pencapaian OJT
                  </h3>

                  <p>
                    Pencapaian Terverifikasi:{" "}
                    <strong>
                      {count}/{total}
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
                        width: `${progress}%`,
                        background: "#0f766e",
                        borderRadius: 10,
                      }}
                    />
                  </div>

                  <p
                    style={{
                      textAlign: "right",
                      fontSize: 13,
                      fontWeight: "bold",
                      color: "#0f766e",
                    }}
                  >
                    {Math.round(progress)}%
                  </p>

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
                      <small>
                        Rata-rata Post-Test
                      </small>
                      <h3>
                        {score(
                          p.post_test_average
                        )}
                      </h3>
                    </div>

                    <div>
                      <small>
                        Rata-rata Praktik
                      </small>
                      <h3>
                        {score(
                          p.practice_average
                        )}
                      </h3>
                    </div>

                    <div>
                      <small>
                        Rata-rata Samapta
                      </small>
                      <h3>
                        {score(
                          p.samapta_average
                        )}
                      </h3>
                    </div>

                    <div>
                      <small>
                        Status SIMPER
                      </small>
                      <h3>
                        {simperLabel(
                          p.simper_status
                        )}
                      </h3>
                    </div>
                  </div>

                  {p.program_id && (
                    <button
                      type="button"
                      style={{
                        ...BUTTON,
                        marginTop: 12,
                        width: "100%",
                      }}
                      onClick={() =>
                        router.push(
                          `/peserta/${p.program_id}`
                        )
                      }
                    >
                      Lihat Detail Peserta →
                    </button>
                  )}
                </section>
              );
            })}
        </div>

        <p
          style={{
            fontSize: 12,
            color: "#64748b",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          Status online dihitung dari aktivitas
          aplikasi dalam 2 menit terakhir.
          Data diperbarui setiap 60 detik.
        </p>
      </div>
    </main>
  );
}
