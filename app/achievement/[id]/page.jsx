
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const WEEKS = 25;

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function weekOf(dateValue, startValue) {
  if (!dateValue || !startValue) return null;

  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00Z`);
  const start = new Date(`${String(startValue).slice(0, 10)}T00:00:00Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(start.getTime())
  ) return null;

  const week = Math.floor(
    (date.getTime() - start.getTime()) / 604800000
  ) + 1;

  return week >= 1 && week <= WEEKS ? week : null;
}

function dateText(value) {
  return value
    ? String(value).slice(0, 10).split("-").reverse().join("/")
    : "—";
}

function kmText(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function AchievementPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [manager, setManager] = useState(null);
  const [program, setProgram] = useState(null);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [typeCode, setTypeCode] = useState("");
  const [activityDate, setActivityDate] = useState(today());
  const [description, setDescription] = useState("");
  const [kilometer, setKilometer] = useState("0");
  const [meter, setMeter] = useState("0");
  const [editId, setEditId] = useState(null);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("Fisik");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const role = String(manager?.role || "").toLowerCase();
  const canManage = role === "admin" || role === "mentor";

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const selectedType = types.find((t) => t.code === typeCode);
  const isFisik = normalize(selectedType?.name) === "fisik";

  const km = Number(kilometer);
  const m = Number(meter);

  const validDistance =
    kilometer !== "" &&
    meter !== "" &&
    Number.isInteger(km) &&
    Number.isInteger(m) &&
    km >= 0 &&
    km <= 100 &&
    m >= 0 &&
    m <= 999 &&
    km * 1000 + m > 0;

  const distance = validDistance
    ? (km * 1000 + m) / 1000
    : null;

  const currentWeek = weekOf(activityDate, program?.start_date);

  async function reloadRecords() {
    const { data, error: err } = await supabase
      .from("achievement_records")
      .select(
        "id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
      )
      .eq("program_id", programId)
      .order("activity_date", { ascending: false });

    if (err) throw err;
    setRecords(data || []);
  }

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak tersedia.");
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth?.user) {
          router.replace("/login");
          return;
        }

        const userId = auth.user.id;

        const profileResult = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", userId)
          .single();

        if (profileResult.error) throw profileResult.error;

        const profile = profileResult.data;
        const currentRole = String(profile?.role || "").toLowerCase();

        if (!["admin", "mentor"].includes(currentRole)) {
          throw new Error(
            "Halaman Achievement hanya dapat diakses Admin atau Mentor."
          );
        }

        let programQuery = supabase
          .from("ojt_programs")
          .select(`
            id,
            mentor_id,
            site,
            start_date,
            end_date,
            status,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", programId);

        if (currentRole === "mentor") {
          programQuery = programQuery.eq("mentor_id", userId);
        }

        const programResult = await programQuery.maybeSingle();

        if (programResult.error) throw programResult.error;

        if (!programResult.data) {
          throw new Error(
            "Program OJT tidak ditemukan atau Anda tidak memiliki akses."
          );
        }

        const [typeResult, recordResult] = await Promise.all([
          supabase
            .from("achievement_types")
            .select("code,name")
            .order("name"),

          supabase
            .from("achievement_records")
            .select(
              "id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
            )
            .eq("program_id", programId)
            .order("activity_date", { ascending: false }),
        ]);

        if (typeResult.error) throw typeResult.error;
        if (recordResult.error) throw recordResult.error;

        if (!active) return;

        setManager(profile);
        setProgram(programResult.data);
        setTypes(typeResult.data || []);
        setRecords(recordResult.data || []);

        const first = TARGETS.map((target) =>
          typeResult.data?.find(
            (t) => normalize(t.name) === normalize(target.name)
          )
        ).find(Boolean);

        setTypeCode(first?.code || "");

        const todayWeek = weekOf(today(), programResult.data.start_date);

        const latestWeek = (recordResult.data || [])
          .map((item) =>
            weekOf(item.activity_date, programResult.data.start_date)
          )
          .filter((value) => value !== null)
          .sort((a, b) => b - a)[0];

        setSelectedWeek(todayWeek || latestWeek || 1);
      } catch (err) {
        if (active) {
          setError(err.message || "Gagal memuat Achievement.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  const progress = useMemo(() => {
    return TARGETS.map((target) => {
      const type = types.find(
        (t) => normalize(t.name) === normalize(target.name)
      );

      const weekly = Array.from({ length: WEEKS }, (_, index) => {
        const week = index + 1;

        const matching = records.filter(
          (r) =>
            r.status === "verified" &&
            r.type_code === type?.code &&
            weekOf(r.activity_date, program?.start_date) === week
        );

        const achieved =
          target.name === "Fisik"
            ? matching.reduce(
                (sum, r) =>
                  sum + Math.max(0, Number(r.distance_km) || 0),
                0
              )
            : matching.length;

        return {
          week,
          achieved,
          percent: Math.min(
            100,
            Math.round((achieved / target.target) * 100)
          ),
          completed: achieved >= target.target,
        };
      });

      return {
        ...target,
        code: type?.code,
        weekly,
        completedWeeks: weekly.filter((w) => w.completed).length,
        percent: Math.round(
          weekly.reduce((sum, w) => sum + w.percent, 0) / WEEKS
        ),
      };
    });
  }, [records, types, program]);

  const overall = Math.round(
    progress.reduce((sum, item) => sum + item.percent, 0) /
      progress.length
  );

  const activeProgress = progress.find(
    (item) => item.name === selectedCategory
  );

  const weekProgress = activeProgress?.weekly.find(
    (item) => item.week === selectedWeek
  );

  const weekRecords = records.filter(
    (item) =>
      weekOf(item.activity_date, program?.start_date) === selectedWeek &&
      item.type_code === activeProgress?.code
  );

  function resetForm() {
    setEditId(null);
    setActivityDate(today());
    setDescription("");
    setKilometer("0");
    setMeter("0");
  }

  async function save(event) {
    event.preventDefault();

    if (saving || actionId || !canManage || !program) return;

    setError("");
    setMessage("");

    if (!typeCode || !types.some((t) => t.code === typeCode)) {
      setError("Pilih kategori yang tersedia.");
      return;
    }

    if (currentWeek === null) {
      setError("Tanggal harus berada dalam Week 01–25 OJT.");
      return;
    }

    if (
      program.end_date &&
      activityDate > program.end_date
    ) {
      setError("Tanggal kegiatan melewati akhir periode OJT.");
      return;
    }

    if (isFisik && !validDistance) {
      setError("Masukkan jarak Fisik yang valid.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        type_code: typeCode,
        activity_date: activityDate,
        description: description.trim(),
        distance_km: isFisik ? distance : null,
        status: "pending",
        verified_by: null,
      };

      const result = editId
        ? await supabase
            .from("achievement_records")
            .update(payload)
            .eq("id", editId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("achievement_records")
            .insert({
              ...payload,
              program_id: programId,
            })
            .select("id");

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error(
          "Data tidak tersimpan. Periksa izin database."
        );
      }

      await reloadRecords();

      setSelectedWeek(currentWeek);
      setSelectedCategory(
        TARGETS.find(
          (t) => normalize(t.name) === normalize(selectedType?.name)
        )?.name || "Fisik"
      );

      resetForm();
      setMessage("Achievement tersimpan dan menunggu verifikasi.");
    } catch (err) {
      setError(err.message || "Gagal menyimpan Achievement.");
    } finally {
      setSaving(false);
    }
  }

  function edit(item) {
    if (!canManage) return;

    setEditId(item.id);
    setTypeCode(item.type_code);
    setActivityDate(item.activity_date);
    setDescription(item.description || "");

    const totalMeters = Math.round(
      Number(item.distance_km || 0) * 1000
    );

    setKilometer(String(Math.floor(totalMeters / 1000)));
    setMeter(String(totalMeters % 1000));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function verify(item) {
    if (
      !canManage ||
      actionId ||
      saving ||
      item.status !== "pending"
    ) return;

    const itemType = types.find(
      (t) => t.code === item.type_code
    );

    if (
      normalize(itemType?.name) === "fisik" &&
      !(Number(item.distance_km) > 0)
    ) {
      setError("Jarak Fisik harus valid sebelum diverifikasi.");
      return;
    }

    if (!window.confirm("Verifikasi kegiatan ini?")) return;

    setActionId(item.id);
    setError("");
    setMessage("");

    try {
      const { data, error: err } = await supabase
        .from("achievement_records")
        .update({
          status: "verified",
          verified_by: manager.id,
        })
        .eq("id", item.id)
        .eq("program_id", programId)
        .eq("status", "pending")
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error(
          "Verifikasi gagal. Periksa izin database."
        );
      }

      await reloadRecords();
      setMessage("Kegiatan berhasil diverifikasi.");
    } catch (err) {
      setError(err.message || "Gagal memverifikasi.");
    } finally {
      setActionId(null);
    }
  }

  async function remove(item) {
    if (!canManage || actionId || saving) return;

    if (!window.confirm("Hapus kegiatan ini secara permanen?")) {
      return;
    }

    setActionId(item.id);
    setError("");
    setMessage("");

    try {
      const { data, error: err } = await supabase
        .from("achievement_records")
        .delete()
        .eq("id", item.id)
        .eq("program_id", programId)
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error(
          "Data tidak terhapus. Periksa izin database."
        );
      }

      if (editId === item.id) resetForm();

      await reloadRecords();
      setMessage("Kegiatan berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus.");
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <main className="ach-loading">
        Memuat Achievement OJT...
      </main>
    );
  }

  if (!manager || !program) {
    return (
      <main className="ach-loading">
        <h2>Achievement tidak dapat dibuka</h2>
        <p>{error || "Akses tidak tersedia."}</p>
        <button onClick={() => router.push("/")}>
          Dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="ach-root">
      <style>{`
        * { box-sizing: border-box; }
        .ach-root {
          min-height: 100vh;
          background: #f2f6f7;
          color: #172e2a;
          font-family: Arial, Helvetica, sans-serif;
        }
        .ach-loading {
          min-height: 100vh;
          background: #f2f6f7;
          padding: 30px;
          font-family: Arial, sans-serif;
        }
        .ach-header {
          background: #071e25;
          color: white;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .ach-brand {
          font-size: 20px;
          font-weight: 900;
        }
        .ach-brand span { color: #27c991; }
        .ach-container {
          max-width: 1150px;
          margin: auto;
          padding: 20px;
        }
        .ach-banner {
          background: linear-gradient(100deg,#061d23,#07543e);
          color: white;
          border-radius: 17px;
          padding: 25px;
          margin-bottom: 16px;
        }
        .ach-banner small {
          color: #f1c767;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .ach-banner h1 {
          margin: 12px 0;
          font-size: 27px;
        }
        .ach-banner p {
          color: #d7ebe1;
          font-size: 12px;
        }
        .ach-card {
          background: white;
          border: 1px solid #e0eae6;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: 0 4px 15px #123c3010;
          min-width: 0;
        }
        .ach-card h2 {
          margin: 0 0 12px;
          font-size: 18px;
        }
        .ach-muted {
          color: #73867e;
          font-size: 12px;
          line-height: 1.6;
        }
        .ach-grid {
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1fr);
          gap: 16px;
          align-items: start;
        }
        .ach-field { margin-bottom: 16px; }
        .ach-field label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 7px;
        }
        .ach-input {
          width: 100%;
          min-width: 0;
          border: 1px solid #d5e3dc;
          border-radius: 10px;
          background: white;
          color: #193a2e;
          padding: 12px;
          font-size: 16px;
          font-family: inherit;
        }
        .ach-pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .ach-btn {
          border: 0;
          border-radius: 10px;
          background: #118660;
          color: white;
          padding: 12px 15px;
          font-weight: 800;
          cursor: pointer;
        }
        .ach-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }
        .ach-btn.secondary {
          background: #e7f4ed;
          color: #126849;
        }
        .ach-btn.blue { background: #2879bd; }
        .ach-btn.red { background: #d04444; }
        .ach-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ach-progress {
          background: #e6eeeb;
          height: 10px;
          border-radius: 20px;
          overflow: hidden;
          margin: 9px 0;
        }
        .ach-progress span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg,#27bd87,#0b8b62);
          border-radius: inherit;
        }
        .ach-category {
          padding: 12px 0;
          border-bottom: 1px solid #edf2ef;
        }
        .ach-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .ach-record {
          border: 1px solid #e3ece7;
          border-radius: 12px;
          padding: 14px;
          margin-top: 10px;
        }
        .ach-status {
          font-size: 11px;
          font-weight: 800;
          padding: 6px 9px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .ach-status.verified {
          background: #ddf6e9;
          color: #08784d;
        }
        .ach-status.pending {
          background: #fff0c6;
          color: #986000;
        }
        .ach-alert {
          border-radius: 10px;
          padding: 13px;
          margin-bottom: 15px;
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .ach-alert.error {
          background: #fff0f0;
          color: #b91c1c;
        }
        .ach-alert.success {
          background: #e6f8ee;
          color: #08784d;
        }
        .ach-week-grid {
          display: grid;
          grid-template-columns: repeat(5,minmax(0,1fr));
          gap: 7px;
        }
        .ach-week {
          border: 1px solid #dce8e2;
          background: #f8faf9;
          padding: 10px 4px;
          border-radius: 9px;
          text-align: center;
          cursor: pointer;
          font-size: 11px;
          color: #234638;
        }
        .ach-week.active {
          border-color: #0b9668;
          background: #ddf6e9;
        }
        .ach-week.done { background: #c9f1df; }
        .ach-footer {
          text-align: center;
          color: #839a90;
          padding: 20px;
          font-size: 11px;
        }
        @media(max-width:760px) {
          .ach-container { padding: 12px; }
          .ach-grid { grid-template-columns: 1fr; }
          .ach-card { padding: 15px; }
          .ach-banner { padding: 20px; }
          .ach-banner h1 { font-size: 23px; }
          .ach-header { padding: 15px; }
          .ach-brand { font-size: 18px; }
        }
      `}</style>

      <header className="ach-header">
        <div className="ach-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="ach-btn secondary"
          onClick={() => router.push(`/peserta/${programId}`)}
        >
          ← Detail Peserta
        </button>
      </header>

      <div className="ach-container">
        <section className="ach-banner">
          <small>EMERGENCY RESPONSE GROUP · PT BERAU COAL</small>
          <h1>Input Achievement OJT</h1>

          <p>
            {participant?.full_name || "Peserta OJT"}
            {" · "}
            {program.site || "Site belum diisi"}
          </p>

          <p>
            Periode {dateText(program.start_date)}
            {" – "}
            {dateText(program.end_date)}
          </p>

          <p>
            Pengelola: {role === "admin" ? "Administrator" : "Mentor"}
          </p>
        </section>

        {error && (
          <div className="ach-alert error">
            {error}
          </div>
        )}

        {message && (
          <div className="ach-alert success">
            ✓ {message}
          </div>
        )}

        <section className="ach-card">
          <div className="ach-row">
            <h2>Progres Achievement Keseluruhan</h2>
            <strong style={{ color: "#087f5b" }}>
              {overall}%
            </strong>
          </div>

          <div className="ach-progress">
            <span style={{ width: `${overall}%` }} />
          </div>

          <p className="ach-muted">
            Rata-rata pencapaian enam kategori selama 25 minggu.
            Hanya kegiatan terverifikasi yang dihitung.
          </p>
        </section>

        <div className="ach-grid">
          <section className="ach-card">
            <h2>
              {editId ? "Edit Achievement" : "Input Pencapaian OJT"}
            </h2>

            <p className="ach-muted">
              Masukkan kegiatan peserta untuk minggu yang sesuai.
            </p>

            <form onSubmit={save}>
              <div className="ach-field">
                <label>Kategori Pencapaian</label>

                <select
                  className="ach-input"
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value)}
                  required
                >
                  {!typeCode && (
                    <option value="">Pilih kategori</option>
                  )}

                  {TARGETS.map((target) => {
                    const type = types.find(
                      (t) =>
                        normalize(t.name) === normalize(target.name)
                    );

                    return type ? (
                      <option key={type.code} value={type.code}>
                        {target.name}
                      </option>
                    ) : null;
                  })}
                </select>
              </div>

              <div className="ach-field">
                <label>Tanggal Kegiatan</label>

                <input
                  className="ach-input"
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  required
                />

                <p className="ach-muted">
                  {currentWeek
                    ? `Week ${String(currentWeek).padStart(2, "0")}`
                    : "Tanggal di luar Week 01–25"}
                </p>
              </div>

              {isFisik && (
                <div className="ach-field">
                  <label>Jarak Tempuh Fisik</label>

                  <div className="ach-pair">
                    <div>
                      <label>Kilometer</label>

                      <select
                        className="ach-input"
                        value={kilometer}
                        onChange={(e) => setKilometer(e.target.value)}
                      >
                        {Array.from({ length: 101 }, (_, i) => (
                          <option key={i} value={i}>
                            {i} km
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label>Tambahan Meter</label>

                      <input
                        className="ach-input"
                        type="number"
                        min="0"
                        max="999"
                        step="1"
                        value={meter}
                        onChange={(e) => setMeter(e.target.value)}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      background: "#e6f8ee",
                      borderRadius: 12,
                    }}
                  >
                    <span className="ach-muted">
                      Total jarak kegiatan
                    </span>

                    <h2 style={{ color: "#087f5b", margin: "6px 0" }}>
                      {distance === null ? "—" : kmText(distance)} km
                    </h2>

                    <span className="ach-muted">
                      Target 25 km per minggu
                    </span>
                  </div>
                </div>
              )}

              <div className="ach-field">
                <label>Keterangan Kegiatan (Opsional)</label>

                <textarea
                  className="ach-input"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Latihan lari bersama tim ERG"
                />
              </div>

              <div className="ach-actions">
                <button
                  className="ach-btn"
                  type="submit"
                  disabled={
                    saving ||
                    !!actionId ||
                    !typeCode ||
                    !canManage
                  }
                >
                  {saving
                    ? "Menyimpan..."
                    : editId
                    ? "Simpan Perubahan"
                    : "Simpan Achievement"}
                </button>

                {editId && (
                  <button
                    className="ach-btn secondary"
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="ach-card">
            <h2>Progres Enam Kategori</h2>

            <p className="ach-muted">
              Setiap kategori dihitung berdasarkan target per minggu.
            </p>

            {progress.map((item) => (
              <div className="ach-category" key={item.name}>
                <div className="ach-row">
                  <strong>
                    {item.icon} {item.name}
                  </strong>

                  <strong style={{ color: "#087f5b" }}>
                    {item.percent}%
                  </strong>
                </div>

                <div className="ach-progress">
                  <span style={{ width: `${item.percent}%` }} />
                </div>

                <div className="ach-muted">
                  {item.completedWeeks}/25 minggu tercapai
                  {" · "}
                  Target {item.target} {item.unit}/minggu
                </div>
              </div>
            ))}
          </section>
        </div>

        <section className="ach-card">
          <h2>Monitoring Achievement Mingguan</h2>

          <div className="ach-pair" style={{ marginBottom: 15 }}>
            <div className="ach-field">
              <label>Kategori</label>

              <select
                className="ach-input"
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value)
                }
              >
                {TARGETS.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ach-field">
              <label>Minggu</label>

              <select
                className="ach-input"
                value={selectedWeek}
                onChange={(e) =>
                  setSelectedWeek(Number(e.target.value))
                }
              >
                {Array.from({ length: WEEKS }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Week {String(i + 1).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              padding: 15,
              borderRadius: 12,
              background: "#e6f8ee",
              marginBottom: 15,
            }}
          >
            <div className="ach-row">
              <strong>
                {selectedCategory} · Week{" "}
                {String(selectedWeek).padStart(2, "0")}
              </strong>

              <strong style={{ color: "#087f5b" }}>
                {weekProgress?.percent || 0}%
              </strong>
            </div>

            <div className="ach-progress">
              <span
                style={{
                  width: `${weekProgress?.percent || 0}%`,
                }}
              />
            </div>

            <span className="ach-muted">
              {selectedCategory === "Fisik"
                ? kmText(weekProgress?.achieved)
                : weekProgress?.achieved || 0}
              {" dari "}
              {activeProgress?.target} {activeProgress?.unit}
              {" · "}
              {weekProgress?.completed
                ? "Target tercapai"
                : "Belum tercapai"}
            </span>
          </div>

          <div className="ach-week-grid">
            {activeProgress?.weekly.map((w) => (
              <button
                key={w.week}
                type="button"
                className={`ach-week ${
                  selectedWeek === w.week ? "active" : ""
                } ${w.completed ? "done" : ""}`}
                onClick={() => setSelectedWeek(w.week)}
              >
                <strong>W{String(w.week).padStart(2, "0")}</strong>
                <div style={{ marginTop: 6 }}>
                  {w.percent}%
                </div>
              </button>
            ))}
          </div>

          <h2 style={{ marginTop: 22 }}>
            Riwayat Minggu Ini
          </h2>

          {!weekRecords.length && (
            <p className="ach-muted">
              Belum ada kegiatan pada minggu ini.
            </p>
          )}

          {weekRecords.map((item) => (
            <div className="ach-record" key={item.id}>
              <div className="ach-row">
                <strong>
                  {dateText(item.activity_date)}
                </strong>

                <span
                  className={`ach-status ${
                    item.status === "verified"
                      ? "verified"
                      : "pending"
                  }`}
                >
                  {item.status === "verified"
                    ? "Terverifikasi"
                    : item.status === "pending"
                    ? "Menunggu Verifikasi"
                    : item.status}
                </span>
              </div>

              {item.distance_km != null && (
                <p>
                  <strong>
                    {kmText(item.distance_km)} km
                  </strong>
                </p>
              )}

              {item.description && (
                <p
                  className="ach-muted"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {item.description}
                </p>
              )}

              <div className="ach-actions">
                {item.status === "pending" && (
                  <button
                    className="ach-btn"
                    disabled={!!actionId || saving}
                    onClick={() => verify(item)}
                  >
                    Verifikasi
                  </button>
                )}

                <button
                  className="ach-btn blue"
                  disabled={!!actionId || saving}
                  onClick={() => edit(item)}
                >
                  Edit
                </button>

                <button
                  className="ach-btn red"
                  disabled={!!actionId || saving}
                  onClick={() => remove(item)}
                >
                  {actionId === item.id
                    ? "Memproses..."
                    : "Hapus"}
                </button>
              </div>
            </div>
          ))}
        </section>

        <footer className="ach-footer">
          OJT MineTrack v2.0 · Emergency Response Group · PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
