"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0 — ANTREAN VERIFIKASI KEGIATAN
// Simpan sebagai: app/mentor/verifikasi-kegiatan/page.jsx
//
// - Membaca Achievement Pending peserta yang boleh dikelola
// - Membaca pengajuan Praktik Pending dari metadata notes
// - Verifikasi Achievement melalui RLS asli (tanpa SQL/RPC baru)
// - Praktik dibuka pada modul verifikasi Praktik yang sudah ada
// - Tidak mengubah nilai, kalender, tabel, atau hak akses
// =====================================================

const BUCKET = "achievement-files";
const FILE_RE = /\[\[OJT_FILE_V1:([\s\S]*?)\]\]/g;
const REVIEW_RE = /\[\[OJT_PRACTICE_REVIEW_V1:([\s\S]*?)\]\]/g;
const WEEK_START = Date.UTC(2026, 8, 12);

function normalized(value) { return String(value || "").trim().toLowerCase(); }
function fmtDate(value) {
  const part = String(value || "").slice(0, 10).split("-");
  return part.length === 3 ? `${part[2]}/${part[1]}/${part[0]}` : "—";
}
function weekOf(date) {
  const match = String(date || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const dt = Date.UTC(+match[1], +match[2] - 1, +match[3]);
  if (!Number.isFinite(dt) || dt < WEEK_START || dt > Date.UTC(2027, 2, 6)) return null;
  if (dt <= Date.UTC(2026, 8, 18)) return 1;
  if (dt === Date.UTC(2026, 8, 19)) return null;
  return 2 + Math.floor((dt - Date.UTC(2026, 8, 20)) / 604800000);
}
function stripMeta(notes) {
  return String(notes || "").replace(FILE_RE, "").replace(REVIEW_RE, "").trim();
}
function decodeMeta(raw, regex) {
  const source = String(raw || "");
  const pattern = new RegExp(regex.source, "g");
  let found = null;
  for (const match of source.matchAll(pattern)) {
    try { found = JSON.parse(decodeURIComponent(match[1])); } catch { /* ignore invalid metadata */ }
  }
  return found;
}
function getEvidence(raw, programId) {
  const meta = decodeMeta(raw, FILE_RE);
  const path = typeof meta?.path === "string" ? meta.path : "";
  if (!path.startsWith(`${programId}/`)) return null;
  return { name: String(meta?.name || "Dokumentasi"), path };
}
function composePracticeNotes(text, evidence, review) {
  const parts = [];
  if (String(text || "").trim()) parts.push(String(text).trim());
  if (evidence?.path) {
    parts.push(`[[OJT_FILE_V1:${encodeURIComponent(JSON.stringify({name: evidence.name, path: evidence.path}))}]]`);
  }
  if (review) parts.push(`[[OJT_PRACTICE_REVIEW_V1:${encodeURIComponent(JSON.stringify(review))}]]`);
  return parts.join("\n") || null;
}
function getReview(raw) {
  const meta = decodeMeta(raw, REVIEW_RE);
  const score = Number(meta?.submittedScore);
  if (meta?.status !== "pending" || !Number.isFinite(score) || score < 0 || score > 100) return null;
  return { ...meta, submittedScore: score };
}

export default function VerifikasiKegiatanPage() {
  const router = useRouter();
  const busy = useRef(false);
  const [account, setAccount] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [active, setActive] = useState(null);
  const [checked, setChecked] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [site, setSite] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) { router.replace("/login"); return; }
      const user = userData.user;
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("id,full_name,role").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      const role = normalized(profile?.role);
      if (!["admin", "mentor"].includes(role)) {
        throw new Error("Halaman ini hanya dapat diakses oleh Admin atau Mentor OJT.");
      }
      setAccount({ ...profile, role });

      let programQuery = supabase.from("ojt_programs")
        .select("id,participant_id,mentor_id,site,status,start_date")
        .eq("status", "active");
      if (role === "mentor") programQuery = programQuery.eq("mentor_id", user.id);
      const { data: programs, error: programError } = await programQuery;
      if (programError) throw programError;
      const allowed = programs || [];
      if (!allowed.length) { setItems([]); return; }
      const ids = allowed.map(p => p.id);
      const participantIds = [...new Set(allowed.map(p => p.participant_id).filter(Boolean))];

      const [peopleRes, typesRes, achievementRes, practiceRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,department").in("id", participantIds),
        supabase.from("achievement_types").select("code,name"),
        supabase.from("achievement_records")
          .select("id,program_id,type_code,status,activity_date,description,distance_km")
          .in("program_id", ids).eq("status", "pending"),
        supabase.from("weekly_practice_scores")
          .select("id,program_id,practice_date,practice_name,notes,score")
          .in("program_id", ids),
      ]);
      for (const [name, result] of [["Peserta",peopleRes],["Kategori",typesRes],["Achievement",achievementRes],["Praktik",practiceRes]]) {
        if (result.error) throw new Error(`${name}: ${result.error.message}`);
      }
      const programMap = new Map(allowed.map(p => [p.id, p]));
      const peopleMap = new Map((peopleRes.data || []).map(p => [p.id, p]));
      const typeMap = new Map((typesRes.data || []).map(t => [t.code, t.name]));
      const makeBase = (programId) => {
        const program = programMap.get(programId);
        const person = peopleMap.get(program?.participant_id);
        return {
          programId,
          person: person?.full_name || "Peserta OJT",
          department: person?.department || "—",
          site: program?.site || "—",
        };
      };
      const achievements = (achievementRes.data || []).map(item => ({
        ...makeBase(item.program_id),
        id: item.id, kind: "achievement", date: item.activity_date,
        title: typeMap.get(item.type_code) || item.type_code || "Achievement",
        details: stripMeta(item.description),
        distanceKm: item.distance_km,
        evidence: getEvidence(item.description, item.program_id),
      }));
      const practices = (practiceRes.data || []).flatMap(item => {
        const review = getReview(item.notes);
        if (!review) return [];
        return [{
          ...makeBase(item.program_id),
          id: item.id, kind: "praktik", date: item.practice_date,
          title: item.practice_name || "Praktik", details: stripMeta(item.notes),
          score: review.submittedScore,
          review,
          rawNotes: item.notes,
          evidence: getEvidence(item.notes, item.program_id),
        }];
      });
      setItems([...achievements, ...practices].sort((a,b) => String(b.date).localeCompare(String(a.date))));
    } catch (err) {
      setError(err?.message || "Gagal memuat antrean verifikasi.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const sites = useMemo(() => [...new Set(items.map(item => item.site))].sort(), [items]);
  const filtered = useMemo(() => items.filter(item => {
    if (filter !== "all" && item.kind !== filter) return false;
    if (site !== "all" && item.site !== site) return false;
    if (!search.trim()) return true;
    const blob = [item.person,item.title,item.site,item.department,item.details].join(" ").toLowerCase();
    return blob.includes(search.trim().toLowerCase());
  }), [items, filter, site, search]);
  const achievementCount = items.filter(item => item.kind === "achievement").length;
  const practiceCount = items.filter(item => item.kind === "praktik").length;

  async function openReview(item) {
    setActive(item);
    setChecked(false);
    setPreview(null);
    setError("");
    if (!item.evidence) return;
    setPreviewLoading(true);
    const { data, error: signedError } = await supabase.storage
      .from(BUCKET).createSignedUrl(item.evidence.path, 120);
    if (signedError) setError(`Dokumentasi belum dapat dibuka: ${signedError.message}`);
    else setPreview(data?.signedUrl || null);
    setPreviewLoading(false);
  }

  async function approveAchievement() {
    if (!active || active.kind !== "achievement" || busy.current || !account || !checked) return;
    if (normalized(active.title) === "fisik" && (!(Number(active.distanceKm) > 0))) {
      setError("Jarak Fisik belum valid. Perbaiki dahulu melalui modul Achievement.");
      return;
    }
    busy.current = true;
    setProcessing(active.id);
    setError(""); setMessage("");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user || userData.user.id !== account.id) {
        throw new Error("Sesi Mentor/Admin sudah berubah. Silakan login ulang.");
      }
      // Kewenangan verifikasi tetap diperiksa oleh RLS Supabase.
      const { data, error: updateError } = await supabase.from("achievement_records")
        .update({ status: "verified", verified_by: account.id })
        .eq("id", active.id)
        .eq("program_id", active.programId)
        .eq("status", "pending")
        .select("id");
      if (updateError) throw updateError;
      if (!data?.length) throw new Error("Data tidak berubah. Periksa hak akses atau status kegiatan.");
      setItems(current => current.filter(item => !(item.kind === "achievement" && item.id === active.id)));
      setMessage(`Achievement ${active.person} berhasil diverifikasi.`);
      setActive(null); setPreview(null);
    } catch (err) {
      setError(err?.message || "Gagal memverifikasi Achievement.");
    } finally {
      busy.current = false;
      setProcessing(null);
    }
  }

  async function approvePractice() {
    if (!active || active.kind !== "praktik" || busy.current || !account || !checked) return;
    if (!active.evidence?.path || active.review?.status !== "pending") {
      setError("Praktik Pending harus memiliki bukti yang tercatat sebelum diverifikasi.");
      return;
    }
    const claimed = Number(active.review.submittedScore);
    if (!Number.isFinite(claimed) || claimed < 0 || claimed > 100) {
      setError("Nilai pengajuan Praktik tidak valid.");
      return;
    }
    busy.current = true;
    setProcessing(active.id);
    setError(""); setMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user || auth.user.id !== account.id) {
        throw new Error("Sesi Mentor/Admin sudah berubah. Silakan login kembali.");
      }
      let programQuery = supabase.from("ojt_programs")
        .select("id").eq("id", active.programId).eq("status", "active");
      if (account.role === "mentor") programQuery = programQuery.eq("mentor_id", auth.user.id);
      const { data: program, error: programError } = await programQuery.maybeSingle();
      if (programError || !program?.id) {
        throw new Error("Akun tidak memiliki izin verifikasi program Praktik ini.");
      }
      // Sama dengan protokol penilaian Praktik existing:
      // nilai resmi baru terisi setelah Mentor/Admin menyetujui.
      const approved = {
        ...active.review,
        status: "verified",
        approvedScore: claimed,
        reviewedBy: account.id,
        reviewedAt: new Date().toISOString(),
      };
      const result = await supabase.from("weekly_practice_scores")
        .update({
          score: claimed,
          notes: composePracticeNotes(stripMeta(active.rawNotes), active.evidence, approved),
        })
        .eq("id", active.id)
        .eq("program_id", active.programId)
        .is("score", null)
        .select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("Laporan telah berubah atau tidak bisa diverifikasi.");
      setItems(current => current.filter(item => !(item.kind === "praktik" && item.id === active.id)));
      setMessage(`Nilai Praktik ${active.person} berhasil diverifikasi.`);
      setActive(null); setPreview(null);
    } catch (err) {
      setError(err?.message || "Verifikasi Praktik gagal.");
    } finally {
      busy.current = false;
      setProcessing(null);
    }
  }

  return (
    <div className="vk-shell">
      <aside className="vk-sidebar" aria-label="Navigasi OJT MineTrack">
        <div className="vk-sidebar-brand"><strong>OJT <span>MineTrack</span> <small>v2.0</small></strong><p>Emergency Response Group<br/>PT Berau Coal</p></div>
        <div className="vk-side-section">MENU UTAMA</div>
        <button type="button" onClick={()=>router.push("/")}>⌂ <span>Dashboard Mentor</span></button>
        <button type="button" onClick={()=>router.push("/mentor/monitoring-peserta")}>▥ <span>Monitoring Peserta</span></button>
        <button type="button" className="active">✓ <span>Verifikasi Kegiatan</span></button>
        <button type="button" onClick={()=>router.push("/#jadwal-kegiatan")}>▦ <span>Jadwal Kegiatan Mingguan</span></button>
        <div className="vk-side-section">MANAJEMEN PESERTA</div>
        <button type="button" onClick={()=>router.push("/#daftar-peserta")}>♙ <span>Peserta OJT</span></button>
        <button type="button" onClick={()=>router.push("/mentor/daftar-peserta")}>▤ <span>Pendaftaran Peserta</span></button>
        <button type="button" onClick={()=>router.push("/mentor/persetujuan-peserta")}>✓ <span>Persetujuan Peserta</span></button>
        {account?.role === "admin" && <button type="button" onClick={()=>router.push("/admin/persetujuan-mentor")}>✓ <span>Persetujuan Mentor</span></button>}
        <div className="vk-side-section">EVALUASI &amp; LAPORAN</div>
        <button type="button" onClick={()=>router.push("/#daftar-peserta")}>▥ <span>Monitoring Achievement</span></button>
        <button type="button" onClick={()=>router.push("/#daftar-peserta")}>▤ <span>Laporan Rekap</span></button>
        <div className="vk-side-foot"><div><strong>{account?.full_name || "Mentor OJT"}</strong><small>{account?.role === "admin" ? "Administrator" : "Mentor OJT"}</small></div><button type="button" onClick={load}>↻ <span>Refresh Data</span></button></div>
      </aside>
      <main className="vk-app">
      <style>{css}</style>
      <header className="vk-top">
        <div><strong>OJT <em>MineTrack</em> <small>v2.0</small></strong><span>Emergency Response Group · PT Berau Coal</span></div>
        <div className="vk-top-actions"><button type="button" onClick={() => router.push("/")}>← Dashboard Mentor</button><button type="button" disabled={loading || !!processing} onClick={load}>↻ Refresh</button></div>
      </header>
      <div className="vk-wrap">
        <section className="vk-banner">
          <span>MENU UTAMA / VERIFIKASI KEGIATAN</span>
          <h1>Verifikasi Kegiatan Peserta OJT</h1>
          <p>Antrean Achievement dan Praktik peserta yang menunggu pemeriksaan Mentor/Admin. Tidak perlu memilih peserta satu per satu.</p>
        </section>
        <div className="vk-stats">
          <div><small>TOTAL MENUNGGU</small><strong>{items.length}</strong><span>Pengajuan kegiatan</span></div>
          <div><small>ACHIEVEMENT</small><strong>{achievementCount}</strong><span>Menunggu verifikasi</span></div>
          <div><small>PRAKTIK</small><strong>{practiceCount}</strong><span>Menunggu persetujuan nilai</span></div>
        </div>
        {message && <div className="vk-alert ok" role="status">{message}</div>}
        {error && <div className="vk-alert err" role="alert">{error}</div>}
        <section className="vk-panel">
          <div className="vk-panel-head"><div><h2>Daftar Pengajuan Menunggu Verifikasi</h2><p>Periksa dokumentasi, lalu setujui Achievement atau nilai Praktik langsung dari daftar ini. Untuk koreksi nilai, gunakan modul penilaian Praktik yang sudah tersedia.</p></div></div>
          <div className="vk-filters">
            <div className="vk-tabs">
              {[ ["all","Semua"],["achievement","Achievement"],["praktik","Praktik"] ].map(([key,label]) => <button type="button" key={key} className={filter===key?"on":""} onClick={()=>setFilter(key)}>{label}</button>)}
            </div>
            <select aria-label="Filter site" value={site} onChange={e=>setSite(e.target.value)}><option value="all">Semua Site</option>{sites.map(x=><option key={x} value={x}>{x}</option>)}</select>
            <input type="search" aria-label="Cari pengajuan" placeholder="Cari peserta, kegiatan, site..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          {loading ? <div className="vk-empty">Memuat antrean dari Supabase...</div> : !filtered.length ? <div className="vk-empty">Tidak ada kegiatan Pending yang sesuai filter.</div> : (
            <div className="vk-list">{filtered.map(item => <article className="vk-item" key={`${item.kind}-${item.id}`}>
              <div className="vk-item-main"><span className={`vk-tag ${item.kind}`}>{item.kind === "achievement" ? "Achievement" : "Praktik"}</span><h3>{item.title}</h3><p>{item.person} · {item.department} · {item.site}</p><small>{fmtDate(item.date)} {weekOf(item.date) ? `· Week ${String(weekOf(item.date)).padStart(2,"0")}` : ""} · Menunggu</small><p className="vk-desc">{item.details || "Tidak ada keterangan tambahan."}</p>{item.kind === "praktik" && <strong className="vk-proposed">Nilai diajukan: {item.score}</strong>}</div>
              <div className="vk-item-actions"><button type="button" className="vk-light" onClick={()=>openReview(item)}>Lihat Detail</button><button type="button" className="vk-primary" onClick={()=>openReview(item)}>{item.kind === "praktik" ? "Verifikasi Praktik" : "Verifikasi"}</button></div>
            </article>)}</div>
          )}
        </section>
        <footer className="vk-foot">OJT MineTrack v2.0 · Emergency Response Group · PT Berau Coal</footer>
      </div>
      {active && <div className="vk-overlay" onClick={e=>{if(e.target===e.currentTarget && !processing){setActive(null);setPreview(null);}}}>
        <section className="vk-modal" role="dialog" aria-modal="true" aria-labelledby="vk-modal-title">
          <div className="vk-modal-head"><div><span className="vk-tag">Menunggu</span><h2 id="vk-modal-title">{active.title}</h2><p>{active.person} · {active.site} · {fmtDate(active.date)}</p></div><button type="button" aria-label="Tutup detail" disabled={!!processing} onClick={()=>{setActive(null);setPreview(null);}}>✕</button></div>
          <div className="vk-modal-body"><p>{active.details || "Tidak ada keterangan tambahan."}</p>{active.distanceKm != null && <p>Jarak Fisik: <strong>{active.distanceKm} km</strong></p>}{active.kind==="praktik" && <p>Nilai yang diajukan: <strong>{active.score}</strong></p>}
            <div className="vk-evidence"><strong>Dokumentasi Pendukung</strong>{active.evidence ? (previewLoading ? <p>Membuka dokumentasi...</p> : preview ? <a href={preview} target="_blank" rel="noopener noreferrer">Buka {active.evidence.name} ↗</a> : <p>Dokumentasi tidak dapat ditampilkan. Periksa akses Storage.</p>) : <p>Dokumentasi tidak tercatat pada metadata kegiatan.</p>}</div>
            {error && <div className="vk-alert err" role="alert">{error}</div>}
            <label className="vk-check"><input type="checkbox" checked={checked} disabled={!!processing || previewLoading} onChange={e=>setChecked(e.target.checked)}/> Saya sudah memeriksa informasi kegiatan{active.evidence ? " dan dokumentasi pendukung" : ""}.</label>
            <div className="vk-modal-actions"><button type="button" className="vk-light" disabled={!!processing} onClick={()=>router.push(active.kind==="achievement"?`/achievement/${encodeURIComponent(active.programId)}`:`/praktik/${encodeURIComponent(active.programId)}`)}>Buka Modul untuk Edit/Koreksi</button>{active.kind==="achievement" ? <button type="button" className="vk-primary" disabled={!!processing || !checked} onClick={approveAchievement}>{processing ? "Menyimpan..." : "✓ Setujui Achievement"}</button> : <button type="button" className="vk-primary" disabled={!!processing || !checked || !active.evidence} onClick={approvePractice}>{processing ? "Menyimpan..." : "✓ Setujui Nilai Praktik"}</button>}</div>
          </div>
        </section>
      </div>}
      </main>
    </div>
  );
}

