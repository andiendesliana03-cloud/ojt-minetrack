
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

function today() {
  const d = new Date();
  const local = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "-";

  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function participantName(program) {
  return program?.peserta?.full_name || "Peserta OJT";
}

function Icon({ name, size = 20 }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6M9 12h12" />,
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V2h6v2M9 11h6M9 15h5" />
      </>
    ),
    chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20V7" />,
    check: <path d="m4 12 5 5L20 6" />,
    edit: <path d="m4 20 4-.8L20 7a2 2 0 0 0-3-3L5 16z" />,
    trash: (
      <>
        <path d="M4 7h16M9 4h6M6 7l1 14h10l1-14M10 11v6M14 11v6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.check}
    </svg>
  );
}

export default function PraktikMingguan() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);

  const [date, setDate] = useState(today);
  const [practice, setPractice] = useState("");
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [editId, setEditId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function fetchRecords(id) {
    const { data, error: err } = await supabase
      .from("weekly_practice_scores")
      .select(
        "id,program_id,practice_date,practice_name,score,notes,created_at"
      )
      .eq("program_id", id)
      .order("practice_date", { ascending: false });

    if (err) throw err;

    return data || [];
  }

  useEffect(() => {
    if (!programId) return;

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setMessage("");
      setProgram(null);
      setRecords([]);
      setEditId(null);
      setDate(today());
      setPractice("");
      setScore("");
      setNotes("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.role !== "mentor") {
          router.replace("/dashboard-peserta");
          return;
        }

        // Peserta diambil langsung berdasarkan ID
        // pada alamat halaman Detail Peserta.
        // Tidak ada dropdown untuk mengganti peserta.
        const {
          data: selected,
          error: programError,
        } = await supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            site,
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

        if (!selected) {
          throw new Error("Program peserta tidak ditemukan.");
        }

        if (selected.status !== "active") {
          throw new Error(
            "Program OJT peserta ini sudah tidak aktif."
          );
        }

        const history = await fetchRecords(selected.id);

        if (!active) return;

        setMentor(profile);
        setProgram(selected);
        setRecords(history);
      } catch (err) {
        if (active) {
          setError(err.message || "Gagal memuat data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [programId, router]);

  function resetForm() {
    setEditId(null);
    setDate(today());
    setPractice("");
    setScore("");
    setNotes("");
  }

  function goBack() {
    if (programId) {
      router.push(`/peserta/${programId}`);
    } else {
      router.push("/");
    }
  }

  async function savePractice(event) {
    event.preventDefault();

    // Pengamanan agar nilai hanya diproses
    // untuk program peserta yang sedang dibuka.
    if (
      !mentor ||
      !program ||
      program.id !== programId ||
      saving ||
      actionId
    ) {
      return;
    }

    const numericScore = Number(score);

    if (!date || !practice.trim()) {
      setError(
        "Tanggal pelaksanaan dan materi praktik wajib diisi."
      );
      return;
    }

    if (
      score.trim() === "" ||
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > 100
    ) {
      setError("Nilai harus antara 0 sampai 100.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: activeProgram,
        error: activeError,
      } = await supabase
        .from("ojt_programs")
        .select("id,status")
        .eq("id", program.id)
        .eq("status", "active")
        .maybeSingle();

      if (activeError) throw activeError;

      if (!activeProgram) {
        throw new Error("Program OJT sudah tidak aktif.");
      }

      const payload = {
        practice_date: date,
        practice_name: practice.trim(),
        score: numericScore,
        notes: notes.trim() || null,
      };

      const updating = Boolean(editId);

      const result = updating
        ? await supabase
            .from("weekly_practice_scores")
            .update(payload)
            .eq("id", editId)
            .eq("program_id", program.id)
            .select("id")
        : await supabase
            .from("weekly_practice_scores")
            .insert({
              ...payload,
              program_id: program.id,
              created_by: mentor.id,
            })
            .select("id");

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error(
          "Nilai praktik tidak berhasil disimpan."
        );
      }

      const latest = await fetchRecords(program.id);

      setRecords(latest);
      resetForm();

      setMessage(
        updating
          ? `Nilai ${participantName(program)} berhasil diperbarui.`
          : `Nilai ${participantName(program)} berhasil disimpan.`
      );
    } catch (err) {
      setError(err.message || "Gagal menyimpan nilai.");
    } finally {
      setSaving(false);
    }
  }

  function editPractice(item) {
    if (
      !program ||
      program.id !== programId ||
      item.program_id !== program.id ||
      saving ||
      actionId
    ) {
      return;
    }

    setEditId(item.id);
    setDate(item.practice_date);
    setPractice(item.practice_name);
    setScore(String(item.score));
    setNotes(item.notes || "");
    setError("");
    setMessage("");

    document
      .getElementById("practice-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  async function deletePractice(item) {
    if (
      !mentor ||
      !program ||
      program.id !== programId ||
      item.program_id !== program.id ||
      saving ||
      actionId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Hapus penilaian ini?\n\n` +
      `Peserta: ${participantName(program)}\n` +
      `Site: ${program.site || "-"}\n` +
      `Materi: ${item.practice_name}\n` +
      `Nilai: ${item.score}`
    );

    if (!confirmed) return;

    setActionId(item.id);
    setError("");
    setMessage("");

    try {
      const { data, error: err } = await supabase
        .from("weekly_practice_scores")
        .delete()
        .eq("id", item.id)
        .eq("program_id", program.id)
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error(
          "Nilai praktik tidak berhasil dihapus."
        );
      }

      if (editId === item.id) {
        resetForm();
      }

      const latest = await fetchRecords(program.id);

      setRecords(latest);
      setMessage(
        `Nilai ${participantName(program)} berhasil dihapus.`
      );
    } catch (err) {
      setError(err.message || "Gagal menghapus nilai.");
    } finally {
      setActionId(null);
    }
  }

  const total = records.length;

  const validScores = records
    .filter(
      (item) =>
        item.score !== null &&
        item.score !== undefined &&
        item.score !== ""
    )
    .map((item) => Number(item.score))
    .filter(Number.isFinite);

  const average = validScores.length
    ? validScores.reduce((sum, value) => sum + value, 0) /
      validScores.length
    : null;

  const name = participantName(program);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="pm-root">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .pm-root {
          min-height: 100vh;
          background: #f2f6f7;
          color: #18352c;
          font-family: Arial, Helvetica, sans-serif;
        }

        .pm-topbar {
          background: #071e25;
          color: white;
          min-height: 66px;
          padding: 14px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .pm-brand {
          font-size: 21px;
          font-weight: 900;
          letter-spacing: -.5px;
        }

        .pm-brand span {
          color: #2dcb92;
        }

        .pm-back {
          background: #ffffff13;
          border: 1px solid #ffffff30;
          border-radius: 9px;
          color: white;
          padding: 10px 13px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .pm-container {
          max-width: 1040px;
          margin: 0 auto;
          padding: 22px;
        }

        .pm-hero {
          border-radius: 17px;
          padding: 30px;
          margin-bottom: 18px;
          color: white;
          background:
            linear-gradient(
              90deg,
              rgba(5,25,31,.96),
              rgba(8,46,40,.77),
              rgba(5,35,37,.35)
            ),
            url("/background-erg.png.PNG");
          background-size: cover;
          background-position: center;
        }

        .pm-kicker {
          color: #ecc46f;
          font-size: 10px;
          letter-spacing: 1.7px;
          font-weight: 800;
        }

        .pm-hero h1 {
          font-size: 30px;
          line-height: 1.2;
          margin: 13px 0 8px;
        }

        .pm-hero p {
          color: #daebe5;
          font-size: 13px;
          margin: 0;
        }

        .pm-card {
          background: white;
          border: 1px solid #e3eae6;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: 0 5px 19px #102e2510;
        }

        .pm-title {
          color: #19382e;
          font-size: 18px;
          font-weight: 900;
          margin: 0 0 9px;
        }

        .pm-muted {
          color: #82948b;
          font-size: 12px;
          line-height: 1.6;
          margin: 0 0 17px;
        }

        .pm-label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #354b40;
          margin-bottom: 8px;
        }

        .pm-field {
          display: block;
          width: 100%;
          padding: 12px;
          background: white;
          border: 1px solid #d9e4dd;
          border-radius: 10px;
          color: #17372b;
          font-size: 16px;
          font-family: inherit;
          margin-bottom: 17px;
        }

        .pm-field:focus {
          outline: 2px solid #8ad5b5;
          outline-offset: 1px;
        }

        textarea.pm-field {
          resize: vertical;
        }

        .pm-identity {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: #f3faf6;
          border: 1px solid #dcefe3;
          border-radius: 13px;
        }

        .pm-avatar {
          flex-shrink: 0;
          width: 54px;
          height: 54px;
          border-radius: 13px;
          background: #d9f4e6;
          color: #087c54;
          display: grid;
          place-items: center;
          font-weight: 900;
          font-size: 19px;
        }

        .pm-person-name {
          font-size: 17px;
          font-weight: 900;
          color: #15392a;
          overflow-wrap: anywhere;
        }

        .pm-person-sub {
          font-size: 12px;
          color: #70877a;
          margin-top: 5px;
          line-height: 1.6;
        }

        .pm-badge {
          background: #dff7e9;
          color: #087d51;
          border-radius: 20px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          margin-left: auto;
        }

        .pm-locked-note {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #087a54;
          background: #f0fbf5;
          border: 1px solid #d3eedf;
          border-radius: 10px;
          padding: 11px 13px;
          margin-top: 13px;
          font-size: 12px;
          line-height: 1.6;
        }

        .pm-stats {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .pm-stat {
          border-radius: 15px;
          padding: 20px;
          background: white;
          border: 1px solid #e3eae6;
          box-shadow: 0 5px 19px #102e2510;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .pm-stat-icon {
          width: 47px;
          height: 47px;
          flex-shrink: 0;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #e4f7ee;
          color: #11845e;
        }

        .pm-stat-label {
          color: #74877c;
          font-size: 11px;
          font-weight: 700;
        }

        .pm-stat-number {
          font-weight: 900;
          color: #143629;
          font-size: 26px;
          margin-top: 4px;
        }

        .pm-btn {
          padding: 12px 17px;
          border: none;
          border-radius: 10px;
          background: #148761;
          color: white;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .pm-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .pm-btn.blue {
          background: #347bcc;
        }

        .pm-btn.red {
          background: #d33c42;
        }

        .pm-btn.gray {
          background: #697b86;
        }

        .pm-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 7px;
        }

        .pm-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 17px;
        }

        .pm-full {
          grid-column: 1 / -1;
        }

        .pm-error {
          padding: 14px;
          border-radius: 11px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #b91c1c;
          margin-bottom: 15px;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .pm-success {
          padding: 14px;
          border-radius: 11px;
          border: 1px solid #bbebd0;
          background: #ebfbf1;
          color: #087849;
          margin-bottom: 15px;
          font-size: 13px;
        }

        .pm-history {
          border: 1px solid #e2eae5;
          border-radius: 13px;
          background: #ffffff;
          padding: 17px;
          margin-bottom: 12px;
        }

        .pm-history-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .pm-history-name {
          font-weight: 900;
          font-size: 15px;
          color: #19382b;
          overflow-wrap: anywhere;
        }

        .pm-history-date {
          color: #88958e;
          font-size: 11px;
          margin-top: 7px;
        }

        .pm-score {
          color: #0f855e;
          background: #e6f8ee;
          border-radius: 12px;
          font-size: 21px;
          font-weight: 900;
          padding: 10px 13px;
          white-space: nowrap;
        }

        .pm-notes {
          font-size: 12px;
          color: #5e7669;
          line-height: 1.7;
          margin: 14px 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .pm-empty {
          text-align: center;
          padding: 25px 12px;
          color: #84968c;
          font-size: 13px;
        }

        .pm-footer {
          text-align: center;
          color: #91a096;
          font-size: 11px;
          padding: 20px;
          line-height: 1.7;
        }

        @media (max-width: 760px) {
          .pm-topbar {
            min-height: 60px;
            padding: 13px 16px;
          }

          .pm-brand {
            font-size: 18px;
          }

          .pm-back {
            padding: 9px;
            font-size: 0;
          }

          .pm-back svg {
            width: 20px;
            height: 20px;
          }

          .pm-container {
            padding: 12px;
          }

          .pm-hero {
            padding: 23px 18px;
            border-radius: 14px;
            margin-bottom: 12px;
          }

          .pm-hero h1 {
            font-size: 24px;
          }

          .pm-card {
            padding: 15px;
            border-radius: 14px;
            margin-bottom: 12px;
          }

          .pm-title {
            font-size: 16px;
          }

          .pm-identity {
            gap: 10px;
            padding: 12px;
          }

          .pm-avatar {
            width: 43px;
            height: 43px;
            font-size: 16px;
          }

          .pm-person-name {
            font-size: 14px;
          }

          .pm-person-sub {
            font-size: 11px;
          }

          .pm-stats {
            gap: 9px;
          }

          .pm-stat {
            padding: 13px 11px;
            gap: 9px;
          }

          .pm-stat-icon {
            width: 34px;
            height: 34px;
          }

          .pm-stat-icon svg {
            width: 19px;
            height: 19px;
          }

          .pm-stat-number {
            font-size: 22px;
          }

          .pm-stat-label {
            font-size: 10px;
          }

          .pm-form-grid {
            grid-template-columns: 1fr;
          }

          .pm-full {
            grid-column: auto;
          }

          .pm-history {
            padding: 14px;
          }

          .pm-history-name {
            font-size: 14px;
          }

          .pm-score {
            padding: 9px 11px;
            font-size: 18px;
          }
        }
      `}</style>

      <header className="pm-topbar">
        <div className="pm-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="pm-back"
          onClick={goBack}
          aria-label="Kembali ke Detail Peserta"
        >
          <Icon name="back" size={18} />
          Detail Peserta
        </button>
      </header>

      <div className="pm-container">
        <section className="pm-hero">
          <div className="pm-kicker">
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </div>

          <h1>Praktik Mingguan</h1>

          <p>
            Penilaian Kompetensi dan Kegiatan Praktik OJT
          </p>
        </section>

        {loading ? (
          <section className="pm-card">
            <h2 className="pm-title">Memuat Data...</h2>
            <p className="pm-muted">
              Mengambil identitas peserta dan riwayat
              penilaian dari Supabase.
            </p>
          </section>
        ) : !mentor || !program ? (
          <section className="pm-card">
            <h2 className="pm-title">
              Data Tidak Dapat Ditampilkan
            </h2>

            <p className="pm-error" role="alert">
              {error || "Program peserta tidak ditemukan."}
            </p>

            <button
              type="button"
              className="pm-btn"
              onClick={() => router.push("/")}
            >
              Kembali ke Dashboard
            </button>
          </section>
        ) : (
          <>
            {/* IDENTITAS PESERTA OTOMATIS */}
            <section className="pm-card">
              <h2 className="pm-title">
                Peserta yang Sedang Dinilai
              </h2>

              <p className="pm-muted">
                Identitas otomatis berdasarkan peserta yang
                dipilih dari Dashboard Mentor.
              </p>

              <div className="pm-identity">
                <div className="pm-avatar">
                  {initials}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="pm-person-name">
                    {name}
                  </div>

                  <div className="pm-person-sub">
                    {program.peserta?.department || "-"}
                    {" · "}
                    {program.site || "-"}
                    <br />
                    {formatDate(program.start_date)}
                    {" – "}
                    {formatDate(program.end_date)}
                  </div>
                </div>

                <span className="pm-badge">
                  Aktif
                </span>
              </div>

              <div className="pm-locked-note">
                <Icon name="lock" size={17} />
                <span>
                  Peserta terkunci untuk halaman ini.
                  Nilai hanya disimpan pada program{" "}
                  <strong>{name}</strong>.
                </span>
              </div>
            </section>

            {/* STATISTIK */}
            <div className="pm-stats">
              <div className="pm-stat">
                <div className="pm-stat-icon">
                  <Icon name="clipboard" />
                </div>

                <div>
                  <div className="pm-stat-label">
                    Total Penilaian
                  </div>

                  <div className="pm-stat-number">
                    {total}
                  </div>
                </div>
              </div>

              <div className="pm-stat">
                <div
                  className="pm-stat-icon"
                  style={{
                    background: "#e8f1ff",
                    color: "#347bcc",
                  }}
                >
                  <Icon name="chart" />
                </div>

                <div>
                  <div className="pm-stat-label">
                    Rata-rata Nilai
                  </div>

                  <div className="pm-stat-number">
                    {average === null
                      ? "—"
                      : average.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="pm-error" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="pm-success" role="status">
                ✓ {message}
              </div>
            )}

            {/* FORM INPUT */}
            <section
              className="pm-card"
              id="practice-form"
            >
              <h2 className="pm-title">
                {editId
                  ? "Edit Penilaian Praktik"
                  : "Input Penilaian Praktik"}
              </h2>

              <p className="pm-muted">
                Nilai akan disimpan untuk{" "}
                <strong>{name}</strong>.
              </p>

              <form onSubmit={savePractice}>
                <div className="pm-form-grid">
                  <div>
                    <label
                      htmlFor="pm-date"
                      className="pm-label"
                    >
                      Tanggal Pelaksanaan
                    </label>

                    <input
                      id="pm-date"
                      className="pm-field"
                      type="date"
                      value={date}
                      onChange={(e) =>
                        setDate(e.target.value)
                      }
                      disabled={saving}
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pm-score"
                      className="pm-label"
                    >
                      Nilai Praktik (0–100)
                    </label>

                    <input
                      id="pm-score"
                      className="pm-field"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={score}
                      onChange={(e) =>
                        setScore(e.target.value)
                      }
                      placeholder="Contoh: 90"
                      disabled={saving}
                      required
                    />
                  </div>

                  <div className="pm-full">
                    <label
                      htmlFor="pm-practice"
                      className="pm-label"
                    >
                      Materi / Jenis Praktik
                    </label>

                    <input
                      id="pm-practice"
                      className="pm-field"
                      type="text"
                      value={practice}
                      onChange={(e) =>
                        setPractice(e.target.value)
                      }
                      placeholder="Contoh: Fire Fighting"
                      disabled={saving}
                      required
                    />
                  </div>

                  <div className="pm-full">
                    <label
                      htmlFor="pm-notes"
                      className="pm-label"
                    >
                      Catatan Evaluasi Mentor
                    </label>

                    <textarea
                      id="pm-notes"
                      className="pm-field"
                      rows={4}
                      value={notes}
                      onChange={(e) =>
                        setNotes(e.target.value)
                      }
                      placeholder="Tuliskan hasil dan evaluasi praktik..."
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="pm-actions">
                  <button
                    type="submit"
                    className="pm-btn"
                    disabled={
                      saving || Boolean(actionId)
                    }
                  >
                    <Icon name="check" size={17} />

                    {saving
                      ? "Menyimpan..."
                      : editId
                      ? "Simpan Perubahan"
                      : "Simpan Nilai Praktik"}
                  </button>

                  {editId && (
                    <button
                      type="button"
                      className="pm-btn gray"
                      onClick={resetForm}
                      disabled={saving}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* RIWAYAT PESERTA */}
            <section className="pm-card">
              <h2 className="pm-title">
                Riwayat Penilaian Praktik
              </h2>

              <p className="pm-muted">
                {total} penilaian untuk{" "}
                <strong>{name}</strong>.
              </p>

              {records.length === 0 && (
                <div className="pm-empty">
                  Belum ada nilai praktik untuk peserta ini.
                </div>
              )}

              {records.map((item) => (
                <article
                  key={item.id}
                  className="pm-history"
                >
                  <div className="pm-history-header">
                    <div>
                      <div className="pm-history-name">
                        {item.practice_name}
                      </div>

                      <div className="pm-history-date">
                        {formatDate(item.practice_date)}
                      </div>
                    </div>

                    <div className="pm-score">
                      {item.score}
                    </div>
                  </div>

                  <div className="pm-notes">
                    {item.notes ||
                      "Tidak ada catatan evaluasi."}
                  </div>

                  <div className="pm-actions">
                    <button
                      type="button"
                      className="pm-btn blue"
                      onClick={() => editPractice(item)}
                      disabled={
                        saving || Boolean(actionId)
                      }
                    >
                      <Icon name="edit" size={15} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="pm-btn red"
                      onClick={() => deletePractice(item)}
                      disabled={
                        saving || Boolean(actionId)
                      }
                    >
                      <Icon name="trash" size={15} />
                      {actionId === item.id
                        ? "Menghapus..."
                        : "Hapus"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        <footer className="pm-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
