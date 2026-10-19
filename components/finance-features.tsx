"use client";
import {
  Plus,
  Pencil,
  CreditCard,
  Check,
  Sparkles,
  CheckCheck,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { FinanceData } from "@/lib/types";
import {
  money,
  todayTR,
  activeRecurring,
  recurringDates,
  recurringPayment,
  weekdays,
  monthKey,
  monthLabel,
} from "@/lib/finance";
import {
  cardSummary,
  installmentSchedule,
  subscriptionInsights,
  weeklySummary,
  classificationSuggestion,
} from "@/lib/insights";
type Props = {
  data: FinanceData;
  edit: (table: string, title: string, record?: object) => void;
  mutate: (body: Record<string, unknown>) => Promise<boolean>;
  working: boolean;
};
export function CardsPanel({ data, edit, mutate, working }: Props) {
  const cards = data.accounts.filter((a) => a.account_type === "credit_card");
  const plans = data.installment_plans || [];
  return (
    <section className="panel feature-panel" id="kartlar">
      <div className="panel-heading">
        <div>
          <h2>Kartlar ve taksitler</h2>
          <p>Ekstre tarihleri, kayıtlı borçlar ve gelecek ödemeler</p>
        </div>
        <button
          className="button secondary"
          disabled={!cards.length}
          onClick={() =>
            edit("installment_plans", "Taksit planı ekle", {
              account_id: cards[0]?.id,
            })
          }
        >
          <Plus size={15} />
          Taksit ekle
        </button>
      </div>
      <div className="feature-content">
        <div className="credit-cards">
          {cards.map((a) => {
            const s = cardSummary(data, a.id);
            return (
              <article className="credit-summary" key={a.id}>
                <div className="feature-row">
                  <strong>
                    <CreditCard size={17} /> {a.name}
                  </strong>
                  <button
                    className="icon-button"
                    aria-label={`${a.name} ekstre ayarları`}
                    onClick={() =>
                      edit("accounts", "Kart ve ekstre ayarları", a)
                    }
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <small>Kayıtlara göre mevcut borç</small>
                <h3>{s.debt === null ? "—" : money(s.debt)}</h3>
                {s.statement ? (
                  <>
                    <p>
                      Son ekstre kesimi: <b>{s.statement}</b>
                    </p>
                    <p>
                      Son ödeme: <b>{s.payment}</b>
                    </p>
                    <p>
                      Kesim günündeki borç:{" "}
                      <b>
                        {s.statementDebt === null
                          ? "Bakiye geçmişi yetersiz"
                          : money(s.statementDebt)}
                      </b>
                    </p>
                  </>
                ) : (
                  <button
                    className="text-link"
                    onClick={() =>
                      edit("accounts", "Kart ve ekstre ayarları", a)
                    }
                  >
                    Kesim ve son ödeme gününü tanımla
                  </button>
                )}
              </article>
            );
          })}
          {!cards.length && (
            <p className="muted">
              Hesaplarımı yönet bölümünden kredi kartı eklediğinde burada
              görünecek.
            </p>
          )}
        </div>
        <p className="feature-note">
          Borçlar paneldeki kayıtlardan hesaplanır. Kalan taksitler gelecekteki
          yükümlülüktür; bugünkü harcamaya tekrar eklenmez. Bankanın ekstre
          tutarıyla karşılaştırabilirsin.
        </p>
        {plans.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ALIŞVERİŞ</th>
                  <th>KAYDEDİLEN</th>
                  <th>KALAN TOPLAM</th>
                  <th>SIRADAKİ TAKSİT</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const schedule = installmentSchedule(p),
                    remaining = schedule.filter((s) => !s.recorded),
                    next = remaining[0];
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small className="feature-cell-note">
                          {
                            data.accounts.find((a) => a.id === p.account_id)
                              ?.name
                          }
                        </small>
                      </td>
                      <td>
                        {p.recorded_count} / {p.installment_count}
                      </td>
                      <td>
                        {money(remaining.reduce((s, r) => s + r.amount, 0))}
                      </td>
                      <td>
                        {next ? (
                          <>
                            {next.date}
                            <small className="feature-cell-note">
                              {money(next.amount)}
                            </small>
                          </>
                        ) : (
                          "Tamamlandı"
                        )}
                      </td>
                      <td>
                        <div className="feature-row">
                          <button
                            className="icon-button"
                            aria-label={`${p.name} taksit planını düzenle`}
                            onClick={() =>
                              edit(
                                "installment_plans",
                                "Taksit planını düzenle",
                                p,
                              )
                            }
                          >
                            <Pencil size={14} />
                          </button>
                          {next && next.date <= todayTR() && (
                            <button
                              disabled={working}
                              className="button secondary"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `${p.name}: ${next.number}. taksit ${money(next.amount)} harcama olarak kaydedilsin mi?`,
                                  )
                                )
                                  void mutate({
                                    action: "record_installment",
                                    id: p.id,
                                    number: next.number,
                                  });
                              }}
                            >
                              <Check size={13} />
                              Taksiti kaydet
                            </button>
                          )}
                        </div>
                        <details className="installment-detail">
                          <summary>Ödeme planı</summary>
                          {remaining.map((r) => (
                            <p key={r.number}>
                              {r.number}. taksit · {r.date} · {money(r.amount)}
                            </p>
                          ))}
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Henüz taksit planı yok.</p>
        )}
      </div>
    </section>
  );
}
export function WeeklyPanel({ data }: { data: FinanceData }) {
  const w = weeklySummary(data);
  return (
    <section className="panel feature-panel">
      <div className="panel-heading">
        <div>
          <h2>Haftanın kısa özeti</h2>
          <p>
            {w.start} – {w.end} · son 7 gün
          </p>
        </div>
        <span className="section-icon">
          <Sparkles size={18} />
        </span>
      </div>
      <div className="feature-content">
        <div className="weekly-numbers">
          <div>
            <small>Harcanan</small>
            <strong className="negative">−{money(w.spending, true)}</strong>
          </div>
          <div>
            <small>Gelen</small>
            <strong className="positive">{money(w.income, true)}</strong>
          </div>
          <div>
            <small>İşlem</small>
            <strong>{w.count}</strong>
          </div>
        </div>
        <p>
          {w.change === null
            ? "Önceki haftada karşılaştırılacak harcama kaydı yok."
            : `Harcaman önceki haftaya göre %${Math.abs(w.change)} ${w.change > 0 ? "arttı" : w.change < 0 ? "azaldı" : "değişti; aynı seviyede"}.`}
        </p>
        {w.top && (
          <p>
            En çok harcadığın yer: <b>{w.top.name}</b> · {money(w.top.amount)}
          </p>
        )}
        <p className="feature-note">
          {data.preferences?.weekly_digest
            ? "Telegram haftalık özeti açık. Pazartesi sabahı önceki haftanın özeti gönderilir."
            : "Son yedi günün özeti bu tarayıcıdaki kayıtlardan hesaplanır."}
        </p>
      </div>
    </section>
  );
}
function SubscriptionAlerts({
  insight,
}: {
  insight: ReturnType<typeof subscriptionInsights>[number] | undefined;
}) {
  if (!insight || (!insight.increase && !insight.duplicates)) return null;
  return (
    <div className="subscription-alerts">
      {insight.increase > 0 && (
        <span className="subscription-alert negative">
          <TrendingUp size={12} />+{money(insight.increase)} artış
          <small>Önceki: {money(Number(insight.previous!.amount))}</small>
        </span>
      )}
      {insight.duplicates && (
        <span className="subscription-alert amber-text">
          <TriangleAlert size={12} />
          Bu ay birden fazla ödeme
        </span>
      )}
    </div>
  );
}
export function SubscriptionsPanel({
  data,
  edit,
  month = monthKey(),
}: Props & { month?: string }) {
  const insights = subscriptionInsights(data),
    items = data.recurring_items.filter((r) => r.kind === "subscription");
  const activeItems = items.filter((r) => activeRecurring(r, month));
  const discoveries = insights.filter((s) => s.detected);
  return (
    <section
      className="panel feature-panel subscriptions-panel"
      id="abonelikler"
    >
      <div className="panel-heading">
        <div>
          <h2>Abonelikler ve fiyat değişimleri</h2>
          <p>Tekrarlanan ödemelerin ve fiyat değişiklikleri tek yerde.</p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            edit("recurring_items", "Abonelik ekle", { kind: "subscription" })
          }
        >
          <Plus size={15} />
          Abonelik ekle
        </button>
      </div>
      <div className="subscription-summary">
        <span className="subscription-summary-icon">
          <CreditCard size={21} />
        </span>
        <div>
          <small>Aylık abonelik toplamı</small>
          <strong>
            {money(
              activeItems.reduce(
                (sum, r) =>
                  sum + recurringDates(r, month).length * Number(r.amount),
                0,
              ),
            )}
          </strong>
        </div>
        <div className="subscription-summary-meta">
          <span className="tag">{activeItems.length} aktif abonelik</span>
          <small>{monthLabel(month)}</small>
        </div>
      </div>
      <div className="recurring-list subscription-catalog">
        {items.map((r) => {
          const dates = recurringDates(r, month),
            active = dates.length > 0,
            unpaid = dates.filter((due) => !recurringPayment(data, r, due)),
            matched = active && !unpaid.length,
            late = unpaid.some((due) => due < todayTR()),
            insight = insights.find((s) => s.item?.id === r.id);
          return (
            <article key={r.id} className={!active ? "inactive" : ""}>
              <span className={"recurring-date " + (matched ? "paid" : "")}>
                {matched ? (
                  <CheckCheck size={20} />
                ) : r.period === "weekly" ? (
                  weekdays[r.day - 1].slice(0, 3)
                ) : (
                  r.day
                )}
                <small>
                  {matched
                    ? "Ödendi"
                    : r.period === "weekly"
                      ? "Her hafta"
                      : "Her ay"}
                </small>
              </span>
              <div className="recurring-name subscription-name">
                <h3>{r.name}</h3>
                <span>
                  {data.buckets.find((b) => b.id === r.bucket_id)?.name ||
                    "Abonelik"}
                  {r.end_date ? " · Bitiş: " + r.end_date : ""}
                  {r.period === "weekly"
                    ? ` · Her hafta ${weekdays[r.day - 1]} · ${dates.length - unpaid.length}/${dates.length} ödendi`
                    : ""}
                </span>
                <SubscriptionAlerts insight={insight} />
              </div>
              <div className="subscription-price">
                <strong className="amount">{money(Number(r.amount))}</strong>
                <small>{r.period === "weekly" ? "/ hafta" : "/ ay"}</small>
              </div>
              <span
                className={
                  "tag " + (matched ? "income-tag" : late ? "late-tag" : "")
                }
              >
                {!active
                  ? "Bu ay aktif değil"
                  : matched
                    ? "Ödendi"
                    : late
                      ? "Vadesi geçti"
                      : "Bekleniyor"}
              </span>
              <div className="row-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={r.name + " aboneliğini düzenle"}
                  title="Aboneliği düzenle"
                  onClick={() =>
                    edit("recurring_items", "Aboneliği düzenle", r)
                  }
                >
                  <Pencil size={15} />
                </button>
              </div>
            </article>
          );
        })}
        {!items.length && (
          <div className="subscription-empty">
            <CreditCard size={24} />
            <strong>İlk aboneliğine yer aç.</strong>
            <p>
              Üyeliklerini eklediğinde ödeme günleri ve tutarlar burada görünür.
            </p>
          </div>
        )}
      </div>
      {discoveries.length > 0 && (
        <div className="subscription-discoveries">
          <div className="subscription-discovery-heading">
            <Sparkles size={15} />
            <h3>Fark ettiğimiz düzenli ödemeler</h3>
            <span className="count-pill">{discoveries.length}</span>
          </div>
          <div className="recurring-list subscription-catalog">
            {discoveries.map((s) => (
              <article key={s.family}>
                <span className="recurring-date">
                  {Number(s.last.occurred_on.slice(8))}
                  <small>Öneri</small>
                </span>
                <div className="recurring-name subscription-name">
                  <h3>{s.name}</h3>
                  <span>Son ödeme: {s.last.occurred_on}</span>
                  <SubscriptionAlerts insight={s} />
                </div>
                <div className="subscription-price">
                  <strong className="amount">
                    {money(Number(s.last.amount))}
                  </strong>
                  <small>/ ay olabilir</small>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    edit("recurring_items", "Önerilen aboneliği kontrol et", {
                      name: s.name,
                      amount: s.last.amount,
                      day: Number(s.last.occurred_on.slice(8)),
                      start_date: s.last.occurred_on,
                      account_id: s.last.account_id,
                      bucket_id: s.last.bucket_id,
                      kind: "subscription",
                    })
                  }
                >
                  <Plus size={14} />
                  Abonelik olarak ekle
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      <div className="subscription-footnote">
        <Sparkles size={13} />
        <span>
          Fiyat artışı ve çoklu ödeme uyarıları kayıtlı ödeme geçmişinden
          çıkarılır. Öneriler onayınla aboneliğe dönüşür.
        </span>
      </div>
    </section>
  );
}
export function ClassificationPanel({
  data,
  mutate,
  working,
}: Pick<Props, "data" | "mutate" | "working">) {
  const count = data.transactions.filter(
    (t) =>
      t.direction === "expense" &&
      !t.bucket_id &&
      classificationSuggestion(data, t.merchant),
  ).length;
  return (
    <div className="classification-banner">
      <div>
        <strong>Akıllı sınıflandırma</strong>
        <p>
          Hatırlanan işyerleri, tutarlı geçmiş seçimlerin ve bilinen marketler
          kullanılır. Belirsiz kayıtlar sana bırakılır.
        </p>
      </div>
      <button
        className="button secondary"
        disabled={working || !count}
        onClick={() => void mutate({ action: "classify_pending" })}
      >
        {count
          ? `${count} bekleyen kaydı sınıflandır`
          : "Uygulanacak öneri yok"}
      </button>
    </div>
  );
}
export function AutomationSettings({
  data,
  mutate,
  working,
}: Pick<Props, "data" | "mutate" | "working">) {
  return (
    <section className="panel feature-panel">
      <div className="panel-heading">
        <div>
          <h2>Akıllı yardımcı ayarları</h2>
          <p>Yerel kayıtlarına göre otomatik sınıflandırma</p>
        </div>
      </div>
      <div className="feature-content preference-list">
        <label>
          <span>
            <strong>Yeni harcamaları otomatik sınıflandır</strong>
            <small>
              İşyeri kuralları, en az 3 tutarlı seçimin ve bilinen marketler.
              Eski kayıtlar İşlemler’den uygulanır.
            </small>
          </span>
          <input
            type="checkbox"
            checked={data.preferences?.auto_classify ?? true}
            disabled={working}
            onChange={(e) =>
              void mutate({
                action: "preferences",
                auto_classify: e.target.checked,
              })
            }
          />
        </label>
      </div>
    </section>
  );
}
