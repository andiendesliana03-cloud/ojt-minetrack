
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TEST_PARTICIPANT_ID =
  "4e1256e3-ef0b-457d-a7a5-162dc8a1f332";

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO"
];

const card = {
  background: "white",
  padding: 20,
  borderRadius: 14,
  marginBottom: 16,
  border: "1px solid #e2e8f0"
};

const field = {
  display: "block",
  width: "100%",
  padding: 12,
  marginTop: 7,
  marginBottom: 18,
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  boxSizing: "border-box",
  fontSize: 16,
  color: "#0f172a",
  background: "white"
};

const button = {
  width: "100%",
  padding: 14,
  border: 0,
  borderRadius: 9,
  background: "#166534",
  color: "white",
  fontWeight: "bold",
  fontSize: 15,
  cursor: "pointer"
};

function formatDate(value) {
  if (!value) return "-";

  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function PengajuanPesertaPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [registration, setRegistration] = useState(null);

  const [site, setSite] = useState("SMO");
  const [startDate, setStartDate] =
    useState("2026-11-01");
  const [endDate, setEndDate] =
    useState("2027-01-29");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      const {
        data: currentProfile,
        error: profileError
      } = await supabase
        .from("profiles")
        .select("id,full_name,role,department")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (currentProfile?.role === "mentor") {
        router.replace("/");
        return;
      }

      if (currentProfile?.role !== "participant") {
        throw new Error("Profil peserta tidak valid.");
      }

      setProfile(currentProfile);

      const {
        data: activeProgram,
        error: programError
      } = await supabase
        .from("ojt_programs")
        .select("id")
        .eq("participant_id", currentUser.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (programError) throw programError;

      if (activeProgram) {
        router.replace("/dashboard-peserta");
        return;
      }

      const {
        data: newRegistration,
        error: newError
      } = await supabase
        .from("ojt_registration_requests")
        .select(
          "id,site,department,start_date,end_date,status,created_at"
        )
        .eq("participant_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newError) throw newError;

      const {
        data: oldRegistration,
        error: oldError
      } = await supabase
        .from("participant_registrations")
        .select("id,site,status,created_at")
        .eq("user_id", currentUser.id)
        .limit(1)
        .maybeSingle();

      if (oldError) throw oldError;

      setRegistration(
        oldRegistration || newRegistration || null
      );
    } catch (err) {
      setError(
        err.message || "Gagal membaca data peserta."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitRegistration(event) {
    event.preventDefault();

    if (sending || registration) return;

    setError("");
    setMessage("");

    if (user?.id !== TEST_PARTICIPANT_ID) {
      setError(
        "Pengiriman pengujian hanya untuk akun Peserta OJT."
      );
      return;
    }

    if (!user.email_confirmed_at) {
      setError("Email belum terverifikasi.");
      return;
    }

    if (
      !startDate ||
      !endDate ||
      endDate < startDate
    ) {
      setError("Periode OJT tidak valid.");
      return;
    }

    const confirmed = window.confirm(
      "Kirim pengajuan OJT sungguhan?\n\n" +
      "Site: " + site + "\n" +
      "Mulai: " + formatDate(startDate) + "\n" +
      "Selesai: " + formatDate(endDate) + "\n\n" +
      "Pengajuan akan disimpan dengan status pending."
    );

    if (!confirmed) return;

    setSending(true);

    try {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Sesi login berakhir. Silakan login kembali."
        );
      }

      const response = await fetch(
        "/api/participant/registration",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`
          },
          cache: "no-store",
          body: JSON.stringify({
            full_name: profile.full_name,
            department: "ER & SS",
            site,
            start_date: startDate,
            end_date: endDate,
            dry_run: false
          })
        }
      );

      const result = await response.json();

      if (
        !response.ok ||
        result.success !== true ||
        result.dry_run !== false
      ) {
        throw new Error(
          result.error ||
          "Pengajuan belum berhasil disimpan."
        );
      }

      setMessage(
        "Pengajuan berhasil dikirim! " +
        "Status: Menunggu Persetujuan Mentor."
      );

      await loadData();
    } catch (err) {
      setError(
        err.message || "Gagal mengirim pengajuan."
      );
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        color: "#0f172a",
        padding: "24px 15px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div style={{ maxWidth: 620, margin: "auto" }}>
        <header
          style={{
            ...card,
            background: "#0f172a",
            color: "white",
            textAlign: "center"
          }}
        >
          <h2>Pengajuan Peserta OJT</h2>
          <p>Emergency Response Group</p>
          <p>PT Berau Coal</p>
        </header>

        {loading ? (
          <section style={card}>
            Memeriksa status peserta...
          </section>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                style={{
                  ...card,
                  background: "#fef2f2",
                  color: "#991b1b"
                }}
              >
                {error}
              </div>
            )}

            {message && (
              <div
                role="status"
                style={{
                  ...card,
                  background: "#dcfce7",
                  color: "#166534"
                }}
              >
                <strong>{message}</strong>
              </div>
            )}

            <section style={card}>
              <h3>Informasi Peserta</h3>
              <p>
                <strong>Nama:</strong>{" "}
                {profile?.full_name || "-"}
              </p>
              <p>
                <strong>Email:</strong>{" "}
                {user?.email || "-"}
              </p>
              <p>
                <strong>Departemen:</strong> ER & SS
              </p>
              <p>
                <strong>Verifikasi:</strong>{" "}
                {user?.email_confirmed_at
                  ? "Terverifikasi"
                  : "Belum terverifikasi"}
              </p>
            </section>

            {registration ? (
              <section style={card}>
                <h3>Status Pengajuan OJT</h3>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 9,
                    background:
                      registration.status === "pending"
                        ? "#fef3c7"
                        : registration.status === "approved"
                        ? "#dcfce7"
                        : "#fee2e2"
                  }}
                >
                  <strong>
                    {registration.status === "pending"
                      ? "Menunggu Persetujuan Mentor"
                      : registration.status === "approved"
                      ? "Disetujui"
                      : registration.status === "rejected"
                      ? "Ditolak"
                      : registration.status}
                  </strong>
                </div>

                <p>
                  <strong>Site:</strong>{" "}
                  {registration.site || "-"}
                </p>

                {registration.start_date && (
                  <p>
                    <strong>Periode:</strong>{" "}
                    {formatDate(registration.start_date)}
                    {" s.d. "}
                    {formatDate(registration.end_date)}
                  </p>
                )}

                <p>
                  Pengajuan sudah tercatat.
                  Tidak perlu mengirim ulang.
                </p>
              </section>
            ) : user?.id === TEST_PARTICIPANT_ID ? (
              <section style={card}>
                <h3>Formulir Pengajuan OJT</h3>

                <p>
                  Pengajuan ini akan tersimpan
                  di Supabase dan menunggu persetujuan mentor.
                </p>

                <form onSubmit={submitRegistration}>
                  <label>
                    <strong>Site OJT</strong>
                  </label>

                  <select
                    style={field}
                    value={site}
                    disabled={sending}
                    onChange={(e) =>
                      setSite(e.target.value)
                    }
                  >
                    {SITES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <label>
                    <strong>Tanggal Mulai</strong>
                  </label>

                  <input
                    type="date"
                    style={field}
                    value={startDate}
                    required
                    disabled={sending}
                    onChange={(e) =>
                      setStartDate(e.target.value)
                    }
                  />

                  <label>
                    <strong>Tanggal Selesai</strong>
                  </label>

                  <input
                    type="date"
                    style={field}
                    value={endDate}
                    min={startDate}
                    required
                    disabled={sending}
                    onChange={(e) =>
                      setEndDate(e.target.value)
                    }
                  />

                  <button
                    type="submit"
                    style={button}
                    disabled={sending}
                  >
                    {sending
                      ? "Mengirim Pengajuan..."
                      : "Kirim Pengajuan OJT"}
                  </button>
                </form>
              </section>
            ) : (
              <section style={card}>
                Pengajuan sungguhan sementara
                dibatasi untuk akun pengujian Peserta OJT.
              </section>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={sending}
              style={{
                ...button,
                background: "#0f766e",
                marginBottom: 12
              }}
            >
              Perbarui Status
            </button>

            <button
              type="button"
              onClick={logout}
              style={{
                ...button,
                background: "#475569"
              }}
            >
              Keluar Akun
            </button>
          </>
        )}
      </div>
    </main>
  );
}
