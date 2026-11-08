
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// OJT MineTrack v2.0
// Halaman Verifikasi & Monitoring Mentor/Admin
// Tidak mengubah database atau perhitungan lama.

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📘" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

const WEEKS = Array.from({ length: 25 }, (_, i) => {
  const start = i === 0
    ? new Date(Date.UTC(2026, 8, 12))
    : addDays(new Date(Date.UTC(2026, 8, 20)), (i - 1) * 7);

  return {
    number: i + 1,
    start: dateKey(start),
    end: dateKey(addDays(start, 6)),
  };
});

const norm = (v) =>
  String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const weekOf = (value) => {
  const date = String(value || "").slice(0, 10);
  return WEEKS.find(
    (w) => date >= w.start && date <= w.end
  )?.number ?? null;
};

const todayWITA = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const formatDate = (value) => {
  const s = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d\d-\d\d$/.test(s)) return "—";
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
};

const categoryOf = (record, typeMap) => {
  const name = typeMap[record.type_code]
    || record.type_code
    || "Lainnya";

  return TARGETS.find(
    (c) => norm(c.name) === norm(name)
  )?.name || name;
};

const numberOf = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

const evidenceUrl = (record) => {
  const found = String(record.description || "")
    .match(/https?:\/\/[^\s<>'"]+/i)?.[0];

  return [
    record.evidence_url,
    record.documentation_url,
    record.photo_url,
    record.file_url,
    record.proof_url,
    found,
  ].find(
    (v) => typeof v === "string" && /^https?:\/\//i.test(v)
  ) || null;
};

export default function VerifikasiMonitoringKegiatan() {
  const router = useRouter();

  const [account, setAccount] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [records, setRecords] = useState([]);
  const [types, setTypes] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(false);

  const [statusFilter, setStatusFilter] = useState("pending");
  const [weekFilter, setWeekFilter] = useState("all");
  const [monitorWeek, setMonitorWeek] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [expandedId, setExpandedId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);

  // GLOBAL THEME DAN MINGGU
  useEffect(() => {
    try {
      const theme =
        localStorage.getItem("ojt-minetrack-theme") ||
        document.documentElement.getAttribute("data-theme") ||
        "light";

      setDark(theme === "dark");
    } catch {}

    setMonitorWeek(weekOf(todayWITA()) || 1);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);

    document.documentElement.setAttribute(
      "data-theme",
      next ? "dark" : "light"
    );
    document.documentElement.style.colorScheme =
      next ? "dark" : "light";

    try {
      localStorage.setItem(
        "ojt-minetrack-theme",
        next ? "dark" : "light"
      );
    } catch {}
  }

  // LOAD SUPABASE
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const auth = await supabase.auth.getUser();
        const user = auth.data?.user;

        if (auth.error || !user) {
          router.replace("/login");
          return;
        }

        const profileRes = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileRes.error) throw profileRes.error;

        const profile = profileRes.data;
        const role = String(profile?.role || "")
          .trim().toLowerCase();

        if (!["admin", "mentor"].includes(role)) {
          throw new Error(
            "Halaman hanya dapat diakses Admin dan Mentor."
          );
        }

        // Pertahankan Maintenance Mode existing
        const settingRes = await supabase
          .from("app_settings")
          .select("maintenance_mode")
          .eq("id", 1)
          .maybeSingle();

        if (settingRes.error) throw settingRes.error;

        if (
          settingRes.data?.maintenance_mode &&
          role !== "admin"
        ) {
          throw new Error(
            "Maintenance Mode aktif. Akses Mentor sementara ditutup."
          );
        }

        const [programRes, typeRes] = await Promise.all([
          supabase
            .from("ojt_programs")
            .select(
              "id,participant_id,start_date,end_date,status,site"
            )
            .eq("status", "active")
            .order("start_date", { ascending: false }),

          supabase
            .from("achievement_types")
            .select("code,name"),
        ]);

        if (programRes.error) throw programRes.error;
        if (typeRes.error) throw typeRes.error;

        const activePrograms = programRes.data || [];
        const participantIds = [
          ...new Set(
            activePrograms.map((p) => p.participant_id)
              .filter(Boolean)
          ),
        ];

        let participantProfiles = [];

        if (participantIds.length) {
          const result = await supabase
            .from("profiles")
            .select("id,full_name,department")
            .in("id", participantIds);

          if (result.error) throw result.error;
          participantProfiles = result.data || [];
        }

        const profileMap = new Map(
          participantProfiles.map((p) => [p.id, p])
        );

        const ids = activePrograms.map((p) => p.id);
        const allRecords = [];

        // Pagination agar tidak hanya membaca 1000 data
        for (let start = 0; start < ids.length; start += 40) {
          const chunk = ids.slice(start, start + 40);
          let offset = 0;

          while (true) {
            const result = await supabase
              .from("achievement_records")
              .select("*")
              .in("program_id", chunk)
              .order("created_at", { ascending: false })
              .range(offset, offset + 999);

            if (result.error) throw result.error;

            const batch = result.data || [];
            allRecords.push(...batch);

            if (batch.length < 1000) break;
            offset += 1000;
          }
        }

        if (!mounted) return;

        setAccount({ ...profile, role });
        setPrograms(
          activePrograms.map((p) => ({
            ...p,
            peserta: profileMap.get(p.participant_id) || null,
          }))
        );
        setTypes(
          Object.fromEntries(
            (typeRes.data || []).map((t) => [t.code, t.name])
          )
        );
        setRecords(allRecords);
      } catch (err) {
        if (mounted) {
          setError(err.message || "Gagal mengambil data OJT.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [reload, router]);

  // FILTER DATA
  const sites = useMemo(
    () => [
      ...new Set(programs.map((p) => p.site).filter(Boolean)),
    ].sort(),
    [programs]
  );

  const scopedPrograms = useMemo(
    () => programs.filter(
      (p) =>
        (siteFilter === "all" || p.site === siteFilter) &&
        (programFilter === "all" || p.id === programFilter)
    ),
    [programs, siteFilter, programFilter]
  );

  const programMap = useMemo(
    () => new Map(programs.map((p) => [p.id, p])),
    [programs]
  );

  const scopedIds = useMemo(
    () => new Set(scopedPrograms.map((p) => p.id)),
    [scopedPrograms]
  );

  const scopedRecords = useMemo(
    () => records.filter((r) => scopedIds.has(r.program_id)),
    [records, scopedIds]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return scopedRecords
      .filter((r) => {
        const peserta =
          programMap.get(r.program_id)?.peserta?.full_name || "";

        const combined = [
          peserta,
          types[r.type_code],
          r.description,
        ].join(" ").toLowerCase();

        return (
          (statusFilter === "all" ||
            r.status === statusFilter) &&
          (weekFilter === "all" ||
            weekOf(r.activity_date) === Number(weekFilter)) &&
          (categoryFilter === "all" ||
            categoryOf(r, types) === categoryFilter) &&
          (!q || combined.includes(q))
        );
      })
      .sort((a, b) =>
        String(b.activity_date || "").localeCompare(
          String(a.activity_date || "")
        )
      );
  }, [
    scopedRecords,
    programMap,
    types,
    search,
    statusFilter,
    weekFilter,
    categoryFilter,
  ]);

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [
    statusFilter,
    weekFilter,
    categoryFilter,
    siteFilter,
    programFilter,
    search,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * 10,
    currentPage * 10
  );

  const pending = scopedRecords.filter(
    (r) => r.status === "pending"
  ).length;

  const verified = scopedRecords.filter(
    (r) => r.status === "verified"
  ).length;

  const pagePending = visible.filter(
    (r) => r.status === "pending"
  );

  const selectedPending = visible.filter(
    (r) => r.status === "pending" && selected.includes(r.id)
  );

  // MONITORING ENAM KATEGORI
  const monitoring = useMemo(
    () => TARGETS.map((category) => {
      const relevant = scopedRecords.filter(
        (r) =>
          r.status === "verified" &&
          weekOf(r.activity_date) === monitorWeek &&
          categoryOf(r, types) === category.name
      );

      const done = category.name === "Fisik"
        ? relevant.reduce(
            (sum, r) => sum + numberOf(r.distance_km),
            0
          )
        : relevant.length;

      const target = category.target * scopedPrograms.length;

      return {
        ...category,
        done,
        target,
        percent: target
          ? Math.min(100, Math.round(done / target * 100))
          : 0,
      };
    }),
    [scopedRecords, scopedPrograms.length, monitorWeek, types]
  );

  const trend = useMemo(
    () => WEEKS.map(
      (w) => scopedRecords.filter(
        (r) =>
          r.status === "verified" &&
          weekOf(r.activity_date) === w.number
      ).length
    ),
    [scopedRecords]
  );

  const maxTrend = Math.max(1, ...trend);
  const chartPoints = trend.map(
    (n, i) => `${16 + i * 15.7},${118 - (n / maxTrend) * 95}`
  ).join(" ");

  // VERIFIKASI MENGGUNAKAN LOGIKA EXISTING
  async function verifyRows(items) {
    if (saving || loading || !account || !items.length) return;

    if (!window.confirm(
      `Verifikasi ${items.length} kegiatan yang dipilih?`
    )) return;

    setSaving(true);
    setError("");
    setMessage("");

    let success = 0;
    const failures = [];

    try {
      for (const record of items) {
        if (
          record.status !== "pending" ||
          !scopedIds.has(record.program_id)
        ) continue;

        if (
          categoryOf(record, types) === "Fisik" &&
          numberOf(record.distance_km) <= 0
        ) {
          failures.push("Jarak kegiatan Fisik tidak valid.");
          continue;
        }

        const result = await supabase
          .from("achievement_records")
          .update({
            status: "verified",
            verified_by: account.id,
          })
          .eq("id", record.id)
          .eq("program_id", record.program_id)
          .eq("status", "pending")
          .select("id");

        if (result.error) {
          failures.push(result.error.message);
        } else if (!result.data?.length) {
          failures.push(
            "Data tidak berubah. Periksa izin RLS atau status terbaru."
          );
        } else {
          success += 1;
        }
      }

      if (success > 0) {
        setMessage(`${success} kegiatan berhasil diverifikasi.`);
        setSelected([]);
        setReload((n) => n + 1);
      }

      if (failures.length) {
        setError(`${failures.length} gagal: ${failures[0]}`);
      }
    } catch (err) {
      setError(err.message || "Verifikasi gagal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`vm ${dark ? "dark" : ""}`}>
      <aside className="vm-sidebar">
        <div className="vm-logo">
          ⛑️ OJT <b>MineTrack</b><small>v2.0</small>
        </div>

        <div className="vm-brandpanel">
          <strong>EMERGENCY RESPONSE GROUP</strong>
          <span>PT BERAU COAL</span>
        </div>

        <nav className="vm-nav">
          <button onClick={() => router.push("/")}>
            ⌂ <span>Dashboard</span>
          </button>
          <button
            onClick={() => router.push("/mentor/daftar-peserta")}
          >
            👥 <span>Peserta OJT</span>
          </button>
          <button className="active" aria-current="page">
            ✓ <span>Verifikasi & Monitoring</span>
            {pending > 0 && <em>{pending}</em>}
          </button>
          <button
            onClick={() =>
              router.push("/mentor/monitoring-peserta")
            }
          >
            ▥ <span>Monitoring Peserta</span>
          </button>
        </nav>

        <div className="vm-sidefooter">
          Program OJT 2026–2027
          <br />
          Week 01–25 · PMO · TSP
        </div>
      </aside>

      <main className="vm-main">
        <header className="vm-topbar">
          <div className="vm-topinfo">
            <strong>Program OJT 2026–2027</strong>
            <span className="vm-pill">
              Week {pad(monitorWeek)}
              {" · "}
              {WEEKS[monitorWeek - 1]?.start}
              {" – "}
              {WEEKS[monitorWeek - 1]?.end}
            </span>
          </div>

          <div className="vm-account">
            <button className="vm-soft" onClick={toggleTheme}>
              {dark ? "☀️ Terang" : "🌙 Gelap"}
            </button>
            <div>
              <strong>
                {account?.full_name || "Mentor / Admin"}
              </strong>
              <small>{account?.role || ""}</small>
            </div>
          </div>
        </header>

        <div className="vm-content">
          <div className="vm-heading">
            <div>
              <h1>✅ Verifikasi & Monitoring Kegiatan</h1>
              <p>
                Periksa kegiatan mandiri peserta dan pantau
                pencapaian mingguan dari satu halaman.
              </p>
            </div>

            <button
              className="vm-soft"
              disabled={loading || saving}
              onClick={() => setReload((n) => n + 1)}
            >
              ↻ Refresh
            </button>
          </div>

          {error && (
            <div className="vm-alert error" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="vm-alert success" role="status">
              {message}
            </div>
          )}

          {loading && (
            <div className="vm-alert">
              Mengambil data OJT dan memeriksa akses...
            </div>
          )}

          {!loading && account && (
            <>
              <section className="vm-kpis">
                <div className="vm-kpi cream">
                  <span>⌛ Menunggu Verifikasi</span>
                  <strong>{pending}</strong>
                  <small>Kegiatan pending</small>
                </div>

                <div className="vm-kpi mint">
                  <span>✅ Terverifikasi</span>
                  <strong>{verified}</strong>
                  <small>Kegiatan verified</small>
                </div>

                <div className="vm-kpi sky">
                  <span>👥 Peserta Aktif</span>
                  <strong>{scopedPrograms.length}</strong>
                  <small>Program aktif</small>
                </div>

                <div className="vm-kpi lilac">
                  <span>▤ Total Kegiatan</span>
                  <strong>{scopedRecords.length}</strong>
                  <small>Seluruh status</small>
                </div>
              </section>

              <div className="vm-columns">
                <section className="vm-panel">
                  <div className="vm-panelheading">
                    <h2>Daftar Kegiatan Peserta</h2>
                    <small>{filtered.length} kegiatan</small>
                  </div>

                  <div className="vm-tabs">
                    {[
                      { id: "pending", label: "Menunggu" },
                      { id: "verified", label: "Terverifikasi" },
                      { id: "all", label: "Semua" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        className={
                          statusFilter === tab.id ? "active" : ""
                        }
                        onClick={() => setStatusFilter(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="vm-filters">
                    <input
                      placeholder="Cari peserta atau kegiatan..."
                      aria-label="Cari kegiatan"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />

                    <select
                      value={weekFilter}
                      onChange={(e) =>
                        setWeekFilter(e.target.value)
                      }
                      aria-label="Filter minggu"
                    >
                      <option value="all">Semua Minggu</option>
                      {WEEKS.map((w) => (
                        <option key={w.number} value={w.number}>
                          Week {pad(w.number)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={categoryFilter}
                      onChange={(e) =>
                        setCategoryFilter(e.target.value)
                      }
                      aria-label="Filter kategori"
                    >
                      <option value="all">Semua Kategori</option>
                      {TARGETS.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={siteFilter}
                      onChange={(e) => {
                        setSiteFilter(e.target.value);
                        setProgramFilter("all");
                      }}
                      aria-label="Filter site"
                    >
                      <option value="all">Semua Site</option>
                      {sites.map((site) => (
                        <option key={site} value={site}>
                          {site}
                        </option>
                      ))}
                    </select>

                    <select
                      value={programFilter}
                      onChange={(e) =>
                        setProgramFilter(e.target.value)
                      }
                      aria-label="Filter peserta"
                    >
                      <option value="all">Semua Peserta</option>
                      {programs
                        .filter(
                          (p) =>
                            siteFilter === "all" ||
                            p.site === siteFilter
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.peserta?.full_name || "Peserta OJT"}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="vm-tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              aria-label="Pilih semua pending"
                              checked={
                                pagePending.length > 0 &&
                                pagePending.every((r) =>
                                  selected.includes(r.id)
                                )
                              }
                              onChange={(e) => {
                                setSelected((prev) =>
                                  e.target.checked
                                    ? [
                                        ...new Set([
                                          ...prev,
                                          ...pagePending.map(
                                            (r) => r.id
                                          ),
                                        ]),
                                      ]
                                    : prev.filter(
                                        (id) =>
                                          !pagePending.some(
                                            (r) => r.id === id
                                          )
                                      )
                                );
                              }}
                            />
                          </th>
                          <th>Peserta</th>
                          <th>Kegiatan</th>
                          <th>Realisasi</th>
                          <th>Tanggal</th>
                          <th>Status / Aksi</th>
                        </tr>
                      </thead>

                      <tbody>
                        {visible.map((r) => {
                          const program = programMap.get(
                            r.program_id
                          );
                          const category = categoryOf(r, types);
                          const proof = evidenceUrl(r);

                          return (
                            <tr key={r.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  disabled={
                                    r.status !== "pending" || saving
                                  }
                                  checked={selected.includes(r.id)}
                                  onChange={(e) =>
                                    setSelected((prev) =>
                                      e.target.checked
                                        ? [...prev, r.id]
                                        : prev.filter(
                                            (id) => id !== r.id
                                          )
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <strong>
                                  {program?.peserta?.full_name ||
                                    "Peserta OJT"}
                                </strong>
                                <small>{program?.site || "—"}</small>
                              </td>

                              <td>
                                <b className="vm-categorybadge">
                                  {category}
                                </b>
                                <small className="vm-ellipsis">
                                  {r.description ||
                                    "Tidak ada keterangan"}
                                </small>

                                <button
                                  className="vm-link"
                                  onClick={() =>
                                    setExpandedId(
                                      expandedId === r.id
                                        ? null
                                        : r.id
                                    )
                                  }
                                >
                                  {expandedId === r.id
                                    ? "Tutup detail"
                                    : "Lihat detail"}
                                </button>

                                {expandedId === r.id && (
                                  <div className="vm-detail">
                                    <b>Detail kegiatan</b>
                                    <p>
                                      {r.description ||
                                        "Tidak ada keterangan."}
                                    </p>

                                    {proof ? (
                                      <a
                                        href={proof}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        Buka bukti dokumentasi ↗
                                      </a>
                                    ) : (
                                      <small>
                                        Belum ada tautan bukti yang
                                        terbaca pada catatan.
                                      </small>
                                    )}

                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/achievement/${r.program_id}`
                                        )
                                      }
                                    >
                                      Buka halaman peserta ↗
                                    </button>
                                  </div>
                                )}
                              </td>

                              <td>
                                {category === "Fisik"
                                  ? `${numberOf(
                                      r.distance_km
                                    ).toLocaleString("id-ID")} km`
                                  : "1 kegiatan"}
                              </td>

                              <td>
                                {formatDate(r.activity_date)}
                                <small>
                                  Week{" "}
                                  {weekOf(r.activity_date)
                                    ? pad(weekOf(r.activity_date))
                                    : "—"}
                                </small>
                              </td>

                              <td>
                                <span
                                  className={`vm-status ${
                                    r.status === "verified"
                                      ? "green"
                                      : r.status === "pending"
                                      ? "amber"
                                      : "gray"
                                  }`}
                                >
                                  {r.status || "—"}
                                </span>

                                {r.status === "pending" && (
                                  <button
                                    className="vm-verify"
                                    disabled={saving}
                                    onClick={() =>
                                      verifyRows([r])
                                    }
                                  >
                                    ✓ Verifikasi
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {!visible.length && (
                      <div className="vm-empty">
                        Tidak ada kegiatan sesuai filter.
                      </div>
                    )}
                  </div>

                  <div className="vm-bottom">
                    <span>{selected.length} dipilih</span>

                    <button
                      className="vm-verify"
                      disabled={!selectedPending.length || saving}
                      onClick={() => verifyRows(selectedPending)}
                    >
                      {saving
                        ? "Memverifikasi..."
                        : `✓ Verifikasi Terpilih (${selectedPending.length})`}
                    </button>

                    <div className="vm-spacer" />

                    <button
                      className="vm-soft"
                      disabled={currentPage <= 1}
                      onClick={() =>
                        setPage((p) => Math.max(1, p - 1))
                      }
                    >
                      ‹
                    </button>

                    <span>{currentPage} / {totalPages}</span>

                    <button
                      className="vm-soft"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setPage((p) =>
                          Math.min(totalPages, p + 1)
                        )
                      }
                    >
                      ›
                    </button>
                  </div>

                  <p className="vm-note">
                    Kegiatan yang perlu diperbaiki dapat dibuka
                    melalui halaman peserta. Tidak ada status
                    penolakan baru yang ditambahkan ke database.
                  </p>
                </section>

                <aside className="vm-monitor">
                  <section className="vm-panel">
                    <div className="vm-panelheading">
                      <h2>Monitoring Pencapaian</h2>

                      <select
                        value={monitorWeek}
                        onChange={(e) =>
                          setMonitorWeek(Number(e.target.value))
                        }
                      >
                        {WEEKS.map((w) => (
                          <option key={w.number} value={w.number}>
                            Week {pad(w.number)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="vm-note">
                      Target gabungan {scopedPrograms.length} peserta
                      aktif pada minggu terpilih. Hanya data verified.
                    </p>

                    <div className="vm-categories">
                      {monitoring.map((c) => (
                        <div key={c.name} className="vm-progressitem">
                          <div className="vm-progresslabel">
                            <span>
                              {c.icon} {c.name}
                            </span>
                            <b>
                              {c.done.toLocaleString("id-ID", {
                                maximumFractionDigits: 2,
                              })}{" "}
                              / {c.target} {c.unit}
                            </b>
                          </div>

                          <div className="vm-progress">
                            <div
                              style={{ width: `${c.percent}%` }}
                            />
                          </div>
                          <small>{c.percent}%</small>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="vm-panel">
                    <div className="vm-panelheading">
                      <h2>Tren Verified · 25 Minggu</h2>
                    </div>

                    <p className="vm-note">
                      Jumlah kegiatan terverifikasi per minggu,
                      bukan persentase kelulusan.
                    </p>

                    <svg
                      className="vm-chart"
                      viewBox="0 0 420 150"
                      role="img"
                      aria-label="Grafik kegiatan verified selama 25 minggu"
                    >
                      {[23, 71, 118].map((y) => (
                        <line
                          key={y}
                          x1="15"
                          x2="406"
                          y1={y}
                          y2={y}
                          stroke="currentColor"
                          opacity=".14"
                        />
                      ))}

                      <polyline
                        points={chartPoints}
                        fill="none"
                        stroke="#0c9b74"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />

                      {trend.map((count, i) => (
                        <circle
                          key={i}
                          cx={16 + i * 15.7}
                          cy={118 - (count / maxTrend) * 95}
                          r="2.6"
                          fill="#0c9b74"
                        >
                          <title>
                            {`Week ${pad(i + 1)}: ${count} kegiatan`}
                          </title>
                        </circle>
                      ))}

                      <text x="16" y="141" fontSize="11" fill="currentColor">
                        W01
                      </text>
                      <text x="195" y="141" fontSize="11" fill="currentColor">
                        W13
                      </text>
                      <text x="380" y="141" fontSize="11" fill="currentColor">
                        W25
                      </text>
                    </svg>

                    <p className="vm-note">
                      Pilih peserta pada filter untuk melihat
                      tren pencapaiannya.
                    </p>
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>

      <style jsx>{`
        .vm {
          --paper: #ffffff;
          --bg: #f4f7f7;
          --fg: #203342;
          --muted: #71818b;
          --line: #e2e9ec;
          min-height: 100vh;
          background: var(--bg);
          color: var(--fg);
          font-family: Arial, Helvetica, sans-serif;
          display: grid;
          grid-template-columns: 236px minmax(0, 1fr);
        }
        .vm.dark {
          --paper: #192a32;
          --bg: #10202a;
          --fg: #e6f3f0;
          --muted: #adc0c6;
          --line: #34464e;
        }
        .vm * { box-sizing: border-box; }
        .vm button, .vm input, .vm select { font: inherit; }
        .vm button { cursor: pointer; }
        .vm button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }
        .vm-sidebar {
          background: linear-gradient(165deg,#102d41,#092e38 68%,#087f60);
          color: #fff;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .vm-logo {
          font-size: 23px;
          font-weight: 800;
          padding: 27px 17px 25px;
          white-space: nowrap;
        }
        .vm-logo b { color: #5cdb8d; }
        .vm-logo small {
          font-size: 10px;
          margin-left: 4px;
          color: #ccd9da;
        }
        .vm-brandpanel {
          padding: 22px 18px;
          background: linear-gradient(110deg,#234956,#0d6b58);
          font-size: 12px;
          letter-spacing: 1px;
          line-height: 1.7;
        }
        .vm-brandpanel span {
          display: block;
          color: #c9e9df;
          font-size: 10px;
        }
        .vm-nav {
          display: grid;
          gap: 6px;
          padding: 22px 12px;
        }
        .vm-nav button {
          border: 0;
          text-align: left;
          color: #d8e8e9;
          background: transparent;
          padding: 13px 12px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .vm-nav button.active {
          color: white;
          background: #0c9f78;
        }
        .vm-nav em {
          margin-left: auto;
          border-radius: 15px;
          padding: 3px 7px;
          background: #eefff8;
          color: #087151;
          font-size: 11px;
          font-style: normal;
        }
        .vm-sidefooter {
          margin-top: auto;
          padding: 20px;
          font-size: 11px;
          line-height: 1.8;
          color: #c3e8d9;
        }
        .vm-main { min-width: 0; }
        .vm-topbar {
          background: var(--paper);
          padding: 18px 25px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          border-bottom: 1px solid var(--line);
        }
        .vm-topinfo, .vm-account {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .vm-topinfo strong { font-size: 13px; }
        .vm-pill {
          background: #e4f8ee;
          color: #16744e;
          border-radius: 30px;
          padding: 8px 11px;
          font-size: 11px;
          font-weight: 700;
        }
        .vm-account { margin-left: auto; }
        .vm-account strong {
          display: block;
          font-size: 12px;
          text-align: right;
        }
        .vm-account small {
          display: block;
          color: #20a576;
          text-align: right;
          text-transform: capitalize;
        }
        .vm-content {
          padding: 22px;
          max-width: 1700px;
          margin: auto;
        }
        .vm-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
        }
        .vm-heading h1 {
          font-size: 23px;
          margin: 0 0 7px;
        }
        .vm-heading p, .vm-note {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
          margin: 0;
        }
        .vm-soft {
          border: 1px solid var(--line);
          background: var(--paper);
          color: var(--fg);
          border-radius: 9px;
          padding: 10px 13px;
          white-space: nowrap;
          font-size: 12px;
        }
        .vm-alert {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 13px 16px;
          margin-bottom: 14px;
          background: var(--paper);
          font-size: 13px;
        }
        .vm-alert.error {
          background: #fff0f0;
          color: #b91c1c;
          border-color: #fecaca;
        }
        .vm-alert.success {
          background: #e8f8f1;
          color: #047857;
          border-color: #a4dfc2;
        }
        .vm-kpis {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 11px;
          margin-bottom: 14px;
        }
        .vm-kpi {
          border-radius: 15px;
          padding: 18px;
          min-width: 0;
        }
        .vm-kpi.cream { background: #fff6dd; color: #6e5120; }
        .vm-kpi.mint { background: #def7e8; color: #196147; }
        .vm-kpi.sky { background: #e3f2ff; color: #225c81; }
        .vm-kpi.lilac { background: #f0eaff; color: #514385; }
        .vm-kpi span, .vm-kpi small {
          display: block;
          font-size: 12px;
          font-weight: 700;
        }
        .vm-kpi strong {
          font-size: 31px;
          display: block;
          margin: 7px 0;
        }
        .vm-kpi small { font-weight: 400; font-size: 11px; }
        .vm-columns {
          display: grid;
          grid-template-columns: minmax(0,1.7fr) minmax(310px,.9fr);
          gap: 14px;
          align-items: start;
        }
        .vm-panel {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 15px;
          padding: 15px;
          box-shadow: 0 3px 16px #1233290a;
          min-width: 0;
        }
        .vm-panelheading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }
        .vm-panelheading h2 { font-size: 16px; margin: 0; }
        .vm-panelheading small {
          color: var(--muted);
          font-size: 11px;
        }
        .vm-panel select,
        .vm-filters select,
        .vm-filters input {
          background: var(--paper);
          color: var(--fg);
          border: 1px solid var(--line);
          padding: 10px;
          border-radius: 8px;
          min-width: 0;
          font-size: 12px;
        }
        .vm-tabs {
          display: flex;
          gap: 5px;
          margin-bottom: 13px;
          background: var(--bg);
          padding: 5px;
          border-radius: 10px;
        }
        .vm-tabs button {
          flex: 1;
          padding: 10px 7px;
          border: 0;
          background: transparent;
          color: var(--muted);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
        }
        .vm-tabs button.active {
          background: #0d946c;
          color: white;
        }
        .vm-filters {
          display: grid;
          grid-template-columns: 1.7fr 1fr 1.2fr;
          gap: 7px;
          margin-bottom: 14px;
        }
        .vm-tablewrap { overflow-x: auto; }
        .vm-tablewrap table {
          width: 100%;
          min-width: 730px;
          border-collapse: collapse;
          font-size: 12px;
        }
        .vm-tablewrap th {
          text-align: left;
          font-size: 11px;
          background: var(--bg);
          padding: 11px 8px;
        }
        .vm-tablewrap td {
          vertical-align: top;
          padding: 12px 8px;
          border-bottom: 1px solid var(--line);
        }
        .vm-tablewrap td strong { font-size: 12px; }
        .vm-tablewrap td small {
          display: block;
          font-size: 10px;
          color: var(--muted);
          margin-top: 5px;
        }
        .vm-ellipsis {
          max-width: 205px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vm-categorybadge {
          display: inline-block;
          font-size: 11px;
          color: #167c60;
          background: #dff7ed;
          border-radius: 6px;
          padding: 4px 6px;
        }
        .vm-link {
          display: block;
          border: 0;
          background: none;
          color: #0f9d79;
          font-size: 11px;
          padding: 7px 0 0;
          text-align: left;
        }
        .vm-detail {
          margin-top: 8px;
          border-radius: 9px;
          padding: 10px;
          background: var(--bg);
          max-width: 250px;
          overflow-wrap: anywhere;
        }
        .vm-detail p {
          line-height: 1.5;
          margin: 8px 0;
        }
        .vm-detail a, .vm-detail button {
          display: block;
          margin: 8px 0;
          color: #0f9d79;
          font-size: 11px;
        }
        .vm-detail button {
          border: 0;
          background: none;
          padding: 0;
        }
        .vm-status {
          display: inline-block;
          border-radius: 15px;
          font-size: 10px;
          font-weight: 800;
          padding: 5px 8px;
        }
        .vm-status.amber {
          background: #fff0bf;
          color: #956318;
        }
        .vm-status.green {
          background: #dff8e9;
          color: #087e50;
        }
        .vm-status.gray {
          background: #edf1f4;
          color: #657481;
        }
        .vm-verify {
          border: 0;
          border-radius: 7px;
          background: #098c64;
          color: #fff;
          padding: 9px 10px;
          font-weight: 700;
          font-size: 11px;
          white-space: nowrap;
        }
        .vm-tablewrap .vm-verify {
          display: block;
          margin-top: 7px;
        }
        .vm-empty {
          padding: 30px 12px;
          text-align: center;
          color: var(--muted);
          font-size: 12px;
        }
        .vm-bottom {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 11px;
          padding-top: 14px;
        }
        .vm-spacer { flex: 1; }
        .vm-panel > .vm-note { margin-top: 12px; }
        .vm-monitor {
          display: grid;
          gap: 14px;
        }
        .vm-categories {
          display: grid;
          gap: 18px;
          margin: 21px 0 8px;
        }
        .vm-progressitem {
          display: grid;
          grid-template-columns: minmax(0,1fr) 46px;
          gap: 7px;
          align-items: center;
        }
        .vm-progresslabel {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          font-size: 12px;
        }
        .vm-progresslabel b {
          font-size: 11px;
          white-space: nowrap;
        }
        .vm-progress {
          background: var(--line);
          height: 10px;
          border-radius: 9px;
          overflow: hidden;
        }
        .vm-progress > div {
          height: 100%;
          background: linear-gradient(90deg,#40c998,#079065);
          border-radius: inherit;
        }
        .vm-progressitem > small {
          color: var(--muted);
          text-align: right;
          font-size: 11px;
        }
        .vm-chart {
          width: 100%;
          height: auto;
          margin-top: 15px;
          overflow: visible;
        }
        @media (max-width: 1200px) {
          .vm-columns { grid-template-columns: 1fr; }
          .vm-monitor { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 820px) {
          .vm { display: block; }
          .vm-sidebar { min-height: 0; }
          .vm-logo { padding: 15px; }
          .vm-brandpanel, .vm-sidefooter { display: none; }
          .vm-nav {
            display: flex;
            overflow-x: auto;
            padding: 8px;
          }
          .vm-nav button { flex: 0 0 auto; }
          .vm-topbar { padding: 13px; }
          .vm-content { padding: 12px; }
          .vm-kpis {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
          .vm-monitor { grid-template-columns: 1fr; }
          .vm-heading h1 { font-size: 19px; }
          .vm-filters {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
          .vm-filters input { grid-column: 1 / -1; }
        }
        @media (max-width: 450px) {
          .vm-topbar {
            flex-direction: column;
            align-items: stretch;
          }
          .vm-account {
            margin-left: 0;
            justify-content: space-between;
          }
          .vm-heading h1 { font-size: 17px; }
          .vm-heading p { font-size: 11px; }
          .vm-kpi { padding: 13px; }
          .vm-kpi strong { font-size: 24px; }
          .vm-panel { padding: 12px; }
        }
      `}</style>
    </div>
  );
}
