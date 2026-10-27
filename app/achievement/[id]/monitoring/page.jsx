
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TOTAL_WEEKS = 25;

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

function normalize(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function roleText(v) {
  return String(v || "").trim().toLowerCase();
}

function parseDate(v) {
  const m = String(v || "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));

  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) return null;

  return d;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function dateText(v) {
  const d = parseDate(v);
  if (!d) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function weekLabel(n) {
  return `Week ${String(n).padStart(2, "0")}`;
}

function kmText(v) {
  return Number(v || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function clamp(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
}

function initials(name) {
  return String(name || "Peserta")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0])
    .join("")
    .toUpperCase();
}

// Kalender monitoring global, tidak mengubah DB.
const GLOBAL_WEEKS = Array.from(
  { length: TOTAL_WEEKS },
  (_, i) => {
    const start = i === 0
      ? new Date("2026-09-12T00:00:00Z")
      : addDays(new Date("2026-09-20T00:00:00Z"), (i - 1) * 7);

    return {
      week: i + 1,
      start: dateKey(start),
      end: dateKey(addDays(start, 6)),
    };
  }
);

function globalWeekOf(value) {
  const key = String(value || "").slice(0, 10);

  if (!parseDate(key)) return null;

  const found = GLOBAL_WEEKS.find(
    w => key >= w.start && key <= w.end
  );

  return found?.week ?? null;
}

// Rumus minggu lokal program peserta tetap seperti kode lama.
function programWeekOf(value, startValue) {
  const d = parseDate(value);
  const start = parseDate(startValue);

  if (!d || !start) return null;

  const week = Math.floor(
    (d.getTime() - start.getTime()) / 604800000
  ) + 1;

  return week >= 1 && week <= 25 ? week : null;
}

function currentGlobalWeek() {
  const now = new Date();
  const localDay = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const matched = globalWeekOf(localDay);
  if (matched) return matched;

  if (localDay < GLOBAL_WEEKS[0].start) return 1;
  if (localDay > GLOBAL_WEEKS[24].end) return 25;

  const earlier = GLOBAL_WEEKS.filter(w => w.end < localDay);

  return earlier.length ? earlier[earlier.length - 1].week : 1;
}

function categoryFor(record, types) {
  const type = types.find(
    t => normalize(t.code) === normalize(record.type_code)
  );

  return TARGETS.find(
    target =>
      normalize(target.name) === normalize(type?.name) ||
      normalize(target.name) === normalize(record.type_code)
  ) || null;
}

function achievedValue(records, category) {
  if (category.name !== "Fisik") return records.length;

  // Perhitungan meter mengikuti rumus Detail Peserta.
  const meters = records.reduce((sum, r) => {
    const distance = Number(r.distance_km);

    return sum + (
      Number.isFinite(distance) && distance > 0
        ? Math.round(distance * 1000)
        : 0
    );
  }, 0);

  return meters / 1000;
}

function amountText(value, category) {
  return category.name === "Fisik"
    ? `${kmText(value)} km`
    : `${value} kegiatan`;
}

function Progress({ value }) {
  const safe = clamp(value);

  return (
    <div
      className="am-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

export default function MonitoringAchievementPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [account, setAccount] = useState(null);
  const [program, setProgram] = useState(null);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [week, setWeek] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [error, setError] = useState("");

  const role = roleText(account?.role);
  const canManage = role === "admin" || role === "mentor";
  const isParticipant = role === "participant" || role === "peserta";

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const selectedPeriod = GLOBAL_WEEKS[week - 1];

  useEffect(() => {
    setWeek(currentGlobalWeek());
  }, []);

  async function getData() {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name")
        .order("name"),

      supabase
        .from("achievement_records")
        .select(
          "id,program_id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
        )
        .eq("program_id", programId)
        .order("activity_date", { ascending: false }),
    ]);

    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;

    return {
      types: results[0].data || [],
      records: results[1].data || [],
    };
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

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id,full_name,role")
            .eq("id", auth.user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        const currentRole = roleText(profile?.role);

        if (
          !["admin", "mentor", "participant", "peserta"]
            .includes(currentRole)
        ) {
          throw new Error("Akun tidak memiliki akses monitoring.");
        }

        const { data: programData, error: programError } =
          await supabase
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
            .maybeSingle();

        if (programError) throw programError;

        if (!programData) {
          throw new Error("Program OJT tidak ditemukan.");
        }

        if (
          ["participant", "peserta"].includes(currentRole) &&
          (
            programData.participant_id !== auth.user.id ||
            programData.status !== "active"
          )
        ) {
          throw new Error(
            "Peserta hanya dapat melihat program aktif miliknya."
          );
        }

        const data = await getData();

        if (!active) return;

        setAccount(profile);
        setProgram(programData);
        setTypes(data.types);
        setRecords(data.records);
      } catch (err) {
        if (active) {
          setError(err?.message || "Gagal memuat monitoring.");
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

  async function refresh() {
    if (refreshing || loading) return;

    setRefreshing(true);
    setError("");

    try {
      const data = await getData();
      setTypes(data.types);
      setRecords(data.records);
    } catch (err) {
      setError(err?.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }

  // Progres asli: rata-rata enam kategori,
  // masing-masing dirata-ratakan sepanjang 25
  // minggu lokal peserta, maksimum 100% per minggu.
  const programProgress = useMemo(() => {
    const categories = TARGETS.map(category => {
      const type = types.find(
        t => normalize(t.name) === normalize(category.name)
      );

      const weekly = Array.from(
        { length: TOTAL_WEEKS },
        (_, index) => {
          const localWeek = index + 1;

          const verified = records.filter(r =>
            r.status === "verified" &&
            r.type_code === type?.code &&
            programWeekOf(
              r.activity_date,
              program?.start_date
            ) === localWeek
          );

          const amount = achievedValue(verified, category);
          const percent = Math.min(
            100,
            Math.round((amount / category.target) * 100)
          );

          return {
            week: localWeek,
            amount,
            percent,
            complete: amount >= category.target,
          };
        }
      );

      return {
        ...category,
        weekly,
        completedWeeks: weekly.filter(w => w.complete).length,
        percent: Math.round(
          weekly.reduce((sum, w) => sum + w.percent, 0) /
          TOTAL_WEEKS
        ),
      };
    });

    const overall = Math.round(
      categories.reduce((sum, c) => sum + c.percent, 0) /
      categories.length
    );

    return { categories, overall };
  }, [records, types, program?.start_date]);

  const weeklyRecords = useMemo(
    () => records.filter(r => globalWeekOf(r.activity_date) === week),
    [records, week]
  );

  const verified = weeklyRecords.filter(r => r.status === "verified");
  const pending = weeklyRecords.filter(r => r.status === "pending");

  const verificationPercent = weeklyRecords.length
    ? Math.round((verified.length / weeklyRecords.length) * 100)
    : 0;

  const categories = useMemo(() => TARGETS.map(category => {
    const related = weeklyRecords.filter(
      r => categoryFor(r, types)?.name === category.name
    );

    const valid = related.filter(r => r.status === "verified");
    const waiting = related.filter(r => r.status === "pending");
    const actual = achievedValue(valid, category);

    return {
      ...category,
      total: related.length,
      verified: valid.length,
      pending: waiting.length,
      actual,
      targetPercent: clamp((actual / category.target) * 100),
      verificationPercent: related.length
        ? Math.round((valid.length / related.length) * 100)
        : 0,
    };
  }), [weeklyRecords, types]);

  const chart = useMemo(() => GLOBAL_WEEKS.map(w => {
    const matching = records.filter(
      r => globalWeekOf(r.activity_date) === w.week
    );

    return {
      ...w,
      total: matching.length,
      verified: matching.filter(r => r.status === "verified").length,
      pending: matching.filter(r => r.status === "pending").length,
    };
  }), [records]);

  const maxChart = Math.max(1, ...chart.map(w => w.verified));
  const activeWeeks = chart.filter(w => w.total > 0).length;
  const outsideGlobal = records.filter(
    r => globalWeekOf(r.activity_date) === null
  ).length;

  const history = weeklyRecords.filter(r => {
    const cat = categoryFor(r, types);

    const matchesCategory =
      categoryFilter === "all" ||
      cat?.name === categoryFilter;

    const matchesStatus =
      statusFilter === "all" ||
      r.status === statusFilter;

    return matchesCategory && matchesStatus;
  });

  function changeWeek(value) {
    setWeek(Math.max(1, Math.min(25, Number(value))));
  }

  function goBack() {
    router.push(
      isParticipant
        ? "/dashboard-peserta"
        : `/peserta/${programId}`
    );
  }

  if (loading) {
    return (
      <main className="am-loading">
        Memuat Monitoring Achievement OJT...
      </main>
    );
  }

  if (!account || !program) {
    return (
      <main className="am-loading">
        <h2>Monitoring Achievement tidak tersedia</h2>
        <p>{error || "Akses tidak tersedia."}</p>
        <button onClick={() => router.push("/")}>
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  return (
    <main className={`am-root ${presentation ? "am-presentation" : ""}`}>
      <style>{css}</style>

      <header className="am-header">
        <div className="am-brand">
          OJT <span>MineTrack</span>
        </div>

        <div className="am-account">
          <div>
            <small>
              {role === "admin"
                ? "Administrator"
                : role === "mentor"
                ? "Mentor OJT"
                : "Peserta OJT"}
            </small>
            <strong>{account.full_name || "Pengguna"}</strong>
          </div>

          <button onClick={goBack}>
            ← Kembali
          </button>
        </div>
      </header>

      <div className="am-container">
        <section className="am-hero">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>Monitoring Achievement OJT</h1>
          <p>
            Evaluasi pencapaian, verifikasi, dan aktivitas 25 minggu.
          </p>

          <div className="am-person">
            <div className="am-avatar">
              {initials(participant?.full_name)}
            </div>
            <div>
              <strong>{participant?.full_name || "Peserta OJT"}</strong>
              <span>
                {participant?.department || "—"} ·{" "}
                {program.site || "Site belum diisi"}
              </span>
              <small>
                {dateText(program.start_date)} –{" "}
                {dateText(program.end_date)}
              </small>
            </div>
          </div>
        </section>

        <nav className="am-tabs">
          {canManage && (
            <button
              onClick={() => router.push(`/achievement/${programId}`)}
            >
              ✍️ Input Achievement
            </button>
          )}
          <span className="active">
            📊 Monitoring Achievement
          </span>
        </nav>

        {error && <div className="am-error">{error}</div>}

        <div className="am-toolbar">
          <div>
            <strong>Dashboard Monitoring</strong>
            <small>Kalender Global OJT 2026–2027</small>
          </div>

          <div className="am-actions">
            <button onClick={refresh} disabled={refreshing}>
              {refreshing ? "Memuat..." : "↻ Refresh"}
            </button>

            <button
              className="primary"
              onClick={() => setPresentation(v => !v)}
            >
              {presentation ? "Tampilan Normal" : "▣ Mode Presentasi"}
            </button>

            <button onClick={() => window.print()}>
              🖨 Cetak
            </button>
          </div>
        </div>

        <section className="am-card">
          <div className="am-section-head">
            <div>
              <h2>Monitoring Mingguan</h2>
              <p>
                Tanggal dan catatan mengikuti kalender global OJT.
              </p>
            </div>

            <div className="am-week-control">
              <button
                disabled={week <= 1}
                onClick={() => changeWeek(week - 1)}
              >
                ‹
              </button>

              <select
                value={week}
                onChange={e => changeWeek(e.target.value)}
              >
                {GLOBAL_WEEKS.map(w => (
                  <option key={w.week} value={w.week}>
                    {weekLabel(w.week)}
                  </option>
                ))}
              </select>

              <button
                disabled={week >= 25}
                onClick={() => changeWeek(week + 1)}
              >
                ›
              </button>
            </div>
          </div>

          <div className="am-period">
            <strong>{weekLabel(week)}</strong>
            <span>
              {dateText(selectedPeriod.start)} –{" "}
              {dateText(selectedPeriod.end)}
            </span>
          </div>

          <div className="am-stats">
            <div className="am-stat">
              <span>Total Achievement</span>
              <strong>{weeklyRecords.length}</strong>
              <small>Minggu terpilih</small>
            </div>

            <div className="am-stat green">
              <span>Verified</span>
              <strong>{verified.length}</strong>
              <small>Sudah diverifikasi</small>
            </div>

            <div className="am-stat orange">
              <span>Pending</span>
              <strong>{pending.length}</strong>
              <small>Menunggu verifikasi</small>
            </div>

            <div className="am-stat blue">
              <span>Persentase Verifikasi</span>
              <strong>{verificationPercent}%</strong>
              <small>Verified / Total</small>
            </div>
          </div>
        </section>

        <section className="am-card">
          <div className="am-section-head">
            <div>
              <h2>Progres Enam Kategori</h2>
              <p>
                Target dan realisasi Verified pada {weekLabel(week)}.
              </p>
            </div>
          </div>

          <div className="am-category-grid">
            {categories.map(c => (
              <article className="am-category" key={c.name}>
                <div className="am-category-head">
                  <span className="am-icon">{c.icon}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <small>
                      Target {c.target} {c.unit} / minggu program
                    </small>
                  </div>
                </div>

                <div className="am-category-actual">
                  <strong>{amountText(c.actual, c)}</strong>
                  <span>{Math.round(c.targetPercent)}% target</span>
                </div>

                <Progress value={c.targetPercent} />

                <div className="am-category-footer">
                  <span>{c.verified} Verified</span>
                  <span>{c.pending} Pending</span>
                  <span>{c.verificationPercent}% diverifikasi</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="am-two-columns">
          <section className="am-card">
            <div className="am-section-head">
              <div>
                <h2>Grafik Achievement Mingguan</h2>
                <p>Jumlah catatan Verified pada Week 01–25.</p>
              </div>
            </div>

            <div className="am-chart-scroll">
              <div className="am-chart">
                {chart.map(c => (
                  <button
                    key={c.week}
                    className={`am-chart-column ${
                      c.week === week ? "selected" : ""
                    }`}
                    onClick={() => changeWeek(c.week)}
                    title={`${weekLabel(c.week)}: ${c.verified} Verified`}
                  >
                    <strong>{c.verified}</strong>
                    <span className="am-bar-track">
                      <i
                        style={{
                          height: `${
                            c.verified
                              ? Math.max(6, c.verified / maxChart * 100)
                              : 2
                          }%`,
                        }}
                      />
                    </span>
                    <small>
                      W{String(c.week).padStart(2, "0")}
                    </small>
                  </button>
                ))}
              </div>
            </div>

            <p className="am-note">
              Pilih batang grafik untuk mengganti minggu monitoring.
              Jumlah batang menunjukkan catatan, bukan total kilometer.
            </p>
          </section>

          <section className="am-card">
            <div className="am-section-head">
              <div>
                <h2>Aktivitas 25 Minggu</h2>
                <p>Minggu yang memiliki catatan Achievement.</p>
              </div>
              <strong className="am-highlight">
                {activeWeeks}/25
              </strong>
            </div>

            <div className="am-week-grid">
              {chart.map(c => (
                <button
                  key={c.week}
                  className={`am-week ${
                    c.total ? "has-data" : ""
                  } ${c.week === week ? "selected" : ""}`}
                  onClick={() => changeWeek(c.week)}
                  title={`${weekLabel(c.week)}: ${c.total} catatan`}
                >
                  W{String(c.week).padStart(2, "0")}
                </button>
              ))}
            </div>

            <div className="am-legend">
              <span>● Hijau: ada aktivitas</span>
              <span>● Abu-abu: belum ada aktivitas</span>
            </div>

            {outsideGlobal > 0 && (
              <p className="am-note">
                {outsideGlobal} catatan berada di luar kalender
                global. Data tetap tersimpan, tetapi tidak masuk
                grafik mingguan global.
              </p>
            )}
          </section>
        </div>

        <section className="am-card">
          <div className="am-section-head">
            <div>
              <h2>Progres Keseluruhan Program Peserta</h2>
              <p>
                Rumus lama: rata-rata capaian enam kategori
                selama 25 minggu sejak tanggal mulai peserta.
              </p>
            </div>

            <strong className="am-highlight">
              {programProgress.overall}%
            </strong>
          </div>

          <Progress value={programProgress.overall} />

          <div className="am-program-grid">
            {programProgress.categories.map(c => (
              <div className="am-program-item" key={c.name}>
                <div className="am-program-head">
                  <strong>{c.icon} {c.name}</strong>
                  <strong>{c.percent}%</strong>
                </div>

                <Progress value={c.percent} />

                <small>
                  {c.completedWeeks}/25 minggu mencapai target
                </small>
              </div>
            ))}
          </div>

          <p className="am-note">
            Nomor minggu global dan minggu program peserta dapat
            berbeda. Indikator ini tidak menggunakan perhitungan
            kalender global sehingga hasil rumus sebelumnya
            tetap dipertahankan.
          </p>
        </section>

        <section className="am-card">
          <div className="am-section-head">
            <div>
              <h2>Riwayat Achievement</h2>
              <p>
                Kegiatan pada {weekLabel(week)} ·{" "}
                {dateText(selectedPeriod.start)} –{" "}
                {dateText(selectedPeriod.end)}
              </p>
            </div>
            <strong className="am-count">
              {history.length} kegiatan
            </strong>
          </div>

          <div className="am-filters">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              aria-label="Filter kategori"
            >
              <option value="all">Semua Kategori</option>
              {TARGETS.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filter status"
            >
              <option value="all">Semua Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {!history.length ? (
            <div className="am-empty">
              Belum ada kegiatan pada minggu dan filter ini.
            </div>
          ) : (
            <div className="am-history">
              {history.map(r => {
                const c = categoryFor(r, types);
                const localWeek = programWeekOf(
                  r.activity_date,
                  program.start_date
                );

                return (
                  <div className="am-record" key={r.id}>
                    <div className="am-record-icon">
                      {c?.icon || "📋"}
                    </div>

                    <div className="am-record-info">
                      <strong>
                        {c?.name || r.type_code}
                      </strong>
                      <small>
                        {dateText(r.activity_date)} ·{" "}
                        Minggu Program:{" "}
                        {localWeek
                          ? weekLabel(localWeek)
                          : "Di luar periode program"}
                      </small>

                      {r.distance_km != null && (
                        <span>{kmText(r.distance_km)} km</span>
                      )}

                      {r.description && <p>{r.description}</p>}
                    </div>

                    <span
                      className={`am-status ${
                        r.status === "verified"
                          ? "verified"
                          : "pending"
                      }`}
                    >
                      {r.status === "verified"
                        ? "Verified"
                        : r.status === "pending"
                        ? "Pending"
                        : r.status || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="am-bottom">
          <button onClick={goBack}>
            ← Detail Peserta
          </button>

          {canManage && (
            <button
              className="primary"
              onClick={() =>
                router.push(`/achievement/${programId}`)
              }
            >
              ✍️ Input Achievement
            </button>
          )}
        </div>

        <footer className="am-footer">
          OJT MineTrack v2.0 · Emergency Response Group · PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

const css = `
  * { box-sizing: border-box; }

  .am-root {
    min-height: 100vh;
    background: #f1f6f5;
    color: #17352d;
    font-family: Arial, Helvetica, sans-serif;
  }

  .am-root button,
  .am-root select {
    font: inherit;
  }

  .am-root button {
    cursor: pointer;
  }

  .am-root button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .am-loading {
    min-height: 100vh;
    padding: 35px;
    font-family: Arial, sans-serif;
    background: #f1f6f5;
  }

  .am-header {
    background: #071e25;
    color: white;
    padding: 16px 25px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
  }

  .am-brand {
    font-size: 22px;
    font-weight: 900;
  }

  .am-brand span { color: #29c990; }

  .am-account {
    display: flex;
    align-items: center;
    gap: 17px;
  }

  .am-account small,
  .am-account strong {
    display: block;
    text-align: right;
  }

  .am-account small {
    color: #b5d9c9;
    font-size: 10px;
    margin-bottom: 4px;
  }

  .am-account strong { font-size: 12px; }

  .am-account button {
    border: 1px solid #ffffff38;
    background: #ffffff15;
    color: white;
    padding: 11px 14px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 800;
  }

  .am-container {
    max-width: 1500px;
    padding: 22px;
    margin: auto;
  }

  .am-hero {
    border-radius: 17px;
    padding: 28px;
    background:
      linear-gradient(100deg, #061d23f2, #07503ebd),
      url("/background-erg.png.PNG");
    background-position: center;
    background-size: cover;
    color: white;
  }

  .am-hero > small {
    color: #eac76c;
    letter-spacing: 1px;
    font-size: 10px;
    font-weight: 900;
  }

  .am-hero h1 {
    margin: 12px 0 9px;
    font-size: clamp(25px, 3vw, 36px);
  }

  .am-hero > p {
    color: #d4e8de;
    font-size: 13px;
  }

  .am-person {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 19px;
    background: #092b2cba;
    border: 1px solid #ffffff30;
    border-radius: 11px;
    padding: 12px;
    width: fit-content;
    max-width: 100%;
  }

  .am-avatar {
    background: #d8f4e6;
    color: #087655;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-weight: 900;
  }

  .am-person strong,
  .am-person span,
  .am-person small {
    display: block;
  }

  .am-person strong { font-size: 13px; }

  .am-person span,
  .am-person small {
    font-size: 11px;
    color: #c5e1d6;
    margin-top: 5px;
  }

  .am-tabs {
    display: flex;
    gap: 8px;
    margin: 16px 0;
  }

  .am-tabs button,
  .am-tabs span {
    padding: 12px 17px;
    border: 1px solid #deebe3;
    background: white;
    color: #2a654e;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 800;
  }

  .am-tabs .active {
    background: #078b61;
    color: white;
    border-color: #078b61;
  }

  .am-error {
    margin-bottom: 13px;
    padding: 13px;
    border: 1px solid #fecaca;
    border-radius: 9px;
    background: #fff1f1;
    color: #ad2929;
    font-size: 12px;
  }

  .am-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 13px;
    margin-bottom: 14px;
  }

  .am-toolbar > div > strong,
  .am-toolbar > div > small {
    display: block;
  }

  .am-toolbar > div > small {
    color: #81938a;
    font-size: 11px;
    margin-top: 6px;
  }

  .am-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .am-actions button,
  .am-bottom button {
    background: white;
    color: #135d43;
    border: 1px solid #d5e5db;
    border-radius: 9px;
    padding: 11px 14px;
    font-weight: 800;
    font-size: 12px;
  }

  .am-actions .primary,
  .am-bottom .primary {
    background: #07885f;
    color: white;
    border-color: #07885f;
  }

  .am-card {
    min-width: 0;
    padding: 20px;
    margin-bottom: 15px;
    border: 1px solid #e0ebe5;
    border-radius: 15px;
    background: white;
    box-shadow: 0 5px 17px #153d2b0a;
  }

  .am-section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .am-section-head h2 {
    margin: 0;
    font-size: 18px;
    color: #16362c;
  }

  .am-section-head p {
    margin: 7px 0 0;
    font-size: 12px;
    color: #82948a;
    line-height: 1.6;
  }

  .am-week-control {
    display: flex;
    gap: 5px;
  }

  .am-week-control button,
  .am-week-control select,
  .am-filters select {
    background: #f8fbf9;
    color: #166b4c;
    border: 1px solid #d8e7de;
    border-radius: 8px;
    padding: 10px;
    font-size: 12px;
    font-weight: 800;
  }

  .am-period {
    display: flex;
    flex-wrap: wrap;
    gap: 13px;
    align-items: center;
    background: #eaf7ef;
    border-radius: 10px;
    padding: 13px;
    margin-bottom: 14px;
    font-size: 12px;
  }

  .am-period strong { color: #078259; }

  .am-period span { color: #648275; }

  .am-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 11px;
  }

  .am-stat {
    min-width: 0;
    background: #f6f9f7;
    border: 1px solid #e6eeea;
    padding: 16px;
    border-radius: 11px;
  }

  .am-stat.green { background: #e4f7ed; }
  .am-stat.orange { background: #fff4dc; }
  .am-stat.blue { background: #e8f2fe; }

  .am-stat span,
  .am-stat small {
    display: block;
    font-size: 11px;
    color: #6e8678;
  }

  .am-stat strong {
    display: block;
    font-size: 29px;
    color: #13392c;
    margin: 9px 0;
  }

  .am-category-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .am-category {
    min-width: 0;
    border: 1px solid #e0eae4;
    background: #fcfefd;
    border-radius: 12px;
    padding: 16px;
  }

  .am-category-head {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .am-category-head strong,
  .am-category-head small {
    display: block;
  }

  .am-category-head strong {
    font-size: 14px;
  }

  .am-category-head small {
    color: #849588;
    font-size: 10px;
    margin-top: 5px;
  }

  .am-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 10px;
    background: #e1f5e9;
    font-size: 21px;
  }

  .am-category-actual {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    margin: 17px 0 10px;
  }

  .am-category-actual strong {
    font-size: 20px;
    color: #08845d;
  }

  .am-category-actual span {
    font-size: 11px;
    color: #6d8d79;
  }

  .am-progress {
    width: 100%;
    height: 10px;
    background: #e3ece7;
    border-radius: 20px;
    overflow: hidden;
  }

  .am-progress span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #2ec18c, #088a61);
    border-radius: inherit;
  }

  .am-category-footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 7px;
    font-size: 10px;
    color: #779081;
    margin-top: 12px;
  }

  .am-two-columns {
    display: grid;
    grid-template-columns: 1.1fr .9fr;
    align-items: start;
    gap: 15px;
  }

  .am-chart-scroll {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 8px;
  }

  .am-chart {
    display: flex;
    align-items: stretch;
    width: max-content;
    gap: 7px;
    height: 225px;
    border-bottom: 1px solid #dbe6df;
  }

  .am-chart-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    width: 31px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #748e7d;
    gap: 7px;
  }

  .am-chart-column strong,
  .am-chart-column small {
    font-size: 10px;
  }

  .am-bar-track {
    display: flex;
    align-items: flex-end;
    height: 160px;
    width: 20px;
  }

  .am-bar-track i {
    display: block;
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: #38c395;
  }

  .am-chart-column.selected .am-bar-track i {
    background: #2688d9;
  }

  .am-chart-column.selected {
    color: #1c76bd;
  }

  .am-week-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 7px;
  }

  .am-week {
    padding: 11px 4px;
    border: 1px solid #dce8e0;
    background: #f3f7f5;
    color: #597468;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
  }

  .am-week.has-data {
    background: #d9f4e7;
    border-color: #a8ddc1;
  }

  .am-week.selected {
    color: white;
    background: #07875e;
    border-color: #07875e;
  }

  .am-highlight {
    color: #078b60;
    font-size: 24px;
  }

  .am-legend,
  .am-note {
    color: #809188;
    font-size: 11px;
    line-height: 1.7;
    margin-top: 14px;
  }

  .am-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .am-program-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .am-program-item {
    min-width: 0;
    border: 1px solid #e2ece5;
    border-radius: 11px;
    padding: 12px;
  }

  .am-program-head {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 11px;
  }

  .am-program-item small {
    display: block;
    font-size: 10px;
    color: #849488;
    margin-top: 10px;
    line-height: 1.5;
  }

  .am-count {
    font-size: 12px;
    color: #0b825c;
  }

  .am-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-bottom: 13px;
  }

  .am-record {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    border-bottom: 1px solid #e8efea;
    padding: 15px 0;
  }

  .am-record-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #e6f6ed;
    font-size: 20px;
  }

  .am-record-info {
    flex: 1;
    min-width: 0;
  }

  .am-record-info strong,
  .am-record-info small,
  .am-record-info span {
    display: block;
  }

  .am-record-info strong { font-size: 13px; }

  .am-record-info small {
    color: #829389;
    font-size: 10px;
    margin-top: 6px;
  }

  .am-record-info span {
    font-size: 12px;
    margin-top: 7px;
    color: #205c42;
    font-weight: 800;
  }

  .am-record-info p {
    font-size: 12px;
    color: #657d6d;
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .am-status {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 800;
    border-radius: 20px;
    padding: 7px 10px;
    background: #f0f3f1;
  }

  .am-status.verified {
    background: #dff6e9;
    color: #087b53;
  }

  .am-status.pending {
    background: #fff0cf;
    color: #96650b;
  }

  .am-empty {
    padding: 30px;
    color: #84958a;
    text-align: center;
    font-size: 12px;
  }

  .am-bottom {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 15px;
  }

  .am-footer {
    color: #8c9d91;
    font-size: 11px;
    text-align: center;
    padding: 20px 0;
  }

  .am-presentation .am-header,
  .am-presentation .am-tabs {
    display: none;
  }

  .am-presentation .am-container {
    max-width: 1900px;
  }

  @media(max-width:1100px) {
    .am-category-grid {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }

    .am-program-grid {
      grid-template-columns: repeat(3, minmax(0,1fr));
    }
  }

  @media(max-width:850px) {
    .am-two-columns {
      grid-template-columns: 1fr;
    }
  }

  @media(max-width:650px) {
    .am-header {
      padding: 14px;
    }

    .am-brand {
      font-size: 18px;
    }

    .am-account > div {
      max-width: 140px;
      overflow-wrap: anywhere;
    }

    .am-container {
      padding: 12px;
    }

    .am-hero {
      padding: 20px;
    }

    .am-hero h1 {
      font-size: 25px;
    }

    .am-tabs {
      gap: 6px;
    }

    .am-tabs button,
    .am-tabs span {
      flex: 1;
      text-align: center;
      font-size: 11px;
      padding: 11px 8px;
    }

    .am-card {
      padding: 15px;
    }

    .am-section-head h2 {
      font-size: 16px;
    }

    .am-stats {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }

    .am-category-grid {
      grid-template-columns: 1fr;
    }

    .am-program-grid {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }

    .am-week-grid {
      gap: 5px;
    }

    .am-week {
      padding: 10px 2px;
      font-size: 10px;
    }

    .am-record {
      gap: 8px;
    }

    .am-status {
      font-size: 9px;
    }
  }

  @media print {
    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    .am-header,
    .am-tabs,
    .am-actions,
    .am-week-control,
    .am-filters,
    .am-bottom {
      display: none !important;
    }

    .am-container {
      padding: 0;
      max-width: none;
    }

    .am-card {
      break-inside: avoid;
      box-shadow: none;
    }

    .am-hero {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`;
