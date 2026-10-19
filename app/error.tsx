"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="loading-screen">
      <h1>Bir şeyler yolunda gitmedi.</h1>
      <p>Bağlantını kontrol edip tekrar deneyebilirsin.</p>
      <button className="button primary" onClick={reset}>
        Tekrar dene
      </button>
    </div>
  );
}
