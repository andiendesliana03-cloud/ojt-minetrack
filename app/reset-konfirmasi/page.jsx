
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetKonfirmasiPage() {
  const router = useRouter();

  const [tokenHash, setTokenHash] = useState("");
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const token = params.get("token_hash");
    const type = params.get("type");

    if (token && type === "recovery") {
      setTokenHash(token);
      setValid(true);
    }
  }, []);

  function continueReset() {
    if (!tokenHash) return;

    // Token baru diproses ketika pengguna
    // benar-benar menekan tombol ini.
    router.push(
      `/reset-password?token_hash=${encodeURIComponent(
        tokenHash
      )}&type=recovery`
    );
  }

  return (
    <main className="rc-page">
      <style>{css}</style>

      <section className="rc-card">
        <div className="rc-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <p className="rc-subtitle">
          EMERGENCY RESPONSE GROUP
          <br />
          PT BERAU COAL
        </p>

        <div className="rc-icon">
          {valid ? "🔐" : "⚠️"}
        </div>

        {valid ? (
          <>
            <h1>Konfirmasi Reset Password</h1>

            <p>
              Permintaan pemulihan password
              telah diterima.
            </p>

            <p>
              Tekan tombol di bawah untuk
              memverifikasi tautan dan
              membuat password baru.
            </p>

            <button
              type="button"
              onClick={continueReset}
            >
              Lanjutkan Reset Password
            </button>
          </>
        ) : (
          <>
            <h1>Tautan Tidak Tersedia</h1>

            <p>
              Tautan pemulihan tidak lengkap.
              Silakan meminta email reset
              password yang baru.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/lupa-password")
              }
            >
              Minta Link Reset Baru
            </button>
          </>
        )}

        <button
          type="button"
          className="rc-back"
          onClick={() =>
            router.push("/login")
          }
        >
          ← Kembali ke Login
        </button>

        <footer>
          OJT MineTrack v2.0
          <br />
          Emergency Response Group · PT Berau Coal
        </footer>
      </section>
    </main>
  );
}

const css = `
* {
  box-sizing: border-box;
}

.rc-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 20px;
  font-family: Arial, Helvetica, sans-serif;

  background:
    linear-gradient(
      120deg,
      rgba(4,23,34,.93),
      rgba(4,55,48,.84)
    ),
    url("/background-erg.png.PNG")
      center/cover;
}

.rc-card {
  width: 100%;
  max-width: 440px;
  padding: 35px 28px;
  background: white;
  border-radius: 19px;
  text-align: center;
  color: #17313d;
  box-shadow: 0 20px 60px #031a2740;
}

.rc-brand {
  font-size: 27px;
  font-weight: 900;
  color: #142c3b;
}

.rc-brand span {
  color: #09875f;
}

.rc-brand small {
  margin-left: 5px;
  font-size: 10px;
  color: #8da0aa;
}

.rc-subtitle {
  margin: 10px 0 30px;
  font-size: 10px;
  letter-spacing: .7px;
  line-height: 1.8;
  color: #83949d;
}

.rc-icon {
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  margin: auto;
  background: #e2f6eb;
  border-radius: 17px;
  font-size: 29px;
}

.rc-card h1 {
  font-size: 24px;
  margin: 20px 0 15px;
}

.rc-card p {
  font-size: 13px;
  color: #728894;
  line-height: 1.8;
}

.rc-card button:not(.rc-back) {
  width: 100%;
  padding: 15px;
  margin-top: 20px;
  border: none;
  border-radius: 10px;
  background: #078b61;
  color: white;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.rc-back {
  margin-top: 22px;
  padding: 9px;
  border: none;
  background: transparent;
  color: #087c58;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.rc-card footer {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid #edf1f3;
  color: #9baab2;
  font-size: 10px;
  line-height: 1.8;
}

@media(max-width:480px) {
  .rc-card {
    padding: 28px 20px;
  }
}
`;
