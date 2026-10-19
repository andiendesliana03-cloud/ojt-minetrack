
export default function Home() {
  return (
    <main style={{
      maxWidth: 700,
      margin: "60px auto",
      padding: 24,
      textAlign: "center"
    }}>
      <h1>OJT MineTrack v2.0</h1>
      <p>
        Sistem Monitoring dan Evaluasi
        On the Job Training
      </p>

      <div style={{
        background: "white",
        borderRadius: 16,
        padding: 30,
        marginTop: 30,
        boxShadow: "0 4px 20px #00000010"
      }}>
        <h2>Selamat Datang</h2>
        <p>
          Monitoring pencapaian OJT,
          post-test, praktik, Samapta,
          dan SIMPER.
        </p>
        <p>
          Login peserta dan mentor
          akan tersedia pada tahap berikutnya.
        </p>
      </div>
    </main>
  );
}
