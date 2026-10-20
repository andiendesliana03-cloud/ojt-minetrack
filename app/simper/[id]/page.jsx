
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const card = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 16,
};

const field = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  fontSize: 16,
  marginTop: 8,
  marginBottom: 18,
  background: "#fff",
  color: "#0f172a",
};

const button = {
  border: "none",
  background: "#2563eb",
  color: "#fff",
  padding: "13px 18px",
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
};

const tahap = [
  ["administration_status", "Administrasi"],
  ["training_status", "Training"],
  ["theory_status", "Ujian Teori"],
  ["practice_status", "Ujian Praktik"],
];

const pilihanTahap = [
  ["pending", "Belum Proses"],
  ["in_progress", "Dalam Proses"],
  ["passed", "Lulus"],
  ["failed", "Tidak Lulus"],
];

const pilihanStatus = [
  ["not_started", "Belum Proses"],
  ["in_progress", "Dalam Proses"],
  ["passed", "Lulus SIMPER"],
  ["failed", "Tidak Lulus"],
];

const awal = {
  simper_type: "SIMPER",
  administration_status: "pending",
  training_status: "pending",
  theory_status: "pending",
  practice_status: "pending",
  status: "not_started",
  application_date: "",
  graduation_date: "",
  notes: "",
};

function tanggalIndo(value) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function namaStatus(value, options) {
  return (
    options.find(([key]) => key === value)?.[1] ||
    value ||
    "-"
  );
}

