
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

// OJT MineTrack v2.0
// Monitoring SIMPER — Read Only
// Sesuai dengan SIMPER Premium Mentor.
// Tidak memerlukan perubahan database Supabase.

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

const STAGES = [
  {
    label: "Validasi Persyaratan",
    key: "administration_status",
    icon: "📋",
    description: "Pemeriksaan kelengkapan persyaratan SIMPER.",
  },
  {
    label: "Ujian Teori",
    key: "theory_status",
    icon: "📚",
    description: "Pelaksanaan dan hasil ujian teori.",
  },
  {
    label: "Ujian Praktik",
    key: "practice_status",
    icon: "📝",
    description: "Pelaksanaan dan hasil ujian praktik.",
  },
  {
    label: "Penerbitan SIMPER",
    key: "issuance_status",
    icon: "🪪",
    description: "Pengajuan, orientasi, dan penerbitan SIMPER.",
  },
];

const VALIDATION = {
  pending: "Belum Proses",
  in_progress: "Dalam Proses",
  passed: "Valid",
  failed: "Perlu Perbaikan",
};

const EXAM = {
  pending: "Belum Ujian",
  in_progress: "Dijadwalkan / Proses",
  passed: "Lulus",
  failed: "Tidak Lulus",
};

const APPLICATION = {
  not_started: "Belum Diajukan",
  submitted: "Diajukan",
  processing: "Diproses",
  approved: "Disetujui",
  returned: "Dikembalikan",
};

const ORIENTATION = {
  not_started: "Belum Dilaksanakan",
  scheduled: "Dijadwalkan",
  completed: "Selesai",
};

const ISSUANCE = {
  not_issued: "Belum Terbit",
  processing: "Dalam Proses",
  issued: "SIMPER Terbit",
};

function label(value, options, fallback = "—") {
  if (!value) return fallback;

  return (
    options[value] ||
    String(value).replace(/_/g, " ")
  );
}

