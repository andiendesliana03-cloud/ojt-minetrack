
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// OJT MineTrack v2.0
// SIMPER Premium — 4 tahap monitoring
// Tanpa perubahan struktur database Supabase.

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

const VALIDATION = [
  ["pending", "Belum Proses"],
  ["in_progress", "Dalam Proses"],
  ["passed", "Valid"],
  ["failed", "Perlu Perbaikan"],
];

const EXAM = [
  ["pending", "Belum Ujian"],
  ["in_progress", "Dijadwalkan / Proses"],
  ["passed", "Lulus"],
  ["failed", "Tidak Lulus"],
];

const APPLICATION = [
  ["not_started", "Belum Diajukan"],
  ["submitted", "Diajukan"],
  ["processing", "Diproses"],
  ["approved", "Disetujui"],
  ["returned", "Dikembalikan"],
];

const ORIENTATION = [
  ["not_started", "Belum Dilaksanakan"],
  ["scheduled", "Dijadwalkan"],
  ["completed", "Selesai"],
];

const ISSUANCE = [
  ["not_issued", "Belum Terbit"],
  ["processing", "Dalam Proses"],
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
    notes: "",
    application_status: "not_started",
    orientation_status: "not_started",
    issuance_status: "not_issued",
    orientation_date: "",
    issuance_number: "",
  };
}

function label(value, options) {
  return (
    options.find(([key]) => key === value)?.[1] ||
    value ||
    "—"
  );
}

function dateText(value) {
  if (!value) return "—";
  const text = String(value).slice(0, 10);
  return text.split("-").reverse().join("/");
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

// Detail penerbitan disimpan pada kolom notes.
// Catatan mentor tetap dipisahkan dari metadata.

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
      throw new Error("Format metadata tidak cocok.");
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
    // Metadata tidak dikenali: isi asli tetap dipertahankan.
    return {
      notes: raw,
      meta: null,
    };
  }
}

function buildNotes(form) {
  const metadata = {
    version: 2,
    application_status: form.application_status,
    orientation_status: form.orientation_status,
    issuance_status: form.issuance_status,
    orientation_date: form.orientation_date || "",
    issuance_number: form.issuance_number.trim(),
  };

  const human = form.notes.trim();

  return (
    (human ? human + "\n\n" : "") +
    META_START +
    JSON.stringify(metadata) +
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
    notes: parsed.notes,
    application_status:
      parsed.meta?.application_status || "not_started",
    orientation_status:
      parsed.meta?.orientation_status || "not_started",
    issuance_status:
      parsed.meta?.issuance_status || "not_issued",
    orientation_date:
      parsed.meta?.orientation_date || "",
    issuance_number:
      parsed.meta?.issuance_number || "",
  };
}

