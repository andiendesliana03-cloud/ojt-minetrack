
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

const KMKOP_OPTIONS = [
  ["pending", "Belum Mengikuti"],
  ["in_progress", "Dalam Proses"],
  ["passed", "Lulus / Tervalidasi"],
  ["failed", "Tidak Lulus"],
];

const PRAKTIK_OPTIONS = [
  ["pending", "Belum Mengikuti"],
  ["in_progress", "Dalam Proses"],
  ["passed", "Lulus / Tervalidasi"],
  ["failed", "Tidak Lulus"],
];

const ORIENTASI_OPTIONS = [
  ["not_started", "Belum Dilaksanakan"],
  ["scheduled", "Dijadwalkan"],
  ["completed", "Selesai / Tervalidasi"],
];

const PENERBITAN_OPTIONS = [
  ["not_issued", "Belum Terbit"],
  ["processing", "Dalam Proses Penerbitan"],
  ["issued", "SIMPER Terbit"],
];

function blank() {
  return {
    simper_type: "SIMPER",
    administration_status: "pending",
    training_status: "pending",
    theory_status: "pending",
    practice_status: "pending",
    application_date: "",
    graduation_date: "",
    application_status: "not_started",
    orientation_status: "not_started",
    issuance_status: "not_issued",
    orientation_date: "",
    issuance_number: "",
    notes: "",
  };
}

function parseNotes(value) {
  const raw = String(value || "");
  const start = raw.lastIndexOf(META_START);
  const end = raw.lastIndexOf(META_END);

  if (start < 0 || end <= start) {
    return { notes: raw, meta: {} };
  }

  try {
    const json = raw.slice(
      start + META_START.length,
      end
    );

    const meta = JSON.parse(json);

    return {
      notes: (
        raw.slice(0, start) +
        raw.slice(end + META_END.length)
      ).trim(),
      meta:
        meta &&
        typeof meta === "object" &&
        !Array.isArray(meta)
          ? meta
          : {},
    };
  } catch {
    return { notes: raw, meta: {} };
  }
}

function buildNotes(form) {
  const meta = {
    version: 4,
    assessment_model: "KMKOP_PRAKTIK_ORIENTASI",
    application_status: form.application_status,
    orientation_status: form.orientation_status,
    issuance_status: form.issuance_status,
    orientation_date: form.orientation_date,
    issuance_number: form.issuance_number,
  };

  return (
    (form.notes.trim()
      ? form.notes.trim() + "\n\n"
      : "") +
    META_START +
    JSON.stringify(meta) +
    META_END
  );
}

function fromRecord(data) {
  if (!data) return blank();

  const parsed = parseNotes(data.notes);

  return {
    ...blank(),
    simper_type: data.simper_type || "SIMPER",
    administration_status:
      data.administration_status || "pending",
    training_status:
      data.training_status || "pending",
    theory_status:
      data.theory_status || "pending",
    practice_status:
      data.practice_status || "pending",
    application_date:
      data.application_date || "",
    graduation_date:
      data.graduation_date || "",
    application_status:
      parsed.meta.application_status || "not_started",
    orientation_status:
      parsed.meta.orientation_status || "not_started",
    issuance_status:
      parsed.meta.issuance_status || "not_issued",
    orientation_date:
      parsed.meta.orientation_date || "",
    issuance_number:
      parsed.meta.issuance_number || "",
    notes: parsed.notes,
  };
}

function calculateProgress(form) {
  const kmkop = form.theory_status === "passed";
  const praktik = form.practice_status === "passed";
  const orientasi =
    form.orientation_status === "completed";

  const completed = [
    kmkop,
    praktik,
    orientasi,
  ].filter(Boolean).length;

  const percentage = Math.round(
    (completed / 3) * 100
  );

  const passed = completed === 3;

  const failed =
    form.theory_status === "failed" ||
    form.practice_status === "failed";

  const started =
    completed > 0 ||
    failed ||
    form.theory_status === "in_progress" ||
    form.practice_status === "in_progress" ||
    form.orientation_status === "scheduled";

  const status = passed
    ? "passed"
    : failed
    ? "failed"
    : started
    ? "in_progress"
    : "not_started";

  return {
    kmkop,
    praktik,
    orientasi,
    completed,
    percentage,
    passed,
    status,
  };
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value)
    .slice(0, 10)
    .split("-");

  return parts.length === 3
    ? parts.reverse().join("/")
    : "—";
}