function formatDate(value) {
  if (!value) return "—";

  const text = String(value).slice(0, 10);
  const parts = text.split("-").map(Number);

  if (
    parts.length !== 3 ||
    parts.some((number) => !Number.isInteger(number))
  ) {
    return "—";
  }

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function parseNotes(value) {
  const raw = String(value || "");
  const start = raw.lastIndexOf(META_START);
  const end = raw.lastIndexOf(META_END);

  if (start < 0 || end <= start) {
    return {
      notes: raw,
      meta: null,
    };
  }

  const json = raw.slice(
    start + META_START.length,
    end
  );

  try {
    const data = JSON.parse(json);

    if (data?.version !== 2) {
      throw new Error("Versi metadata tidak sesuai.");
    }

    const humanNotes = (
      raw.slice(0, start) +
      raw.slice(end + META_END.length)
    ).trim();

    return {
      notes: humanNotes,
      meta: data,
    };
  } catch {
    return {
      notes: raw,
      meta: null,
    };
  }
}

function calculateProgress(record, meta) {
  const validation =
    record?.administration_status === "passed";

  const theory =
    record?.theory_status === "passed";

  const practice =
    record?.practice_status === "passed";

  const application =
    meta?.application_status === "approved";

  const orientation =
    meta?.orientation_status === "completed";

  const issued =
    meta?.issuance_status === "issued" &&
    Boolean(record?.graduation_date);

  const release =
    validation &&
    theory &&
    practice &&
    application &&
    orientation &&
    issued;

  const completed = [
    validation,
    theory,
    practice,
    release,
  ].filter(Boolean).length;

  const percentage = completed * 25;

  let status = "not_started";

  if (release) {
    status = "passed";
  } else if (
    record?.theory_status === "failed" ||
    record?.practice_status === "failed"
  ) {
    status = "failed";
  } else if (
    [
      record?.administration_status,
      record?.training_status,
      record?.theory_status,
      record?.practice_status,
      meta?.application_status,
      meta?.orientation_status,
      meta?.issuance_status,
    ].some((value) =>
      [
        "passed",
        "in_progress",
        "submitted",
        "processing",
        "approved",
        "returned",
        "scheduled",
        "completed",
        "issued",
      ].includes(value)
    ) ||
    Boolean(record?.application_date)
  ) {
    status = "in_progress";
  }

  return {
    validation,
    theory,
    practice,
    application,
    orientation,
    issued,
    release,
    completed,
    percentage,
    status,
  };
}

function statusName(status) {
  if (status === "passed") {
    return "SIMPER TERBIT";
  }

  if (status === "failed") {
    return "PERLU TINDAK LANJUT";
  }

  if (status === "in_progress") {
    return "DALAM PROSES";
  }

  return "BELUM PROSES";
}

function InfoRow({ title, value }) {
  return (
    <div className="sim-info">
      <span className="sim-info-label">
        {title}
      </span>

      <span className="sim-info-value">
        {value || "—"}
      </span>
    </div>
  );
}

export default function MonitoringSIMPER() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData(initial = false) {
    if (!programId) {
      setError("ID program OJT tidak ditemukan.");
      setLoading(false);
      return;
    }

    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const {
        data: auth,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !auth?.user) {
        router.replace("/login");
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const role = String(
        profile?.role || ""
      ).toLowerCase();

      const isMentor = role === "mentor";

      const isParticipant = [
        "participant",
        "peserta",
      ].includes(role);

      if (!isMentor && !isParticipant) {
        throw new Error(
          "Akun tidak memiliki akses monitoring."
        );
      }

      let query = supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          site,
          peserta:profiles!ojt_programs_participant_id_fkey(
            full_name,
            department
          )
        `)
        .eq("id", programId);

      if (isParticipant) {
        query = query.eq(
          "participant_id",
          auth.user.id
        );
      }

      const {
        data: programData,
        error: programError,
      } = await query.single();

      if (programError) {
        throw programError;
      }

      const {
        data: simperData,
        error: simperError,
      } = await supabase
        .from("simper_records")
        .select("*")
        .eq("program_id", programId)
        .order("created_at", {
          ascending: false,
        });

      if (simperError) {
        throw simperError;
      }

      const result = simperData || [];

      setProgram(programData);
      setRecords(result);

      setSelectedId((previous) =>
        result.some((item) => item.id === previous)
          ? previous
          : result[0]?.id || ""
      );
    } catch (err) {
      setError(
        err?.message ||
        "Gagal memuat data Monitoring SIMPER."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (programId) {
      loadData(true);
    } else {
      setError("ID program OJT tidak ditemukan.");
      setLoading(false);
    }
  }, [programId]);

  const record = useMemo(() => {
    return (
      records.find(
        (item) => item.id === selectedId
      ) ||
      records[0] ||
      null
    );
  }, [records, selectedId]);

  const parsedNotes = useMemo(
    () => parseNotes(record?.notes),
    [record?.notes]
  );

  const simperMeta = parsedNotes.meta;

  const progress = useMemo(
    () => calculateProgress(record, simperMeta),
    [record, simperMeta]
  );

  const stages = useMemo(() => {
    const done = [
      progress.validation,
      progress.theory,
      progress.practice,
      progress.release,
    ];

    return STAGES.map((stage, index) => {
      const value =
        index === 3
          ? simperMeta?.issuance_status || "not_issued"
          : record?.[stage.key];

      let displayStatus;

      if (index === 0) {
        displayStatus = label(
          value,
          VALIDATION,
          "Belum Proses"
        );
      } else if (index === 1 || index === 2) {
        displayStatus = label(
          value,
          EXAM,
          "Belum Ujian"
        );
      } else {
        displayStatus = label(
          value,
          ISSUANCE,
          "Belum Terbit"
        );
      }

      return {
        ...stage,
        value,
        displayStatus,
        complete: done[index],
      };
    });
  }, [record, simperMeta, progress]);

  const peserta = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const legacyWarning =
    Boolean(record) &&
    !simperMeta &&
    record.status === "passed";

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 24,
          background: "#f0f6f4",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h2>OJT MineTrack</h2>
        <p>Memuat Monitoring SIMPER...</p>
      </main>
    );
  }

  return (
    <main className="sim-root">
      <style>{`
        .sim-root {
          min-height: 100vh;
          background: #f0f6f4;
          color: #10332e;
          font-family: Arial, Helvetica, sans-serif;
        }

        .sim-root * {
          box-sizing: border-box;
        }

        .sim-header {
          background: #07343c;
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .sim-brand {
          font-size: 23px;
          font-weight: 900;
        }

        .sim-brand span {
          color: #27c68c;
        }

        .sim-back {
          background: #e1f5eb;
          color: #08664a;
          border: none;
          border-radius: 12px;
          padding: 13px 18px;
          font-weight: 800;
          cursor: pointer;
        }

        .sim-container {
          max-width: 960px;
          margin: auto;
          padding: 22px;
        }

        .sim-title {
          font-size: 28px;
          margin: 0 0 12px;
        }

        .sim-description {
          color: #738b82;
          line-height: 1.7;
          margin-bottom: 24px;
        }

        .sim-card {
          background: white;
          border: 1px solid #d9e8e1;
          border-radius: 18px;
          padding: 22px;
          margin-bottom: 18px;
        }

        .sim-card h2 {
          font-size: 21px;
          margin: 0 0 20px;
        }

        .sim-profile {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .sim-profile strong {
          font-size: 21px;
        }

        .sim-muted {
          color: #748d82;
          line-height: 1.6;
        }

        .sim-dark {
          background: #252525;
          border-radius: 19px;
          padding: 28px;
          color: white;
        }

        .sim-dark-label {
          color: #b5c2c5;
          font-size: 15px;
        }

        .sim-percent {
          font-size: 50px;
          font-weight: 900;
          margin: 22px 0;
        }

        .sim-progress {
          width: 100%;
          height: 14px;
          background: #454545;
          border-radius: 20px;
          overflow: hidden;
        }

        .sim-progress-fill {
          height: 100%;
          background: #32a65f;
          border-radius: inherit;
          transition: width .3s ease;
        }

        .sim-dark-bottom {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 20px;
          color: #b5c2c5;
          font-size: 14px;
        }

        .sim-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .sim-stage {
          border: 1px solid #deebe4;
          border-radius: 15px;
          padding: 20px;
          background: #fafdfb;
        }

        .sim-stage.complete {
          background: #edf8f2;
          border-color: #bde4cb;
        }

        .sim-stage-icon {
          font-size: 28px;
          margin-bottom: 12px;
        }

        .sim-stage-name {
          font-size: 18px;
          font-weight: 900;
          margin-bottom: 10px;
        }

        .sim-stage-description {
          color: #748d82;
          font-size: 12px;
          line-height: 1.6;
          margin-bottom: 13px;
        }

        .sim-stage-status {
          font-size: 13px;
          color: #748d82;
          margin-bottom: 12px;
        }

        .sim-stage-weight {
          font-size: 20px;
          font-weight: 900;
          color: #008755;
        }

        .sim-badge {
          display: inline-block;
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 800;
          background: #fff3da;
          color: #a36a12;
        }

        .sim-badge.complete {
          background: #e6f8ed;
          color: #008650;
        }

        .sim-info {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 0;
          border-bottom: 1px solid #e6eee9;
        }

        .sim-info:last-child {
          border-bottom: none;
        }

        .sim-info-label {
          color: #748d82;
        }

        .sim-info-value {
          font-weight: 800;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .sim-notes {
          background: #f4faf6;
          border-radius: 13px;
          padding: 18px;
          color: #526b60;
          line-height: 1.7;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .sim-select {
          width: 100%;
          padding: 15px;
          border: 1px solid #c8ded2;
          border-radius: 12px;
          background: white;
          color: #10332e;
          font-size: 16px;
        }

        .sim-empty {
          text-align: center;
          padding: 30px 16px;
          background: #f4faf6;
          border-radius: 13px;
          color: #71897e;
          line-height: 1.8;
        }

        .sim-alert {
          background: #fff1f1;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 18px;
          overflow-wrap: anywhere;
          line-height: 1.6;
        }

        .sim-warning {
          background: #fff8e5;
          color: #855700;
          border: 1px solid #f4dda0;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 18px;
          line-height: 1.6;
        }

        .sim-refresh {
          border: none;
          background: #e0f5e9;
          color: #008554;
          padding: 12px 17px;
          border-radius: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .sim-refresh:disabled {
          opacity: .5;
        }

        .sim-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 18px;
        }

        .sim-footer {
          text-align: center;
          color: #8ba398;
          font-size: 12px;
          padding: 20px;
        }

        @media (max-width: 650px) {
          .sim-header {
            padding: 16px;
          }

          .sim-brand {
            font-size: 19px;
          }

          .sim-back {
            padding: 11px 14px;
          }

          .sim-container {
            padding: 16px;
          }

          .sim-title {
            font-size: 24px;
          }

          .sim-card {
            padding: 19px;
          }

          .sim-dark {
            padding: 22px;
          }

          .sim-percent {
            font-size: 44px;
          }

          .sim-stage {
            padding: 14px;
          }

          .sim-stage-name {
            font-size: 16px;
          }

          .sim-profile strong {
            font-size: 18px;
          }

          .sim-info {
            font-size: 13px;
          }
        }
      `}</style>

      <header className="sim-header">
        <div className="sim-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="sim-back"
          onClick={() =>
            router.push(`/monitoring/${programId}`)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="sim-container">
        <h1 className="sim-title">
          Monitoring SIMPER
        </h1>

        <p className="sim-description">
          Monitoring tahapan pengurusan SIMPER
          peserta OJT, mulai dari validasi persyaratan,
          ujian teori, ujian praktik, hingga penerbitan
          SIMPER. Setiap tahap yang selesai bernilai 25%.
        </p>

        {error && (
          <div className="sim-alert" role="alert">
            {error}
          </div>
        )}

        {program && (
          <>
            <section className="sim-card sim-profile">
              <div>
                <strong>
                  {peserta?.full_name ||
                    "Peserta OJT"}
                </strong>

                <div className="sim-muted">
                  {peserta?.department || "—"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong>
                  {program.site || "—"}
                </strong>

                <div className="sim-muted">
                  Site OJT
                </div>
              </div>
            </section>

            <div className="sim-actions">
              <button
                type="button"
                className="sim-refresh"
                onClick={() => loadData(false)}
                disabled={refreshing}
              >
                {refreshing
                  ? "Memuat..."
                  : "↻ Refresh"}
              </button>
            </div>

            {records.length === 0 ? (
              <section className="sim-card">
                <div className="sim-empty">
                  <div style={{ fontSize: 40 }}>
                    🪪
                  </div>

                  <strong>
                    Belum ada data SIMPER
                  </strong>

                  <p>
                    Data pengurusan SIMPER akan
                    muncul setelah Mentor melakukan
                    input melalui sistem.
                  </p>
                </div>
              </section>
            ) : (
              <>
                {records.length > 1 && (
                  <section className="sim-card">
                    <h2>Pilih Data SIMPER</h2>

                    <select
                      className="sim-select"
                      value={record?.id || ""}
                      onChange={(event) =>
                        setSelectedId(
                          event.target.value
                        )
                      }
                    >
                      {records.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.simper_type || "SIMPER"}
                          {" — "}
                          {statusName(
                            calculateProgress(
                              item,
                              parseNotes(item.notes).meta
                            ).status
                          )}
                        </option>
                      ))}
                    </select>
                  </section>
                )}

                {legacyWarning && (
                  <div className="sim-warning">
                    Data SIMPER lama memiliki status lulus,
                    tetapi rincian pengajuan, orientasi,
                    dan penerbitan belum tersedia.
                    Mentor perlu melengkapi data tersebut
                    agar progres penerbitan dapat
                    dihitung secara akurat.
                  </div>
                )}

                <section className="sim-card">
                  <div className="sim-dark">
                    <div className="sim-dark-label">
                      Progres Pengurusan{" "}
                      {record?.simper_type || "SIMPER"}
                    </div>

                    <div className="sim-percent">
                      {progress.percentage}%
                    </div>

                    <div
                      className="sim-progress"
                      role="progressbar"
                      aria-label="Progres SIMPER"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress.percentage}
                    >
                      <div
                        className="sim-progress-fill"
                        style={{
                          width: `${progress.percentage}%`,
                        }}
                      />
                    </div>

                    <div className="sim-dark-bottom">
                      <span>
                        {progress.completed} dari 4
                        tahap selesai
                      </span>

                      <span>
                        {4 - progress.completed} tahap
                        tersisa
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 18,
                        color: "#d1ded7",
                        fontSize: 13,
                      }}
                    >
                      Status:{" "}
                      <strong>
                        {statusName(progress.status)}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="sim-card">
                  <h2>Tahapan Pengurusan SIMPER</h2>

                  <div className="sim-grid">
                    {stages.map((stage, index) => (
                      <div
                        key={stage.key}
                        className={`sim-stage ${
                          stage.complete
                            ? "complete"
                            : ""
                        }`}
                      >
                        <div className="sim-stage-icon">
                          {stage.icon}
                        </div>

                        <div className="sim-stage-name">
                          {index + 1}. {stage.label}
                        </div>

                        <div className="sim-stage-description">
                          {stage.description}
                        </div>

                        <div className="sim-stage-status">
                          <span
                            className={`sim-badge ${
                              stage.complete
                                ? "complete"
                                : ""
                            }`}
                          >
                            {stage.complete ? "✓ " : ""}
                            {stage.displayStatus}
                          </span>
                        </div>

                        <div className="sim-stage-weight">
                          {stage.complete ? "25%" : "0%"}
                        </div>

                        <div className="sim-muted">
                          dari bobot 25%
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="sim-card">
                  <h2>Informasi SIMPER</h2>

                  <InfoRow
                    title="Jenis SIMPER"
                    value={record?.simper_type || "—"}
                  />

                  <InfoRow
                    title="Status Keseluruhan"
                    value={statusName(progress.status)}
                  />

                  <InfoRow
                    title="Validasi Persyaratan"
                    value={label(
                      record?.administration_status,
                      VALIDATION,
                      "Belum Proses"
                    )}
                  />

                  <InfoRow
                    title="Ujian Teori"
                    value={label(
                      record?.theory_status,
                      EXAM,
                      "Belum Ujian"
                    )}
                  />

                  <InfoRow
                    title="Ujian Praktik"
                    value={label(
                      record?.practice_status,
                      EXAM,
                      "Belum Ujian"
                    )}
                  />

                  <InfoRow
                    title="Status Pengajuan"
                    value={label(
                      simperMeta?.application_status,
                      APPLICATION,
                      "Belum Diajukan"
                    )}
                  />

                  <InfoRow
                    title="Tanggal Pengajuan"
                    value={formatDate(
                      record?.application_date
                    )}
                  />

                  <InfoRow
                    title="Status Orientasi"
                    value={label(
                      simperMeta?.orientation_status,
                      ORIENTATION,
                      "Belum Dilaksanakan"
                    )}
                  />

                  <InfoRow
                    title="Tanggal Orientasi"
                    value={formatDate(
                      simperMeta?.orientation_date
                    )}
                  />

                  <InfoRow
                    title="Status Penerbitan"
                    value={label(
                      simperMeta?.issuance_status,
                      ISSUANCE,
                      "Belum Terbit"
                    )}
                  />

                  <InfoRow
                    title="Tanggal SIMPER Terbit"
                    value={formatDate(
                      record?.graduation_date
                    )}
                  />

                  <InfoRow
                    title="Nomor SIMPER"
                    value={
                      simperMeta?.issuance_number || "—"
                    }
                  />
                </section>

                <section className="sim-card">
                  <h2>Catatan Mentor</h2>

                  <div className="sim-notes">
                    {parsedNotes.notes ||
                      "Belum ada catatan SIMPER."}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        <footer className="sim-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
