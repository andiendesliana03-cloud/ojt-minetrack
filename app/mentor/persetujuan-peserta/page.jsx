
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
};

const button = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Status({ value }) {
  const config = {
    pending: {
      label: "Menunggu Persetujuan",
      color: "#92400e",
      background: "#fef3c7",
    },
    approved: {
      label: "Disetujui",
      color: "#166534",
      background: "#dcfce7",
    },
    rejected: {
      label: "Ditolak",
      color: "#991b1b",
      background: "#fee2e2",
    },
  };

  const item = config[value] || {
    label: value || "-",
    color: "#334155",
    background: "#e2e8f0",
  };

  return (
    <span
      style={{
        display: "inline-block",
        background: item.background,
        color: item.color,
        padding: "7px 11px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {item.label}
    </span>
  );
}

export default function PersetujuanPesertaPage() {
  const router = useRouter();

  const [registrations, setRegistrations] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [filter, setFilter] =
    useState("pending");

  async function loadRegistrations() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/mentor/registrations",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Gagal mengambil daftar pendaftaran."
        );
      }

      setRegistrations(
        result.registrations || []
      );
    } catch (err) {
      setError(
        err.message ||
          "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRegistrations();
  }, []);

  const filtered = registrations.filter(
    (item) =>
      filter === "all" ||
      item.status === filter
  );

  const count = (status) =>
    registrations.filter(
      (item) => item.status === status
    ).length;

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
          maxWidth: 900,
          margin: "auto",
        }}
      >
        <header
          style={{
            ...card,
            background: "#0f172a",
            color: "#ffffff",
          }}
        >
          <h1>Persetujuan Peserta OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
        </header>

        <section style={card}>
          <h2>Ringkasan Pendaftaran</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {[
              {
                label: "Menunggu",
                value: count("pending"),
              },
              {
                label: "Disetujui",
                value: count("approved"),
              },
              {
                label: "Ditolak",
                value: count("rejected"),
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: 14,
                  background: "#f8fafc",
                  borderRadius: 10,
                  border:
                    "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                  }}
                >
                  {item.label}
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={card}>
          <h2>Daftar Pengajuan</h2>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {[
              ["pending", "Menunggu"],
              ["approved", "Disetujui"],
              ["rejected", "Ditolak"],
              ["all", "Semua"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() =>
                  setFilter(value)
                }
                style={{
                  ...button,
                  background:
                    filter === value
                      ? "#2563eb"
                      : "#e2e8f0",
                  color:
                    filter === value
                      ? "#ffffff"
                      : "#334155",
                  padding: "9px 12px",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            style={{
              ...button,
              background: "#475569",
              marginBottom: 15,
            }}
            onClick={loadRegistrations}
            disabled={loading}
          >
            {loading
              ? "Memuat..."
              : "↻ Perbarui Data"}
          </button>

          {error && (
            <p style={{ color: "#dc2626" }}>
              {error}
            </p>
          )}

          {loading ? (
            <p>Memuat daftar pendaftaran...</p>
          ) : filtered.length === 0 ? (
            <p>
              Belum ada pengajuan pada kategori ini.
            </p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 16,
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 12,
                  marginBottom: 12,
                  background: "#f8fafc",
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  {item.full_name}
                </h3>

                <p>
                  Email: {item.email}
                </p>

                <p>
                  Departemen:{" "}
                  {item.department || "-"}
                </p>

                <p>
                  Tanggal daftar:{" "}
                  {formatDate(
                    item.created_at
                  )}
                </p>

                <Status value={item.status} />

                {item.status === "rejected" &&
                  item.rejection_reason && (
                    <p>
                      Alasan penolakan:{" "}
                      {item.rejection_reason}
                    </p>
                  )}

                {item.status === "pending" && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#64748b",
                      marginTop: 12,
                    }}
                  >
                    Tombol persetujuan akan
                    diaktifkan setelah API
                    keputusan mentor selesai.
                  </p>
                )}
              </div>
            ))
          )}
        </section>

        <button
          style={{
            ...button,
            background: "#475569",
          }}
          onClick={() => router.push("/")}
        >
          ← Kembali ke Dashboard Mentor
        </button>
      </div>
    </main>
  );
}