function calculateProgress(form) {
  const validation =
    form.administration_status === "passed";

  const theory =
    form.theory_status === "passed";

  const practice =
    form.practice_status === "passed";

  const application =
    form.application_status === "approved";

  const orientation =
    form.orientation_status === "completed";

  const issued =
    form.issuance_status === "issued" &&
    Boolean(form.graduation_date);

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
    form.theory_status === "failed" ||
    form.practice_status === "failed"
  ) {
    status = "failed";
  } else if (
    Object.values(form).some(
      (value) =>
        value === "passed" ||
        value === "in_progress" ||
        value === "submitted" ||
        value === "processing" ||
        value === "approved" ||
        value === "returned" ||
        value === "scheduled" ||
        value === "completed" ||
        value === "issued"
    ) ||
    form.application_date
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

function Icon({ name, size = 20 }) {
  const shapes = {
    back: (
      <path d="M15 18l-6-6 6-6M9 12h12" />
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    check: <path d="M4 12l5 5L20 6" />,
    file: (
      <>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M14 3v5h5M9 13h7M9 17h5" />
      </>
    ),
    book: (
      <>
        <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1" />
        <path d="M12 5c3-2 6-2 9-1v15c-3-1-6-1-9 1M12 5v15" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 4v3h-7" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 10h5M7 14h4M16 11h2" />
      </>
    ),
    save: (
      <>
        <path d="M5 3h12l4 4v14H3V3z" />
        <path d="M7 3v6h9V3M7 21v-8h10v8" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 4h6M6 7l1 14h10l1-14" />
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
      {shapes[name] || shapes.check}
    </svg>
  );
}

function SelectField({
  title,
  value,
  options,
  change,
  disabled,
}) {
  return (
    <label className="sim-field-wrap">
      <span className="sim-label">{title}</span>
      <select
        className="sim-field"
        value={value}
        disabled={disabled}
        onChange={(e) => change(e.target.value)}
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

function TextField({
  title,
  value,
  change,
  type = "text",
  placeholder = "",
  disabled,
}) {
  return (
    <label className="sim-field-wrap">
      <span className="sim-label">{title}</span>
      <input
        className="sim-field"
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
}

function Stage({
  number,
  title,
  subtitle,
  icon,
  done,
  children,
}) {
  return (
    <section className="sim-card">
      <div className="sim-stage-head">
        <div className="sim-stage-icon">
          <Icon name={icon} size={21} />
        </div>

        <div className="sim-stage-text">
          <div className="sim-small">
            TAHAP {number} · BOBOT 25%
          </div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        <span className={
          done ? "sim-pill done" : "sim-pill"
        }>
          {done ? "Selesai" : "Belum Selesai"}
        </span>
      </div>

      {children}
    </section>
  );
}

export default function MonitoringSimper() {
  const params = useParams();
  const router = useRouter();

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
  const [legacyWarning, setLegacyWarning] = useState(false);

  const progress = useMemo(
    () => calculateProgress(form),
    [form]
  );

  function ubah(name, value) {
    setForm((old) => ({
      ...old,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function getRecord(id) {
    const { data, error: err } = await supabase
      .from("simper_records")
      .select("*")
      .eq("program_id", id)
      .maybeSingle();

    if (err) throw err;

    return data;
  }

  function applyRecord(data) {
    setRecordId(data?.id || null);
    setForm(fromRecord(data));

    const parsed = parseNotes(data?.notes);
    setLegacyWarning(
      Boolean(data) &&
      !parsed.meta &&
      data.status === "passed"
    );
  }

  async function reload() {
    const result = await getRecord(programId);
    applyRecord(result);
  }

  useEffect(() => {
    if (!programId) return;

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setSuccess("");
      setMentor(null);
      setProgram(null);
      setRecordId(null);
      setForm(blank());
      setLegacyWarning(false);

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

        const simperData = await getRecord(programId);

        if (!active) return;

        setMentor(profile);
        setProgram(programData);
        applyRecord(simperData);
      } catch (err) {
        if (active) {
          setError(
            err.message || "Gagal memuat Monitoring SIMPER."
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

  async function simpan(event) {
    event.preventDefault();

    if (
      saving ||
      deleting ||
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
      form.application_status !== "not_started" &&
      !form.application_date
    ) {
      setError(
        "Tanggal pengajuan wajib diisi apabila " +
        "proses pengajuan sudah dimulai."
      );
      return;
    }

    if (
      form.orientation_status === "completed" &&
      !form.orientation_date
    ) {
      setError(
        "Tanggal orientasi wajib diisi " +
        "jika orientasi sudah selesai."
      );
      return;
    }

    if (
      form.issuance_status === "issued" &&
      !form.graduation_date
    ) {
      setError(
        "Tanggal terbit SIMPER wajib diisi " +
        "apabila status SIMPER Terbit."
      );
      return;
    }

    if (
      form.application_date &&
      form.graduation_date &&
      form.graduation_date < form.application_date
    ) {
      setError(
        "Tanggal terbit tidak boleh lebih awal " +
        "daripada tanggal pengajuan."
      );
      return;
    }

    if (
      form.orientation_date &&
      form.graduation_date &&
      form.graduation_date < form.orientation_date
    ) {
      setError(
        "Tanggal terbit tidak boleh lebih awal " +
        "daripada tanggal orientasi."
      );
      return;
    }

    if (
      form.issuance_status === "issued" &&
      !progress.release
    ) {
      setError(
        "SIMPER hanya dapat ditandai terbit jika " +
        "validasi selesai, ujian teori dan praktik lulus, " +
        "pengajuan disetujui, orientasi selesai, " +
        "dan tanggal terbit sudah diisi."
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
        .select("id,status")
        .eq("id", programId)
        .eq("status", "active")
        .maybeSingle();

      if (activeError) throw activeError;

      if (!activeProgram) {
        throw new Error(
          "Program OJT tidak aktif. Data tidak disimpan."
        );
      }

      const payload = {
        simper_type: form.simper_type.trim(),

        // Tahap 1
        administration_status:
          form.administration_status,

        // Kolom lama dipertahankan agar data training
        // dari sistem sebelumnya tidak hilang.
        training_status:
          form.training_status,

        // Tahap 2 dan 3
        theory_status:
          form.theory_status,
        practice_status:
          form.practice_status,

        // Status akhir dihitung, bukan dipilih manual.
        status: progress.status,

        application_date:
          form.application_date || null,

        // Kolom lama graduation_date
        // kini digunakan sebagai tanggal terbit.
        graduation_date:
          form.graduation_date || null,

        notes: buildNotes(form),
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
        throw new Error("Data SIMPER tidak tersimpan.");
      }

      await reload();

      setSuccess(
        "Monitoring SIMPER berhasil disimpan. " +
        "Progres dan status telah diperbarui."
      );
    } catch (err) {
      setError(
        err.message || "Gagal menyimpan Monitoring SIMPER."
      );
    } finally {
      setSaving(false);
    }
  }

  async function hapus() {
    if (
      !recordId ||
      deleting ||
      saving ||
      !program ||
      program.id !== programId
    ) {
      return;
    }

    const name =
      program.peserta?.full_name || "peserta ini";

    if (
      !window.confirm(
        `Hapus seluruh Monitoring SIMPER ${name}? ` +
        "Tindakan ini tidak dapat dibatalkan."
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: deleteError } = await supabase
        .from("simper_records")
        .delete()
        .eq("id", recordId)
        .eq("program_id", programId)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data?.length) {
        throw new Error("Data SIMPER tidak terhapus.");
      }

      await reload();
      setSuccess("Data SIMPER berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus data.");
    } finally {
      setDeleting(false);
    }
  }

  const name =
    program?.peserta?.full_name || "Peserta OJT";

  const statusName =
    progress.status === "passed"
      ? "SIMPER TERBIT"
      : progress.status === "failed"
      ? "PERLU TINDAK LANJUT"
      : progress.status === "in_progress"
      ? "DALAM PROSES"
      : "BELUM PROSES";

  const disabled =
    saving ||
    deleting ||
    program?.status !== "active";

  return (
    <main className="sim-root">
      <style>{`
        * { box-sizing: border-box; }

        .sim-root {
          min-height: 100vh;
          font-family: Arial, Helvetica, sans-serif;
          color: #173a2d;
          background: #f2f6f7;
        }

        .sim-top {
          background: #09212a;
          color: white;
          padding: 14px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .sim-brand {
          font-size: 21px;
          font-weight: 900;
        }

        .sim-brand span { color: #31c795; }

        .sim-back {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border: 1px solid #ffffff35;
          border-radius: 10px;
          color: #fff;
          background: #ffffff16;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .sim-container {
          max-width: 1060px;
          margin: auto;
          padding: 20px;
        }

        .sim-hero {
          background:
            linear-gradient(
              90deg,
              rgba(6, 29, 35, .98),
              rgba(7, 43, 40, .85),
              rgba(10, 41, 35, .3)
            ),
            url("/background-erg.png.PNG");
          background-position: center;
          background-size: cover;
          border-radius: 18px;
          padding: 30px;
          color: white;
          margin-bottom: 15px;
        }

        .sim-kicker {
          font-size: 10px;
          color: #e8c57d;
          letter-spacing: 1.4px;
          font-weight: 800;
        }

        .sim-hero h1 {
          font-size: 29px;
          margin: 12px 0 8px;
        }

        .sim-hero p {
          font-size: 13px;
          color: #d3e7df;
          margin: 0;
        }

        .sim-card {
          background: white;
          border: 1px solid #e1ebe5;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 15px;
          box-shadow: 0 4px 18px #113e2409;
          min-width: 0;
        }

        .sim-card h2 {
          font-size: 17px;
          margin: 0 0 7px;
          color: #153f30;
        }

        .sim-card p {
          font-size: 12px;
          color: #758b7e;
          line-height: 1.6;
        }

        .sim-identity {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px;
          background: #f4fbf6;
          border: 1px solid #dcefe4;
          border-radius: 12px;
        }

        .sim-avatar {
          width: 51px;
          height: 51px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          background: #d9f5e6;
          color: #087f55;
          font-size: 17px;
          font-weight: 900;
          border-radius: 13px;
        }

        .sim-name {
          font-size: 16px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .sim-meta {
          color: #758e80;
          font-size: 11px;
          line-height: 1.7;
          margin-top: 5px;
        }

        .sim-lock {
          display: flex;
          align-items: center;
          gap: 9px;
          background: #eefaf2;
          border: 1px solid #d2ebdb;
          border-radius: 10px;
          margin-top: 12px;
          padding: 12px;
          color: #128054;
          font-size: 12px;
        }

        .sim-progress-number {
          font-size: 35px;
          color: #087950;
          font-weight: 900;
        }

        .sim-progress-track {
          width: 100%;
          height: 13px;
          background: #e4ede7;
          border-radius: 20px;
          overflow: hidden;
          margin-top: 12px;
        }

        .sim-progress-fill {
          height: 100%;
          background: linear-gradient(
            90deg, #0c9566, #47c89a
          );
          border-radius: 20px;
          transition: width .2s ease;
        }

        .sim-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 9px;
          margin-top: 15px;
        }

        .sim-stat {
          background: #f6faf7;
          border: 1px solid #e7efe9;
          padding: 12px 8px;
          border-radius: 11px;
          text-align: center;
        }

        .sim-stat strong {
          display: block;
          font-size: 17px;
          color: #127e56;
          margin-bottom: 5px;
        }

        .sim-stat span {
          color: #70877a;
          font-size: 10px;
          line-height: 1.5;
        }

        .sim-stage-head {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 18px;
        }

        .sim-stage-icon {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          color: #11845d;
          background: #e3f7eb;
          border-radius: 11px;
        }

        .sim-stage-text {
          flex: 1;
          min-width: 0;
        }

        .sim-stage-text h2 {
          margin: 5px 0;
        }

        .sim-stage-text p {
          margin: 0;
        }

        .sim-small {
          color: #86a092;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .5px;
        }

        .sim-pill {
          display: inline-block;
          background: #eef2f0;
          color: #687e72;
          border-radius: 20px;
          padding: 7px 9px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .sim-pill.done {
          background: #d9f6e5;
          color: #087d50;
        }

        .sim-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 13px;
        }

        .sim-field-wrap {
          display: block;
          margin-bottom: 13px;
          min-width: 0;
        }

        .sim-label {
          display: block;
          font-size: 12px;
          color: #365747;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .sim-field {
          display: block;
          width: 100%;
          padding: 12px 13px;
          border: 1px solid #d6e5db;
          border-radius: 10px;
          background: white;
          color: #173b2c;
          font-size: 16px;
          font-family: inherit;
          outline-color: #3fbb88;
        }

        .sim-field:disabled {
          background: #eef2ef;
          color: #64748b;
        }

        .sim-sub {
          padding: 14px;
          background: #f8faf8;
          border: 1px solid #e6eee9;
          border-radius: 12px;
          margin-bottom: 12px;
        }

        .sim-sub-title {
          font-weight: 900;
          color: #204a37;
          font-size: 13px;
          margin-bottom: 13px;
        }

        .sim-summary-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 0;
          border-bottom: 1px solid #e7eee8;
          font-size: 12px;
        }

        .sim-summary-row strong {
          text-align: right;
          color: #0a7d53;
        }

        .sim-btn {
          border: none;
          border-radius: 11px;
          background: #0f9564;
          color: #fff;
          padding: 13px 17px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }

        .sim-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .sim-btn.danger {
          background: #d34249;
        }

        .sim-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }

        .sim-alert {
          padding: 14px;
          border-radius: 11px;
          margin-bottom: 15px;
          font-size: 12px;
          line-height: 1.7;
        }

        .sim-alert.error {
          color: #b91c1c;
          background: #fff0f1;
          border: 1px solid #fecdd3;
        }

        .sim-alert.success {
          color: #0a7b51;
          background: #ebfaf0;
          border: 1px solid #c0ead0;
        }

        .sim-alert.warning {
          color: #855700;
          background: #fff8e5;
          border: 1px solid #f4dda0;
        }

        .sim-footer {
          font-size: 11px;
          color: #889b90;
          padding: 20px;
          text-align: center;
        }

        @media(max-width: 700px) {
          .sim-top {
            padding: 13px 15px;
          }

          .sim-brand { font-size: 18px; }

          .sim-back {
            font-size: 0;
            padding: 9px;
          }

          .sim-back svg {
            height: 20px;
            width: 20px;
          }

          .sim-container { padding: 12px; }

          .sim-hero {
            border-radius: 14px;
            padding: 24px 17px;
          }

          .sim-hero h1 {
            font-size: 23px;
          }

          .sim-card {
            padding: 15px;
            border-radius: 14px;
          }

          .sim-identity {
            padding: 12px;
          }

          .sim-name { font-size: 14px; }

          .sim-avatar {
            width: 45px;
            height: 45px;
          }

          .sim-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .sim-stage-head {
            flex-wrap: wrap;
          }

          .sim-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      <header className="sim-top">
        <div className="sim-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="sim-back"
          onClick={() =>
            router.push(
              programId ? `/peserta/${programId}` : "/"
            )
          }
          aria-label="Kembali ke Detail Peserta"
        >
          <Icon name="back" size={18} />
          Detail Peserta
        </button>
      </header>

      <div className="sim-container">
        <section className="sim-hero">
          <div className="sim-kicker">
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </div>
          <h1>Monitoring SIMPER</h1>
          <p>
            Monitoring Persyaratan, Ujian,
            dan Penerbitan SIMPER
          </p>
        </section>

        {loading ? (
          <section className="sim-card">
            <h2>Memuat Data SIMPER...</h2>
            <p>
              Mengambil identitas peserta
              dan status tahapan.
            </p>
          </section>
        ) : !mentor || !program ? (
          <section className="sim-card">
            <h2>Data Tidak Dapat Ditampilkan</h2>
            <div className="sim-alert error">
              {error || "Akses tidak tersedia."}
            </div>
            <button
              type="button"
              className="sim-btn"
              onClick={() => router.push("/")}
            >
              Kembali ke Dashboard
            </button>
          </section>
        ) : (
          <>
            <section className="sim-card">
              <div className="sim-identity">
                <div className="sim-avatar">
                  {initials(name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sim-name">
                    {name}
                  </div>
                  <div className="sim-meta">
                    {program.peserta?.department || "—"}
                    {" · "}
                    {program.site || "—"}
                    <br />
                    {dateText(program.start_date)}
                    {" – "}
                    {dateText(program.end_date)}
                  </div>
                </div>

                <span className={
                  program.status === "active"
                    ? "sim-pill done"
                    : "sim-pill"
                }>
                  {program.status === "active"
                    ? "Aktif"
                    : "Tidak Aktif"}
                </span>
              </div>

              <div className="sim-lock">
                <Icon name="lock" size={17} />
                <span>
                  Identitas peserta otomatis dan terkunci.
                  Data SIMPER hanya untuk{" "}
                  <strong>{name}</strong>.
                </span>
              </div>
            </section>

            {error && (
              <div className="sim-alert error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="sim-alert success" role="status">
                {success}
              </div>
            )}

            {legacyWarning && (
              <div className="sim-alert warning">
                Data SIMPER lama memiliki status lulus,
                tetapi rincian Pengajuan, Orientasi,
                dan Terbit belum tersedia.
                Mohon periksa dan lengkapi tahapan
                sebelum menetapkan progres 100%.
              </div>
            )}

            <section className="sim-card">
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                alignItems: "center",
              }}>
                <div>
                  <h2>Progres Monitoring SIMPER</h2>
                  <p style={{ margin: 0 }}>
                    {progress.completed} dari 4
                    tahapan selesai
                  </p>
                </div>

                <div className="sim-progress-number">
                  {progress.percentage}%
                </div>
              </div>

              <div className="sim-progress-track">
                <div
                  className="sim-progress-fill"
                  style={{
                    width: `${progress.percentage}%`,
                  }}
                />
              </div>

              <div className="sim-stats">
                {[
                  ["01", "Validasi", progress.validation],
                  ["02", "Teori", progress.theory],
                  ["03", "Praktek", progress.practice],
                  ["04", "Terbit", progress.release],
                ].map(([no, text, done]) => (
                  <div className="sim-stat" key={no}>
                    <strong>
                      {done ? "✓" : no}
                    </strong>
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 15,
                fontSize: 12,
                color: "#5c7666",
              }}>
                Status:{" "}
                <strong style={{ color: "#087a52" }}>
                  {statusName}
                </strong>
              </div>

              <p>
                Progres mengikuti isian yang sedang
                ditampilkan. Perubahan permanen
                setelah tombol Simpan ditekan.
              </p>
            </section>

            <form onSubmit={simpan}>
              <section className="sim-card">
                <h2>Informasi SIMPER</h2>

                <TextField
                  title="Jenis SIMPER"
                  value={form.simper_type}
                  change={(value) =>
                    ubah("simper_type", value)
                  }
                  placeholder="Contoh: SIMPER LV"
                  disabled={disabled}
                />
              </section>

              <Stage
                number="01"
                title="Validasi Persyaratan SIMPER"
                subtitle="Pemeriksaan persyaratan dan kelengkapan dokumen."
                icon="file"
                done={progress.validation}
              >
                <SelectField
                  title="Status Validasi"
                  value={form.administration_status}
                  options={VALIDATION}
                  disabled={disabled}
                  change={(value) =>
                    ubah("administration_status", value)
                  }
                />
              </Stage>

              <Stage
                number="02"
                title="Ujian Teori"
                subtitle="Monitoring pelaksanaan dan hasil ujian teori."
                icon="book"
                done={progress.theory}
              >
                <SelectField
                  title="Status Ujian Teori"
                  value={form.theory_status}
                  options={EXAM}
                  disabled={disabled}
                  change={(value) =>
                    ubah("theory_status", value)
                  }
                />
              </Stage>

              <Stage
                number="03"
                title="Ujian Praktek"
                subtitle="Monitoring hasil ujian kemampuan praktek."
                icon="truck"
                done={progress.practice}
              >
                <SelectField
                  title="Status Ujian Praktek"
                  value={form.practice_status}
                  options={EXAM}
                  disabled={disabled}
                  change={(value) =>
                    ubah("practice_status", value)
                  }
                />
              </Stage>

              <Stage
                number="04"
                title="Penerbitan SIMPER"
                subtitle="Tahapan Pengajuan, Orientasi, dan SIMPER Rilis/Terbit."
                icon="card"
                done={progress.release}
              >
                <div className="sim-sub">
                  <div className="sim-sub-title">
                    4A. Pengajuan SIMPER
                  </div>

                  <SelectField
                    title="Status Pengajuan"
                    value={form.application_status}
                    options={APPLICATION}
                    disabled={disabled}
                    change={(value) =>
                      ubah("application_status", value)
                    }
                  />

                  <TextField
                    title="Tanggal Pengajuan"
                    type="date"
                    value={form.application_date}
                    disabled={disabled}
                    change={(value) =>
                      ubah("application_date", value)
                    }
                  />
                </div>

                <div className="sim-sub">
                  <div className="sim-sub-title">
                    4B. Orientasi
                  </div>

                  <SelectField
                    title="Status Orientasi"
                    value={form.orientation_status}
                    options={ORIENTATION}
                    disabled={disabled}
                    change={(value) =>
                      ubah("orientation_status", value)
                    }
                  />

                  <TextField
                    title="Tanggal Orientasi"
                    type="date"
                    value={form.orientation_date}
                    disabled={disabled}
                    change={(value) =>
                      ubah("orientation_date", value)
                    }
                  />
                </div>

                <div className="sim-sub">
                  <div className="sim-sub-title">
                    4C. SIMPER Rilis / Terbit
                  </div>

                  <SelectField
                    title="Status Penerbitan"
                    value={form.issuance_status}
                    options={ISSUANCE}
                    disabled={disabled}
                    change={(value) =>
                      ubah("issuance_status", value)
                    }
                  />

                  <TextField
                    title="Tanggal SIMPER Terbit"
                    type="date"
                    value={form.graduation_date}
                    disabled={disabled}
                    change={(value) =>
                      ubah("graduation_date", value)
                    }
                  />

                  <TextField
                    title="Nomor SIMPER (Opsional)"
                    value={form.issuance_number}
                    disabled={disabled}
                    change={(value) =>
                      ubah("issuance_number", value)
                    }
                    placeholder="Isi sesuai SIMPER yang diterbitkan"
                  />
                </div>

                <div className="sim-alert warning"
                  style={{ marginBottom: 0 }}
                >
                  Tahap penerbitan baru memperoleh
                  25% jika Pengajuan Disetujui,
                  Orientasi Selesai, dan SIMPER Terbit.
                  Seluruh tahapan sebelumnya juga
                  harus sudah selesai.
                </div>
              </Stage>

              <section className="sim-card">
                <h2>Catatan Mentor</h2>

                <label className="sim-field-wrap">
                  <span className="sim-label">
                    Catatan Proses SIMPER
                  </span>

                  <textarea
                    className="sim-field"
                    rows={4}
                    value={form.notes}
                    disabled={disabled}
                    onChange={(e) =>
                      ubah("notes", e.target.value)
                    }
                    placeholder={
                      "Tuliskan kendala, tindak lanjut, " +
                      "atau hasil koordinasi..."
                    }
                    style={{ resize: "vertical" }}
                  />
                </label>

                <div className="sim-actions">
                  <button
                    type="submit"
                    className="sim-btn"
                    disabled={disabled}
                    style={{ flex: 1 }}
                  >
                    <Icon name="save" size={17} />
                    {saving
                      ? "Menyimpan..."
                      : recordId
                      ? "Simpan Perubahan"
                      : "Simpan Monitoring SIMPER"}
                  </button>

                  {recordId && (
                    <button
                      type="button"
                      className="sim-btn danger"
                      disabled={disabled}
                      onClick={hapus}
                    >
                      <Icon name="trash" size={17} />
                      {deleting ? "Menghapus..." : "Hapus"}
                    </button>
                  )}
                </div>
              </section>
            </form>

            <section className="sim-card">
              <h2>Ringkasan Monitoring</h2>

              {[
                [
                  "Validasi Persyaratan",
                  label(
                    form.administration_status,
                    VALIDATION
                  ),
                ],
                [
                  "Ujian Teori",
                  label(form.theory_status, EXAM),
                ],
                [
                  "Ujian Praktek",
                  label(form.practice_status, EXAM),
                ],
                [
                  "Pengajuan",
                  label(
                    form.application_status,
                    APPLICATION
                  ),
                ],
                [
                  "Orientasi",
                  label(
                    form.orientation_status,
                    ORIENTATION
                  ),
                ],
                [
                  "SIMPER Terbit",
                  label(
                    form.issuance_status,
                    ISSUANCE
                  ),
                ],
                [
                  "Tanggal Pengajuan",
                  dateText(form.application_date),
                ],
                [
                  "Tanggal Orientasi",
                  dateText(form.orientation_date),
                ],
                [
                  "Tanggal Terbit",
                  dateText(form.graduation_date),
                ],
                [
                  "Nomor SIMPER",
                  form.issuance_number || "—",
                ],
                ["Status Akhir", statusName],
                [
                  "Total Progres",
                  `${progress.percentage}%`,
                ],
              ].map(([text, value]) => (
                <div
                  className="sim-summary-row"
                  key={text}
                >
                  <span>{text}</span>
                  <strong>{value}</strong>
                </div>
              ))}

              <p>
                {recordId
                  ? "Data Monitoring SIMPER telah memiliki " +
                    "rekaman tersimpan. Perubahan yang belum " +
                    "disimpan hanya muncul di formulir."
                  : "Belum terdapat rekaman SIMPER. " +
                    "Isi tahapan kemudian tekan Simpan."}
              </p>
            </section>
          </>
        )}

        <footer className="sim-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