const css = `
.vk-shell,.vk-shell *{box-sizing:border-box}
.vk-shell{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh;background:#071d19;font-family:Arial,Helvetica,sans-serif}
.vk-sidebar{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;overflow-y:auto;padding:22px 16px;background:linear-gradient(160deg,#0b3229,#061a19);border-right:1px solid #2b5042;color:#e6f7ed}
.vk-sidebar-brand{padding:7px 6px 22px;border-bottom:1px solid #366151;margin-bottom:14px}.vk-sidebar-brand strong{font-size:23px}.vk-sidebar-brand span{color:#41dc9a}.vk-sidebar-brand small{font-size:10px}.vk-sidebar-brand p{font-size:11px;line-height:1.6;color:#aac9bc}
.vk-sidebar .vk-side-section{border-top:1px solid #356053;margin-top:14px;padding:20px 8px 10px;color:#81d9ad;font-size:10px;letter-spacing:1.5px;font-weight:900}
.vk-sidebar button{border:0;border-radius:9px;text-align:left;display:flex;align-items:center;gap:12px;background:transparent;color:#e2f5ec;padding:13px 12px;width:100%;font-size:13px;font-weight:700;cursor:pointer}
.vk-sidebar button:hover{background:#205043}.vk-sidebar button.active{background:#068e61;color:#fff}.vk-sidebar button span{line-height:1.5}
.vk-side-foot{margin-top:auto;padding-top:16px;border-top:1px solid #356053}.vk-side-foot>div{border:1px solid #396351;padding:11px;margin-bottom:8px;border-radius:10px}.vk-side-foot strong,.vk-side-foot small{display:block}.vk-side-foot small{font-size:11px;margin-top:5px;color:#a5c6b7}
.vk-app,.vk-app *{box-sizing:border-box}
.vk-app{min-height:100vh;background:#081e1b;color:#e7f8ef;font-family:Arial,Helvetica,sans-serif}
.vk-app button,.vk-app input,.vk-app select{font:inherit}.vk-app button{cursor:pointer}.vk-app button:disabled{opacity:.5;cursor:not-allowed}
.vk-top{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px max(20px,calc((100vw - 1240px)/2));background:#092b26;border-bottom:1px solid #275345}
.vk-top strong{display:block;font-size:22px}.vk-top em{color:#42dda5;font-style:normal}.vk-top small{font-size:11px;color:#adf3cf}.vk-top span{display:block;margin-top:6px;color:#aac6ba;font-size:11px}.vk-top-actions{display:flex;gap:8px;flex-wrap:wrap}
.vk-top-actions button,.vk-light{border:1px solid #355e53;background:#17372f;color:#dff8eb;border-radius:9px;padding:11px 14px;font-size:12px;font-weight:bold}
.vk-wrap{max-width:1240px;margin:auto;padding:22px}.vk-banner{border:1px solid #225c49;border-radius:17px;padding:30px;background:linear-gradient(95deg,#063028f5,#0a4138d9),url('/background-erg.png.PNG') center/cover}
.vk-banner>span{color:#d9b976;font-size:10px;letter-spacing:1px;font-weight:900}.vk-banner h1{font-size:clamp(25px,3.5vw,36px);margin:13px 0}.vk-banner p{color:#c0dbcf;line-height:1.7;max-width:780px;font-size:13px}
.vk-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:17px 0}.vk-stats>div,.vk-panel{background:#123028;border:1px solid #30584c;border-radius:14px;padding:20px}.vk-stats small,.vk-stats span{display:block;color:#9ebeb0;font-size:11px}.vk-stats strong{display:block;color:#66e6b1;font-size:32px;margin:8px 0}
.vk-panel-head h2{font-size:19px;margin:0 0 8px}.vk-panel-head p{color:#a6c0b5;font-size:12px;line-height:1.6}
.vk-filters{display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:14px 0;border-bottom:1px solid #375649}.vk-tabs{display:flex;gap:7px;flex-wrap:wrap}.vk-tabs button{border:1px solid #2d5b4b;border-radius:9px;background:#183c31;color:#a5d0bb;padding:10px 13px;font-size:12px;font-weight:bold}.vk-tabs button.on{background:#07895c;color:white}
.vk-filters input,.vk-filters select{min-height:40px;background:#102921;color:#eaf6ee;border:1px solid #3a5a4e;border-radius:9px;padding:9px 12px;font-size:12px}.vk-filters input{flex:1;min-width:180px}
.vk-list{display:grid;gap:10px;padding-top:14px}.vk-item{display:flex;align-items:center;justify-content:space-between;gap:17px;border:1px solid #35584c;border-radius:12px;background:#142f28;padding:17px}.vk-item-main{min-width:0}.vk-item h3{font-size:15px;margin:9px 0}.vk-item p{font-size:12px;color:#b5d0c3;margin:6px 0;overflow-wrap:anywhere}.vk-item small{font-size:11px;color:#8aada0}.vk-item .vk-desc{max-width:850px;line-height:1.5;white-space:pre-wrap}.vk-tag{display:inline-block;padding:6px 9px;border-radius:6px;background:#34513e;color:#a9eec8;font-size:10px;font-weight:900}.vk-tag.praktik{background:#59462c;color:#ffdfa0}.vk-proposed{display:block;color:#85e6b4;font-size:12px;margin-top:9px}.vk-item-actions{display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0}
.vk-primary{background:#058c62;border:1px solid #229e73;border-radius:9px;color:white;padding:11px 15px;font-size:12px;font-weight:900}.vk-primary:hover{background:#0ba876}.vk-light:hover{background:#245044}.vk-empty{text-align:center;padding:50px 15px;color:#a7c2b5;font-size:13px}.vk-alert{padding:13px;border-radius:9px;margin:12px 0;font-size:12px}.vk-alert.err{color:#ffced2;border:1px solid #844851;background:#40252c}.vk-alert.ok{color:#a5f1c9;border:1px solid #317c5e;background:#164634}.vk-foot{text-align:center;font-size:11px;color:#89ab9c;padding:30px}
.vk-overlay{position:fixed;z-index:100;inset:0;background:#031512df;display:grid;place-items:center;padding:16px}.vk-modal{width:min(100%,630px);max-height:92vh;overflow:auto;background:#123128;border:1px solid #3c6957;border-radius:16px;box-shadow:0 20px 60px #0008}.vk-modal-head{display:flex;align-items:start;justify-content:space-between;padding:20px;border-bottom:1px solid #375749}.vk-modal-head h2{margin:10px 0}.vk-modal-head p{color:#a8cbbc;font-size:12px}.vk-modal-head>button{background:#1e4235;border:0;border-radius:8px;padding:9px;color:white}.vk-modal-body{padding:21px}.vk-modal-body>p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.8}.vk-evidence{background:#1b3b30;border:1px solid #315e4b;border-radius:10px;padding:15px;margin-top:18px;font-size:12px}.vk-evidence strong{display:block;margin-bottom:10px}.vk-evidence a{color:#7ae0b0}.vk-evidence p{color:#a6c1b4}.vk-check{display:flex;gap:9px;align-items:flex-start;margin-top:18px;font-size:12px;line-height:1.7;cursor:pointer}.vk-check input{accent-color:#078b61;width:17px;height:17px}
.vk-modal-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:22px}
@media(max-width:1060px){.vk-shell{grid-template-columns:1fr}.vk-sidebar{display:none}}
:root:not([data-theme="dark"]) .vk-shell{background:#edf4f0}
:root:not([data-theme="dark"]) .vk-app{background:#edf4f0;color:#173f32}
:root:not([data-theme="dark"]) .vk-stats>div,:root:not([data-theme="dark"]) .vk-panel,:root:not([data-theme="dark"]) .vk-item,:root:not([data-theme="dark"]) .vk-modal{background:#fff;border-color:#d5e6dc;color:#173f32}
:root:not([data-theme="dark"]) .vk-top{background:#0d3b30}
:root:not([data-theme="dark"]) .vk-item h3,:root:not([data-theme="dark"]) .vk-panel-head h2{color:#1a4836}
:root:not([data-theme="dark"]) .vk-item p,:root:not([data-theme="dark"]) .vk-panel-head p,:root:not([data-theme="dark"]) .vk-item small{color:#678778}
:root:not([data-theme="dark"]) .vk-filters input,:root:not([data-theme="dark"]) .vk-filters select{background:#f4faf6;color:#184334;border-color:#d5e6dc}
:root:not([data-theme="dark"]) .vk-tabs button{background:#edf7f1;color:#126a48;border-color:#b9d9c7}
:root:not([data-theme="dark"]) .vk-tabs button.on{background:#07895c;color:white}
:root:not([data-theme="dark"]) .vk-light{background:#edf7f1;color:#126a48;border-color:#b9d9c7}
:root:not([data-theme="dark"]) .vk-evidence{background:#f1f8f4;color:#214c39;border-color:#d5e6dc}
:root:not([data-theme="dark"]) .vk-modal-head p,:root:not([data-theme="dark"]) .vk-modal-body p,:root:not([data-theme="dark"]) .vk-evidence p{color:#688679}
@media(max-width:700px){.vk-top{padding:12px;flex-wrap:wrap}.vk-wrap{padding:12px}.vk-stats{gap:7px}.vk-stats>div{padding:13px}.vk-stats strong{font-size:25px}.vk-stats small,.vk-stats span{font-size:9px}.vk-panel{padding:13px}.vk-item{align-items:stretch;flex-direction:column}.vk-item-actions{width:100%}.vk-item-actions button{flex:1}}
`;
