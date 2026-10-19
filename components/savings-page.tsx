"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Coins,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import type { FinanceData, SavingsAsset } from "@/lib/types";
import { money } from "@/lib/finance";
import {
  SAVINGS_ASSETS,
  marketIsStale,
  savingsGoal,
  savingsSummary,
  type MarketResponse,
} from "@/lib/savings";

function SavingsSymbol({ asset }: { asset: SavingsAsset }) {
  if (asset !== "XAU" && asset !== "XAG")
    return <>{SAVINGS_ASSETS[asset].symbol}</>;
  return (
    <svg
      className="savings-metal-bar"
      viewBox="0 0 32 32"
      role="img"
      aria-label={asset === "XAU" ? "Altın külçesi" : "Gümüş külçesi"}
      fill="none"
      strokeLinejoin="round"
    >
      <path d="m5 14 16-7 7 4-16 7Z" fill="currentColor" />
      <path d="m5 14 7 4-1 9-8-6Z" fill="currentColor" opacity=".55" />
      <path d="m12 18 16-7 2 8-19 8Z" fill="currentColor" opacity=".75" />
      <path
        d="m5 14 16-7 7 4 2 8-19 8-8-6Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="m5 14 7 4 16-7M12 18l-1 9"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="m12 13 8-3.5m-6 5 8-3.5"
        stroke="var(--surface)"
        opacity=".5"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const quantity = (value: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 6 }).format(value);
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
type Props = {
  data: FinanceData;
  edit: (table: string, title: string, record?: object) => void;
  remove: (table: string, id: string, name: string) => void;
  working: boolean;
};
export default function SavingsPage({ data, edit, remove, working }: Props) {
  const [market, setMarket] = useState<MarketResponse>({
    snapshot: null,
    stale: true,
    unavailable: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setRefreshing(true);
    try {
      const response = await fetch("/api/market", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Fiyat alınamadı.");
      const result = (await response.json()) as MarketResponse;
      if (!controller.signal.aborted) setMarket(result);
    } catch {
      if (!controller.signal.aborted)
        setMarket((old) => ({ ...old, stale: true, unavailable: true }));
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(poll, 60000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [refresh]);
  const holdings = data.holdings || [];
  const snapshot = market.snapshot;
  const summary = savingsSummary(holdings, snapshot);
  const goals = [...data.goals]
    .sort((a, b) =>
      (a.target_date || "9999").localeCompare(b.target_date || "9999"),
    )
    .map((goal) => savingsGoal(goal, holdings, snapshot));
  const assigned = goals.reduce((sum, goal) => sum + goal.allocated, 0);
  const stale = market.stale || marketIsStale(snapshot);
  return (
    <div className="savings-page">
      <section className="savings-stats" aria-label="Hedef ve birikim özeti">
        <article className="stat-card total-stat">
          <div className="stat-top">
            <span>Toplam birikimim</span>
            <PiggyBank size={19} />
          </div>
          <h2>
            {summary.missing === holdings.length && holdings.length
              ? "—"
              : money(summary.total)}
          </h2>
          <div className="stat-bottom">
            <span>{holdings.length} birikim kaydı</span>
            <span>
              {summary.missing
                ? `${summary.missing} fiyat bekleniyor`
                : "Güncel TL karşılığı"}
            </span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span>Hedeflerimin tutarı</span>
            <Target size={19} />
          </div>
          <h2>
            {money(goals.reduce((sum, goal) => sum + Number(goal.amount), 0))}
          </h2>
          <div className="stat-bottom">
            <span>{goals.length} hedef</span>
            <span>
              {goals.filter((g) => !g.missing && !g.remaining).length}{" "}
              tamamlandı
            </span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span>Hedeflere ayırdığım</span>
            <Wallet size={19} />
          </div>
          <h2>{money(assigned)}</h2>
          <div className="stat-bottom">
            <span>Hedefe bağlı birikimlerin</span>
            <span>
              {summary.missing ? "Bilinen fiyatlarla" : "Alış fiyatı üzerinden"}
            </span>
          </div>
        </article>
      </section>
      <section
        className="panel savings-market"
        aria-label="Döviz ve maden fiyatları"
      >
        <div className="panel-heading">
          <div>
            <h2>Piyasanın nabzı</h2>
            <p>Döviz ve değerli madenlerin TL alış fiyatları</p>
          </div>
          <button
            className="button secondary"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            {refreshing ? "Güncelleniyor" : "Fiyatları yenile"}
          </button>
        </div>
        <div className="savings-quotes">
          {(["USD", "EUR", "GBP", "XAU", "XAG"] as SavingsAsset[]).map(
            (asset) => {
              const quote = snapshot?.quotes[asset],
                meta = SAVINGS_ASSETS[asset];
              return (
                <article key={asset}>
                  <span
                    className={
                      "savings-symbol " +
                      (asset === "XAU"
                        ? "gold"
                        : asset === "XAG"
                          ? "silver"
                          : "")
                    }
                  >
                    <SavingsSymbol asset={asset} />
                  </span>
                  <div>
                    <span>{asset === "XAU" ? "Gram altın" : meta.name}</span>
                    <strong>{quote ? money(quote.buy) : "—"}</strong>
                    <small>
                      {meta.unit === "gram" ? "1 gram" : `1 ${asset}`} · alış
                    </small>
                  </div>
                  {quote?.change !== null && quote?.change !== undefined && (
                    <span
                      className={quote.change < 0 ? "negative" : "positive"}
                    >
                      {quote.change > 0 ? "+" : ""}
                      {quantity(quote.change)}%
                    </span>
                  )}
                </article>
              );
            },
          )}
        </div>
        <div
          className={"savings-market-note " + (stale ? "is-stale" : "")}
          role="status"
        >
          <span className="savings-status-dot" />
          <span>
            {snapshot
              ? `Son kotasyon: ${timestamp(snapshot.quoted_at)}${market.unavailable ? " · Kaynağa şu an ulaşılamıyor; son alınan fiyatlar gösteriliyor." : stale ? " · Son mevcut fiyatlar; piyasa kapalı olabilir veya veri gecikiyor." : " · Sayfa açıkken her dakika kontrol edilir."}`
              : refreshing
                ? "Güncel fiyatlar alınıyor…"
                : "Fiyatlara şu an ulaşılamıyor. Miktarların kayıtlı kalır; TL değerleri fiyat geldiğinde hesaplanır."}
          </span>
          <a
            href="https://finans.truncgil.com/"
            target="_blank"
            rel="noreferrer"
          >
            Trunçgil Finans <ArrowUpRight size={12} />
          </a>
        </div>
      </section>
      <section className="panel savings-holdings" id="birikimler">
        <div className="panel-heading">
          <div>
            <h2>Birikimlerim</h2>
            <p>Elindeki miktarları ekle, değerini birlikte takip edelim.</p>
          </div>
          <button
            className="button secondary"
            onClick={() => edit("holdings", "Birikim ekle")}
          >
            <Plus size={15} />
            Birikim ekle
          </button>
        </div>
        <div className="subscription-summary">
          <span className="subscription-summary-icon">
            <Coins size={22} />
          </span>
          <div>
            <small>
              {summary.missing
                ? "Bilinen fiyatlarla birikim değeri"
                : "Birikimlerinin toplam değeri"}
            </small>
            <strong>
              {summary.missing === holdings.length && holdings.length
                ? "—"
                : money(summary.total)}
            </strong>
          </div>
          <div className="subscription-summary-meta">
            <span className="tag">{holdings.length} birikim</span>
            <small>TL karşılığı</small>
          </div>
        </div>
        <div className="savings-list">
          {summary.rows.map((holding) => {
            const meta = SAVINGS_ASSETS[holding.asset],
              price =
                holding.asset === "TRY"
                  ? 1
                  : snapshot?.quotes[holding.asset]?.buy,
              goal = data.goals.find((g) => g.id === holding.goal_id),
              gain =
                holding.value !== null && holding.cost_basis !== null
                  ? holding.value - Number(holding.cost_basis)
                  : null;
            return (
              <article key={holding.id} className="savings-holding-row">
                <span
                  className={
                    "savings-symbol " +
                    (holding.asset.startsWith("GOLD") || holding.asset === "XAU"
                      ? "gold"
                      : holding.asset === "XAG"
                        ? "silver"
                        : "")
                  }
                >
                  <SavingsSymbol asset={holding.asset} />
                </span>
                <div className="savings-row-name">
                  <h3>{holding.name}</h3>
                  <span>
                    {meta.name} · {quantity(Number(holding.quantity))}{" "}
                    {meta.unit}
                  </span>
                  {goal && (
                    <small>
                      <Target size={11} />
                      {goal.name}
                    </small>
                  )}
                  {holding.note && <small>{holding.note}</small>}
                </div>
                <div className="savings-unit-price">
                  <small>Birim alış fiyatı</small>
                  <span>{price ? money(price) : "Fiyat bekleniyor"}</span>
                </div>
                <div className="savings-row-value">
                  <strong>
                    {holding.value === null ? "—" : money(holding.value)}
                  </strong>
                  {gain !== null ? (
                    <small className={gain < 0 ? "negative" : "positive"}>
                      {gain > 0 ? "+" : ""}
                      {money(gain)} · değer farkı
                    </small>
                  ) : (
                    <small>
                      {holding.value === null
                        ? "Fiyat bekleniyor"
                        : "Güncel değer"}
                    </small>
                  )}
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={holding.name + " birikimini düzenle"}
                    onClick={() =>
                      edit("holdings", "Birikimi düzenle", holding)
                    }
                    disabled={working}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger-hover"
                    aria-label={holding.name + " birikimini sil"}
                    onClick={() => remove("holdings", holding.id, holding.name)}
                    disabled={working}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {!holdings.length && (
          <div className="savings-empty">
            <PiggyBank size={28} />
            <h3>İlk birikimine yer aç.</h3>
            <p>Dolar, euro, sterlin, altın, gümüş veya TL miktarını gir.</p>
            <button
              className="text-link"
              onClick={() => edit("holdings", "Birikim ekle")}
            >
              <Plus size={14} />
              İlk birikimini ekle
            </button>
          </div>
        )}
        <p className="savings-footnote">
          Bu liste birikim envanterindir. Kayıt eklemek banka bakiyeni veya
          işlem geçmişini değiştirmez. Fiyatlar yaklaşık piyasa değeridir;
          bankanın ya da kuyumcunun alış fiyatı farklı olabilir.
        </p>
      </section>
      <section className="panel savings-goals" id="hedefler">
        <div className="panel-heading">
          <div>
            <h2>Hedeflerim</h2>
            <p>Bir hedef belirle, birikimlerini ona ayır, ilerlemeni gör.</p>
          </div>
          <button
            className="button secondary"
            onClick={() => edit("goals", "Hedef ekle")}
          >
            <Plus size={15} />
            Hedef ekle
          </button>
        </div>
        <div className="savings-list">
          {goals.map((goal) => (
            <article className="savings-goal-row" key={goal.id}>
              <span className="savings-symbol">
                <Target size={21} />
              </span>
              <div className="savings-row-name">
                <h3>{goal.name}</h3>
                <span>
                  {goal.target_date
                    ? new Intl.DateTimeFormat("tr-TR", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(goal.target_date + "T00:00:00Z"))
                    : "Kendi hızında"}{" "}
                  · {goal.count} bağlı birikim
                </span>
                <div className="savings-goal-progress">
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label={goal.name + " ilerleme"}
                    aria-valuenow={Math.round(goal.percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      style={{
                        width: goal.percent + "%",
                        background: "var(--green)",
                      }}
                    />
                  </div>
                  <small>
                    {goal.missing
                      ? "Bazı fiyatlar bekleniyor"
                      : `%${Math.round(goal.percent)} tamamlandı`}
                  </small>
                </div>
              </div>
              <div className="savings-row-value">
                <strong>{money(Number(goal.amount))}</strong>
                <small>{money(goal.allocated)} ayrıldı</small>
                <span
                  className={
                    !goal.remaining && !goal.missing ? "positive" : "muted"
                  }
                >
                  {goal.missing
                    ? "Bilinen fiyatlarla hesaplandı"
                    : goal.remaining
                      ? `${money(goal.remaining)} kaldı`
                      : "Hedefe ulaştın"}
                </span>
              </div>
              <div className="row-actions">
                <button
                  className="icon-button"
                  aria-label={goal.name + " hedefini düzenle"}
                  onClick={() => edit("goals", "Hedefi düzenle", goal)}
                  disabled={working}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button danger-hover"
                  aria-label={goal.name + " hedefini sil"}
                  onClick={() => remove("goals", goal.id, goal.name)}
                  disabled={working}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!goals.length && (
          <div className="savings-empty">
            <Target size={28} />
            <h3>Bir hayale fiyat biç.</h3>
            <p>
              Hedefinin adını ve tutarını ekle; birikimlerini bu hedefe bağla.
            </p>
            <button
              className="text-link"
              onClick={() => edit("goals", "Hedef ekle")}
            >
              <Plus size={14} />
              İlk hedefini ekle
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