export default function MonitoringSimper() {
  const params = useParams();
  const router = useRouter();
  const programId = params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [form, setForm] = useState({ ...awal });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function ubah(nama, nilai) {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      [nama]: nilai,
    }));
  }

  async function muatData() {
    const { data, error: err } = await supabase
      .from("simper_records")
      .select("*")
      .eq("program_id", programId)
      .maybeSingle();

    if (err) throw err;

    if (data) {
      setRecordId(data.id);
      setForm({
        simper_type: data.simper_type || "SIMPER",
        administration_status:
          data.administration_status || "pending",
        training_status:
          data.training_status || "pending",
        theory_status:
          data.theory_status || "pending",
        practice_status:
          data.practice_status || "pending",
        status: data.status || "not_started",
        application_date: data.application_date || "",
        graduation_date: data.graduation_date || "",
        notes: data.notes || "",
      });
    } else {
      setRecordId(null);
      setForm({ ...awal });
    }
  }

  useEffect(() => {
    if (!programId) return;

    let aktif = true;

    async function mulai() {
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

        const { data: profil, error: profilError } =
          await supabase
            .from("profiles")
            .select("id,full_name,role")
            .eq("id", user.id)
            .single();

        if (profilError) throw profilError;

        if (profil?.role !== "mentor") {
          router.replace("/peserta");
          return;
        }

        const { data: dataProgram, error: programError } =
          await supabase
            .from("ojt_programs")
            .select("id,start_date,end_date,status")
            .eq("id", programId)
            .single();

        if (programError) throw programError;

        const { data: simper, error: simperError } =
          await supabase
            .from("simper_records")
            .select("*")
            .eq("program_id", programId)
            .maybeSingle();

        if (simperError) throw simperError;
        if (!aktif) return;

        setMentor(profil);
        setProgram(dataProgram);

        if (simper) {
          setRecordId(simper.id);
          setForm({
            simper_type: simper.simper_type || "SIMPER",
            administration_status:
              simper.administration_status || "pending",
            training_status:
              simper.training_status || "pending",
            theory_status:
              simper.theory_status || "pending",
            practice_status:
              simper.practice_status || "pending",
            status: simper.status || "not_started",
            application_date:
              simper.application_date || "",
            graduation_date:
              simper.graduation_date || "",
            notes: simper.notes || "",
          });
        }
      } catch (err) {
        if (aktif) {
          setError(err.message || "Gagal memuat data.");
        }
      } finally {
        if (aktif) setLoading(false);
      }
    }

    mulai();

    return () => {
      aktif = false;
    };
  }, [programId, router]);

  async function simpan(e) {
    e.preventDefault();

    if (!mentor || !program || saving) return;

    if (!form.simper_type.trim()) {
      setError("Jenis SIMPER wajib diisi.");
      return;
    }

    if (form.status === "passed" && !form.graduation_date) {
      setError(
        "Tanggal kelulusan wajib diisi jika status Lulus SIMPER."
      );
      return;
    }

    if (
      form.application_date &&
      form.graduation_date &&
      form.graduation_date < form.application_date
    ) {
      setError(
        "Tanggal kelulusan tidak boleh sebelum tanggal pengajuan."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        simper_type: form.simper_type.trim(),
        administration_status:
          form.administration_status,
        training_status: form.training_status,
        theory_status: form.theory_status,
        practice_status: form.practice_status,
        status: form.status,
        application_date:
          form.application_date || null,
        graduation_date:
          form.graduation_date || null,
        notes: form.notes.trim() || null,
      };

      let query;

      if (recordId) {
        query = await supabase
          .from("simper_records")
          .update(payload)
          .eq("id", recordId)
          .eq("program_id", programId)
          .select("id");
      } else {
        query = await supabase
          .from("simper_records")
          .insert({
            ...payload,
            program_id: programId,
            created_by: mentor.id,
          })
          .select("id");
      }

      if (query.error) throw query.error;

      if (!query.data?.length) {
        throw new Error("Data SIMPER tidak tersimpan.");
      }

      await muatData();
      setSuccess("Data Monitoring SIMPER berhasil disimpan.");
    } catch (err) {
      setError(err.message || "Gagal menyimpan SIMPER.");
    } finally {
      setSaving(false);
    }
  }

  async function hapus() {
    if (!recordId || deleting) return;

    if (
      !window.confirm(
        "Hapus seluruh data Monitoring SIMPER peserta ini?"
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: err } = await supabase
        .from("simper_records")
        .delete()
        .eq("id", recordId)
        .eq("program_id", programId)
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error("Data SIMPER tidak terhapus.");
      }

      await muatData();
      setSuccess("Data SIMPER berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus SIMPER.");
    } finally {
      setDeleting(false);
    }
  }

  const totalLulus = tahap.filter(
    ([key]) => form[key] === "passed"
  ).length;

  const persentase = Math.round(
    (totalLulus / tahap.length) * 100
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f1f5f9",
        backgroundImage:
          'linear-gradient(rgba(241,245,249,0.85),rgba(241,245,249,0.94)),url("/background-erg.png.PNG")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        padding: 18,
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        <header
          style={{
            background: "#0f172a",
            color: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 18,
          }}
        >
          <h1>Monitoring SIMPER</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
          <small>Monitoring OJT — Dashboard Mentor</small>
        </header>

        <button
          type="button"
          onClick={() =>
            router.push(`/peserta/${programId}`)
          }
          style={{
            ...button,
            background: "#475569",
            marginBottom: 18,
          }}
        >
          ← Kembali ke Detail Peserta
        </button>

        {loading ? (
          <section style={card}>
            Memuat data Monitoring SIMPER...
          </section>
        ) : !mentor || !program ? (
          <section style={card}>
            <h2>Data Tidak Dapat Ditampilkan</h2>
            <p style={{ color: "#dc2626" }}>
              {error || "Akses tidak tersedia."}
            </p>
          </section>
        ) : (
          <>
            <section style={card}>
              <h2>Informasi Monitoring</h2>
              <p>
                Mentor: <strong>{mentor.full_name}</strong>
              </p>
              <p>
                Periode OJT:{" "}
                {tanggalIndo(program.start_date)} –{" "}
                {tanggalIndo(program.end_date)}
              </p>
            </section>

            <section style={card}>
              <h2>Ringkasan SIMPER</h2>
              <p>
                Status:{" "}
                <strong>
                  {namaStatus(
                    form.status,
                    pilihanStatus
                  )}
                </strong>
              </p>
              <p>
                Tahapan Lulus: {totalLulus} dari{" "}
                {tahap.length}
              </p>

              <div
                style={{
                  background: "#e2e8f0",
                  height: 14,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "#16a34a",
                    width: `${persentase}%`,
                    height: "100%",
                    transition: "width 0.2s",
                  }}
                />
              </div>

              <p>{persentase}% tahapan selesai</p>
            </section>

            {error && (
              <section style={card}>
                <p
                  role="alert"
                  style={{ color: "#dc2626" }}
                >
                  {error}
                </p>
              </section>
            )}

            {success && (
              <section style={card}>
                <p style={{ color: "#15803d" }}>
                  {success}
                </p>
              </section>
            )}

            <section style={card}>
              <h2>
                {recordId
                  ? "Edit Monitoring SIMPER"
                  : "Input Monitoring SIMPER"}
              </h2>

              <form onSubmit={simpan}>
                <label>
                  Jenis SIMPER
                  <input
                    type="text"
                    value={form.simper_type}
                    onChange={(e) =>
                      ubah(
                        "simper_type",
                        e.target.value
                      )
                    }
                    placeholder="Contoh: SIMPER LV"
                    required
                    style={field}
                  />
                </label>

                <label>
                  Tanggal Pengajuan
                  <input
                    type="date"
                    value={form.application_date}
                    onChange={(e) =>
                      ubah(
                        "application_date",
                        e.target.value
                      )
                    }
                    style={field}
                  />
                </label>

                <h3>Tahapan Proses SIMPER</h3>

                {tahap.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <select
                      value={form[key]}
                      onChange={(e) =>
                        ubah(key, e.target.value)
                      }
                      style={field}
                    >
                      {pilihanTahap.map(
                        ([value, nama]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {nama}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                ))}

                <label>
                  Status Akhir SIMPER
                  <select
                    value={form.status}
                    onChange={(e) =>
                      ubah("status", e.target.value)
                    }
                    style={field}
                  >
                    {pilihanStatus.map(
                      ([value, nama]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {nama}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Tanggal Kelulusan
                  <input
                    type="date"
                    value={form.graduation_date}
                    onChange={(e) =>
                      ubah(
                        "graduation_date",
                        e.target.value
                      )
                    }
                    style={field}
                  />
                </label>

                <label>
                  Catatan Mentor
                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(e) =>
                      ubah("notes", e.target.value)
                    }
                    placeholder="Catatan proses SIMPER..."
                    style={field}
                  />
                </label>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    style={button}
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
                      disabled={saving || deleting}
                      onClick={hapus}
                      style={{
                        ...button,
                        background: "#dc2626",
                      }}
                    >
                      {deleting
                        ? "Menghapus..."
                        : "Hapus Data SIMPER"}
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section style={card}>
              <h2>Ringkasan Tahapan</h2>

              {tahap.map(([key, label]) => (
                <div
                  key={key}
                  style={{
                    borderBottom:
                      "1px solid #e2e8f0",
                    padding: "12px 0",
                  }}
                >
                  <strong>{label}</strong>
                  <p>
                    {namaStatus(
                      form[key],
                      pilihanTahap
                    )}
                  </p>
                </div>
              ))}

              <p>
                <strong>Status Akhir:</strong>{" "}
                {namaStatus(
                  form.status,
                  pilihanStatus
                )}
              </p>
              <p>
                <strong>Tanggal Lulus:</strong>{" "}
                {tanggalIndo(
                  form.graduation_date
                )}
              </p>
              <p>
                <strong>Catatan:</strong>{" "}
                {form.notes || "-"}
              </p>
              {!recordId && (
                <p style={{ color: "#64748b" }}>
                  Data belum tersimpan. Ringkasan
                  ini mengikuti isian formulir.
                </p>
              )}
            </section>
          </>
        )}

        <footer
          style={{
            textAlign: "center",
            padding: 24,
            color: "#475569",
          }}
        >
          Monitoring OJT — Emergency Response Group
          <p>© 2026 PT Berau Coal</p>
        </footer>
      </div>
    </main>
  );
}