function optionLabel(options, value) {
  return (
    options.find(([key]) => key === value)?.[1] ||
    "—"
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}) {
  return (
    <label className="sp-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder = "",
}) {
  return (
    <label className="sp-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </label>
  );
}

function AssessmentCard({
  number,
  title,
  description,
  complete,
  children,
}) {
  return (
    <section className="sp-card">
      <div className="sp-stage-header">
        <div className="sp-number">{number}</div>
        <div className="sp-stage-text">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span
          className={
            complete
              ? "sp-badge complete"
              : "sp-badge"
          }
        >
          {complete ? "Tervalidasi" : "Belum Selesai"}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function InputSIMPER() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [form, setForm] = useState(blank);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const progress = useMemo(
    () => calculateProgress(form),
    [form]
  );

  const peserta = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const name = peserta?.full_name || "Peserta OJT";

  const disabled =
    loading ||
    saving ||
    deleting ||
    program?.status !== "active";

  const finalStatus = progress.passed
    ? "LULUS"
    : "BELUM LULUS";

  const issuanceLabel = optionLabel(
    PENERBITAN_OPTIONS,
    form.issuance_status
  );

  function change(name, value) {
    setForm((previous) => {
      const next = {
        ...previous,
        [name]: value,
      };

      // Jika status bukan Terbit, tanggal dan nomor
      // dikosongkan agar tidak terbaca sebagai
      // SIMPER yang sudah diterbitkan.
      if (
        name === "issuance_status" &&
        value !== "issued"
      ) {
        next.graduation_date = "";
        next.issuance_number = "";
      }

      return next;
    });

    setError("");
    setSuccess("");
  }

  async function getRecord(id) {
    const { data, error: queryError } = await supabase
      .from("simper_records")
      .select("*")
      .eq("program_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) throw queryError;

    return data?.[0] || null;
  }

  function applyRecord(data) {
    setRecordId(data?.id || null);
    setForm(fromRecord(data));
  }

  async function reload() {
    const data = await getRecord(programId);
    applyRecord(data);
  }

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak ditemukan.");
      setLoading(false);
      return;
    }

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

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

        if (
          String(profile?.role).toLowerCase() !==
          "mentor"
        ) {
          router.replace("/peserta");
          return;
        }

        const {
          data: programData,
          error: programError,
        } = await supabase
          .from("ojt_programs")
          .select(`
            id,
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

        const record = await getRecord(programId);

        if (!active) return;

        setMentor(profile);
        setProgram(programData);
        applyRecord(record);
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
            "Gagal memuat data SIMPER."
          );
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

  async function save(event) {
    event.preventDefault();

    if (
      disabled ||
      !mentor ||
      !program ||
      program.id !== programId
    ) {
      return;
    }

    setError("");
    setSuccess("");

    if (!form.simper_type.trim()) {
      setError("Jenis SIMPER wajib diisi.");
      return;
    }

    if (
      progress.orientasi &&
      !form.orientation_date
    ) {
      setError(
        "Tanggal Orientasi Area wajib diisi " +
        "jika status sudah selesai."
      );
      return;
    }

    if (
      form.issuance_status === "issued" &&
      !progress.passed
    ) {
      setError(
        "SIMPER hanya dapat dinyatakan terbit " +
        "jika KMKOP, Praktik, dan Orientasi Area " +
        "sudah terpenuhi."
      );
      return;
    }

    if (
      form.issuance_status === "issued" &&
      !form.graduation_date
    ) {
      setError(
        "Tanggal terbit wajib diisi apabila " +
        "status SIMPER Terbit."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: activeProgram,
        error: activeError,
      } = await supabase
        .from("ojt_programs")
        .select("id")
        .eq("id", programId)
        .eq("status", "active")
        .maybeSingle();

      if (activeError) throw activeError;

      if (!activeProgram) {
        throw new Error("Program OJT tidak aktif.");
      }

      const payload = {
        simper_type: form.simper_type.trim(),

        // Kolom lama tetap dipertahankan.
        administration_status:
          form.administration_status,
        training_status:
          form.training_status,

        // KMKOP dan Praktik.
        theory_status: form.theory_status,
        practice_status: form.practice_status,

        // Orientasi dan penerbitan tersimpan
        // dalam metadata notes.
        notes: buildNotes(form),

        // Status kelulusan otomatis.
        status: progress.status,

        // Informasi lama dipertahankan.
        application_date:
          form.application_date || null,

        // Tanggal terbit menggunakan kolom
        // graduation_date yang sudah tersedia.
        graduation_date:
          form.issuance_status === "issued"
            ? form.graduation_date
            : null,
      };

      let result;

      if (recordId) {
        result = await supabase
          .from("simper_records")
          .update(payload)
          .eq("id", recordId)
          .eq("program_id", programId)
          .select("id");
      } else {
        result = await supabase
          .from("simper_records")
          .insert({
            ...payload,
            program_id: programId,
            created_by: mentor.id,
          })
          .select("id");
      }

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error(
          "Data SIMPER belum berhasil disimpan."
        );
      }

      await reload();

      setSuccess(
        "Penilaian dan penerbitan SIMPER berhasil disimpan."
      );
    } catch (err) {
      setError(
        err?.message ||
        "Gagal menyimpan data SIMPER."
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !recordId ||
      disabled ||
      !program ||
      program.id !== programId
    ) {
      return;
    }

    if (
      !window.confirm(
        `Hapus seluruh data SIMPER ${name}? ` +
        "Tindakan ini tidak dapat dibatalkan."
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: deleteError } =
        await supabase
          .from("simper_records")
          .delete()
          .eq("id", recordId)
          .eq("program_id", programId)
          .select("id");

      if (deleteError) throw deleteError;

      if (!data?.length) {
        throw new Error(
          "Data tidak berhasil dihapus."
        );
      }

      await reload();

      setSuccess("Data SIMPER berhasil dihapus.");
    } catch (err) {
      setError(
        err?.message ||
        "Gagal menghapus data SIMPER."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="sp-root">
      <style>{`
        .sp-root {
          min-height: 100vh;
          background: #f2f6f5;
          color: #143b31;
          font-family: Arial, Helvetica, sans-serif;
        }

        .sp-root * {
          box-sizing: border-box;
        }

        .sp-top {
          background: #092b32;
          color: white;
          padding: 17px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .sp-brand {
          font-size: 20px;
          font-weight: 900;
        }

        .sp-brand span {
          color: #29c995;
        }

        .sp-back {
          border: 1px solid #ffffff35;
          background: #ffffff15;
          color: white;
          border-radius: 10px;
          padding: 11px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .sp-container {
          max-width: 980px;
          margin: auto;
          padding: 18px;
        }

        .sp-hero {
          background: linear-gradient(
            120deg,
            #09262c,
            #0b493d
          );
          color: white;
          border-radius: 17px;
          padding: 25px;
          margin-bottom: 15px;
        }

        .sp-hero small {
          color: #f2cf8c;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .sp-hero h1 {
          font-size: 27px;
          margin: 11px 0;
        }

        .sp-hero p {
          font-size: 13px;
          color: #d7e9e3;
          line-height: 1.6;
          margin: 0;
        }

        .sp-card {
          background: white;
          border: 1px solid #dce9e2;
          border-radius: 15px;
          padding: 20px;
          margin-bottom: 15px;
          box-shadow: 0 4px 15px #123a2708;
        }

        .sp-card h2 {
          font-size: 17px;
          margin: 0 0 8px;
        }

        .sp-card p {
          font-size: 12px;
          color: #70897c;
          line-height: 1.6;
        }

        .sp-profile {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .sp-profile strong {
          font-size: 16px;
        }

        .sp-muted {
          color: #748b80;
          font-size: 12px;
          line-height: 1.8;
        }

        .sp-progress-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .sp-percent {
          font-size: 34px;
          font-weight: 900;
          color: #09845b;
        }

        .sp-track {
          height: 12px;
          background: #e4ede8;
          border-radius: 20px;
          overflow: hidden;
          margin: 14px 0;
        }

        .sp-fill {
          height: 100%;
          background: linear-gradient(
            90deg,
            #0b9766,
            #4bd2a0
          );
          transition: width .2s;
        }

        .sp-status {
          display: inline-block;
          padding: 10px 13px;
          background: #fff4df;
          color: #92600e;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 900;
        }

        .sp-status.passed {
          background: #ddf7e8;
          color: #087c52;
        }

        .sp-stage-header {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 17px;
        }

        .sp-number {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #def6e9;
          color: #078358;
          font-weight: 900;
        }

        .sp-stage-text {
          flex: 1;
          min-width: 0;
        }

        .sp-stage-text h2 {
          margin: 2px 0 5px;
        }

        .sp-stage-text p {
          margin: 0;
        }

        .sp-badge {
          background: #eef2f0;
          color: #708076;
          border-radius: 20px;
          padding: 7px 9px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .sp-badge.complete {
          background: #dcf7e8;
          color: #087d51;
        }

        .sp-field {
          display: block;
          margin: 13px 0;
        }

        .sp-field span {
          display: block;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .sp-field input,
        .sp-field select,
        .sp-field textarea {
          display: block;
          width: 100%;
          padding: 12px;
          border: 1px solid #d5e5db;
          border-radius: 10px;
          background: white;
          color: #143b31;
          font-family: inherit;
          font-size: 16px;
        }

        .sp-field :disabled {
          background: #edf2ef;
          color: #7c8d82;
        }

        .sp-info {
          padding: 13px 0;
          border-bottom: 1px solid #e7eee9;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
        }

        .sp-info strong {
          text-align: right;
          color: #0a8057;
        }

        .sp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .sp-button {
          background: #0e9565;
          border: 0;
          border-radius: 10px;
          color: white;
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .sp-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .sp-button.danger {
          background: #d2474e;
        }

        .sp-alert {
          padding: 14px;
          border-radius: 10px;
          margin-bottom: 14px;
          font-size: 12px;
          line-height: 1.7;
        }

        .sp-alert.error {
          background: #fff0f0;
          color: #b91c1c;
        }

        .sp-alert.success {
          background: #e7faee;
          color: #087d51;
        }

        .sp-alert.info {
          background: #fff8e7;
          color: #805d12;
        }

        .sp-footer {
          text-align: center;
          font-size: 11px;
          color: #879b90;
          padding: 20px 0;
        }

        @media (max-width: 650px) {
          .sp-top {
            padding: 13px;
          }

          .sp-brand {
            font-size: 17px;
          }

          .sp-container {
            padding: 12px;
          }

          .sp-hero {
            padding: 21px 17px;
          }

          .sp-hero h1 {
            font-size: 23px;
          }

          .sp-card {
            padding: 15px;
          }

          .sp-stage-header {
            flex-wrap: wrap;
          }

          .sp-profile strong {
            font-size: 14px;
          }
        }
      `}</style>

      <header className="sp-top">
        <div className="sp-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="sp-back"
          onClick={() =>
            router.push(
              programId
                ? `/peserta/${programId}`
                : "/"
            )
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="sp-container">
        <section className="sp-hero">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>
          <h1>Monitoring SIMPER</h1>
          <p>
            Penilaian KMKOP, Praktik, Orientasi Area,
            dan status penerbitan SIMPER peserta OJT.
          </p>
        </section>

        {loading ? (
          <section className="sp-card">
            Memuat data SIMPER...
          </section>
        ) : !mentor || !program ? (
          <section className="sp-card">
            <h2>Data Tidak Dapat Ditampilkan</h2>
            <div className="sp-alert error">
              {error || "Akses tidak tersedia."}
            </div>
          </section>
        ) : (
          <>
            <section className="sp-card">
              <div className="sp-profile">
                <div>
                  <strong>{name}</strong>
                  <div className="sp-muted">
                    {peserta?.department || "—"}
                    {" · "}
                    {program.site || "—"}
                    <br />
                    {formatDate(program.start_date)}
                    {" – "}
                    {formatDate(program.end_date)}
                  </div>
                </div>
                <span
                  className={
                    program.status === "active"
                      ? "sp-badge complete"
                      : "sp-badge"
                  }
                >
                  {program.status === "active"
                    ? "Aktif"
                    : "Tidak Aktif"}
                </span>
              </div>
              <p>
                Identitas peserta otomatis dan terkunci.
                Penilaian ini hanya untuk {name}.
              </p>
            </section>

            {error && (
              <div className="sp-alert error">
                {error}
              </div>
            )}

            {success && (
              <div className="sp-alert success">
                {success}
              </div>
            )}

            <section className="sp-card">
              <div className="sp-progress-head">
                <div>
                  <h2>Progres SIMPER</h2>
                  <p>
                    {progress.completed} dari 3
                    komponen terpenuhi
                  </p>
                </div>
                <div className="sp-percent">
                  {progress.percentage}%
                </div>
              </div>

              <div className="sp-track">
                <div
                  className="sp-fill"
                  style={{
                    width: `${progress.percentage}%`,
                  }}
                />
              </div>

              <div className="sp-progress-statuses">
                <div>
                  <span className="sp-mini-label">
                    Status Kelulusan
                  </span>
                  <span
                    className={
                      progress.passed
                        ? "sp-status passed"
                        : "sp-status"
                    }
                  >
                    {finalStatus}
                  </span>
                </div>

                <div>
                  <span className="sp-mini-label">
                    Status Penerbitan
                  </span>
                  <span
                    className={
                      form.issuance_status === "issued"
                        ? "sp-status passed"
                        : "sp-status"
                    }
                  >
                    {issuanceLabel}
                  </span>
                </div>
              </div>

              <p>
                Progres dihitung dari KMKOP,
                Praktik, dan Orientasi Area.
                Status penerbitan tidak menambah
                atau mengurangi persentase.
              </p>
            </section>

            <form onSubmit={save}>
              <section className="sp-card">
                <h2>Informasi SIMPER</h2>
                <InputField
                  label="Jenis SIMPER"
                  value={form.simper_type}
                  onChange={(value) =>
                    change("simper_type", value)
                  }
                  disabled={disabled}
                  placeholder="Contoh: SIMPER LV"
                />
              </section>

              <AssessmentCard
                number="01"
                title="KMKOP"
                description="Peserta memenuhi persyaratan dan dinyatakan lulus pada komponen KMKOP."
                complete={progress.kmkop}
              >
                <SelectField
                  label="Status KMKOP"
                  value={form.theory_status}
                  options={KMKOP_OPTIONS}
                  disabled={disabled}
                  onChange={(value) =>
                    change("theory_status", value)
                  }
                />
              </AssessmentCard>

              <AssessmentCard
                number="02"
                title="Praktik"
                description="Peserta memenuhi standar praktik dan hasilnya telah divalidasi."
                complete={progress.praktik}
              >
                <SelectField
                  label="Status Praktik"
                  value={form.practice_status}
                  options={PRAKTIK_OPTIONS}
                  disabled={disabled}
                  onChange={(value) =>
                    change("practice_status", value)
                  }
                />
              </AssessmentCard>

              <AssessmentCard
                number="03"
                title="Orientasi Area"
                description="Orientasi Area telah dilaksanakan dan dibuktikan dengan pencatatan atau validasi."
                complete={progress.orientasi}
              >
                <SelectField
                  label="Status Orientasi Area"
                  value={form.orientation_status}
                  options={ORIENTASI_OPTIONS}
                  disabled={disabled}
                  onChange={(value) =>
                    change("orientation_status", value)
                  }
                />

                <InputField
                  label="Tanggal Orientasi Area"
                  type="date"
                  value={form.orientation_date}
                  disabled={disabled}
                  onChange={(value) =>
                    change("orientation_date", value)
                  }
                />
              </AssessmentCard>

              <section className="sp-card">
                <div className="sp-stage-header">
                  <div className="sp-number">04</div>
                  <div className="sp-stage-text">
                    <h2>Penerbitan SIMPER</h2>
                    <p>
                      Monitoring penerbitan kartu SIMPER
                      setelah persyaratan peserta terpenuhi.
                    </p>
                  </div>

                  <span
                    className={
                      form.issuance_status === "issued"
                        ? "sp-badge complete"
                        : "sp-badge"
                    }
                  >
                    {form.issuance_status === "issued"
                      ? "Terbit"
                      : form.issuance_status === "processing"
                      ? "Diproses"
                      : "Belum Terbit"}
                  </span>
                </div>

                <SelectField
                  label="Status Penerbitan SIMPER"
                  value={form.issuance_status}
                  options={PENERBITAN_OPTIONS}
                  disabled={disabled}
                  onChange={(value) =>
                    change("issuance_status", value)
                  }
                />

                {form.issuance_status === "issued" && (
                  <>
                    <InputField
                      label="Tanggal SIMPER Terbit"
                      type="date"
                      value={form.graduation_date}
                      disabled={disabled}
                      onChange={(value) =>
                        change("graduation_date", value)
                      }
                    />

                    <InputField
                      label="Nomor SIMPER (Opsional)"
                      value={form.issuance_number}
                      disabled={disabled}
                      onChange={(value) =>
                        change("issuance_number", value)
                      }
                      placeholder="Masukkan nomor SIMPER"
                    />
                  </>
                )}

                <div className="sp-alert info">
                  Status SIMPER Terbit hanya dapat
                  disimpan jika KMKOP dan Praktik
                  sudah lulus serta Orientasi Area
                  selesai/tervalidasi. Status
                  penerbitan tidak mengubah progres.
                </div>
              </section>

              <section className="sp-card">
                <h2>Catatan Mentor</h2>

                <label className="sp-field">
                  <span>Catatan Penilaian SIMPER</span>
                  <textarea
                    rows={4}
                    value={form.notes}
                    disabled={disabled}
                    onChange={(e) =>
                      change("notes", e.target.value)
                    }
                    placeholder="Tuliskan hasil validasi, kendala, atau tindak lanjut..."
                  />
                </label>

                <div className="sp-alert info">
                  Status LULUS hanya diberikan jika
                  KMKOP lulus, Praktik lulus, dan
                  Orientasi Area selesai/tervalidasi.
                  Perubahan tersimpan setelah
                  tombol Simpan ditekan.
                </div>

                <div className="sp-actions">
                  <button
                    type="submit"
                    className="sp-button"
                    disabled={disabled}
                    style={{ flex: 1 }}
                  >
                    {saving
                      ? "Menyimpan..."
                      : recordId
                      ? "Simpan Perubahan"
                      : "Simpan Monitoring SIMPER"}
                  </button>

                  {recordId && (
                    <button
                      type="button"
                      className="sp-button danger"
                      disabled={disabled}
                      onClick={remove}
                    >
                      {deleting
                        ? "Menghapus..."
                        : "Hapus"}
                    </button>
                  )}
                </div>
              </section>
            </form>

            <section className="sp-card">
              <h2>Ringkasan Monitoring</h2>

              {[
                [
                  "KMKOP",
                  optionLabel(
                    KMKOP_OPTIONS,
                    form.theory_status
                  ),
                ],
                [
                  "Praktik",
                  optionLabel(
                    PRAKTIK_OPTIONS,
                    form.practice_status
                  ),
                ],
                [
                  "Orientasi Area",
                  optionLabel(
                    ORIENTASI_OPTIONS,
                    form.orientation_status
                  ),
                ],
                [
                  "Tanggal Orientasi",
                  formatDate(form.orientation_date),
                ],
                [
                  "Komponen Terpenuhi",
                  `${progress.completed} dari 3`,
                ],
                [
                  "Total Progres",
                  `${progress.percentage}%`,
                ],
                ["Status Akhir", finalStatus],
                ["Status Penerbitan", issuanceLabel],
                [
                  "Tanggal SIMPER Terbit",
                  form.issuance_status === "issued"
                    ? formatDate(form.graduation_date)
                    : "—",
                ],
                [
                  "Nomor SIMPER",
                  form.issuance_status === "issued"
                    ? form.issuance_number || "—"
                    : "—",
                ],
              ].map(([label, value]) => (
                <div className="sp-info" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}

              <p>
                {recordId
                  ? "Rekaman SIMPER sudah tersedia. Perubahan baru berlaku setelah disimpan."
                  : "Belum ada rekaman SIMPER. Isi penilaian kemudian tekan Simpan."}
              </p>
            </section>
          </>
        )}

        <footer className="sp-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}PT Berau Coal
        </footer>
      </div>

      <style>{`
        .sp-progress-statuses {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin: 15px 0;
        }

        .sp-progress-statuses > div {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 7px;
        }

        .sp-mini-label {
          font-size: 11px;
          font-weight: 800;
          color: #71887b;
        }
      `}</style>
    </main>
  );
}
