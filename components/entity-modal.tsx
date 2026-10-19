"use client";
import { useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import type { FinanceData } from "@/lib/types";
import { todayTR, monthKey, normalizeMerchant, weekdays } from "@/lib/finance";
import { SAVINGS_ASSETS } from "@/lib/savings";
import type { SavingsAsset } from "@/lib/types";
type Option = { value: string; label: string };
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: Option[];
  optional?: boolean;
  hint?: string;
  step?: string;
};
export type ModalState = {
  table: string;
  title: string;
  record?: Record<string, unknown>;
};
export default function EntityModal({
  modal,
  data,
  onClose,
  onSave,
}: {
  modal: ModalState;
  data: FinanceData;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const d = modal.record || {};
  const [values, setValues] = useState<Record<string, unknown>>({
    occurred_on: todayTR(),
    direction: "expense",
    account_id: data.accounts[0]?.id || "",
    bucket_id: "",
    income_source_id: "",
    balance_date: todayTR(),
    opening_balance: 0,
    bank: "Yapı Kredi",
    account_type: "bank",
    ratio: 0,
    sort_order: data.buckets.length,
    kind: modal.table === "recurring_items" ? "bill" : "custom",
    color: "#abd698",
    type: "salary",
    period: "monthly",
    expected_day: 5,
    active: "true",
    start_date: monthKey() + "-01",
    day: 1,
    installment_count: 6,
    recorded_count: 0,
    first_due_on: todayTR(),
    asset: "USD",
    goal_id: "",
    ...d,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const accountOptions = data.accounts.map((a) => ({
    value: a.id,
    label: a.name + " · " + a.bank,
  }));
  const bucketOptions = [
    { value: "", label: "Bekleyenlerde bırak" },
    ...data.buckets.map((b) => ({ value: b.id, label: b.name })),
  ];
  const weekdayOptions = weekdays.map((label, i) => ({
    value: String(i + 1),
    label,
  }));
  let fields: Field[] = [];
  switch (modal.table) {
    case "transactions":
      fields = [
        {
          key: "direction",
          label: "İşlem yönü",
          options: [
            { value: "expense", label: "Harcama" },
            { value: "income", label: "Gelir" },
          ],
        },
        {
          key: "merchant",
          label:
            values.direction === "income"
              ? "Gönderen / açıklama"
              : "İşyeri / açıklama",
        },
        { key: "amount", label: "Tutar (₺)", type: "number", step: "0.01" },
        { key: "occurred_on", label: "İşlem tarihi", type: "date" },
        { key: "account_id", label: "Hesap", options: accountOptions },
        values.direction === "expense"
          ? {
              key: "bucket_id",
              label: "Kova",
              options: bucketOptions,
              optional: true,
            }
          : {
              key: "income_source_id",
              label: "Gelir kaynağı",
              options: [
                { value: "", label: "Kaynaksız" },
                ...data.income_sources.map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
              ],
              optional: true,
            },
        { key: "note", label: "Not", optional: true },
      ];
      break;
    case "accounts":
      fields = [
        { key: "name", label: "Hesap adı" },
        {
          key: "bank",
          label: "Banka",
          options: ["Yapı Kredi", "İş Bankası", "Nakit", "Diğer"].map((v) => ({
            value: v,
            label: v,
          })),
        },
        {
          key: "account_type",
          label: "Hesap türü",
          options: [
            { value: "bank", label: "Banka hesabı" },
            { value: "cash", label: "Nakit" },
            { value: "credit_card", label: "Kredi kartı" },
          ],
          hint: "Elimdeki para kartında banka ve nakit hesaplarının kullanılabilir bakiyeleri gösterilir. Kredi kartı bu tutara eklenmez.",
        },
        {
          key: "opening_balance",
          label: "Açılış bakiyesi (₺)",
          type: "number",
          step: "0.01",
        },
        {
          key: "balance_date",
          label: "Bakiyenin geçerli olduğu gün",
          type: "date",
          hint: "Bu gün ve öncesindeki işlemler bakiyeye dahildir; tekrar düşülmez.",
        },
      ];
      if (values.account_type === "credit_card")
        fields.push(
          {
            key: "statement_day",
            label: "Ekstre kesim günü",
            type: "number",
            optional: true,
            hint: "Ayın 1–31. günü. Bankandaki bilgiyi gir; ay sonunda olmayan gün son güne alınır.",
          },
          {
            key: "payment_day",
            label: "Son ödeme günü",
            type: "number",
            optional: true,
          },
        );
      break;
    case "income_sources":
      fields = [
        { key: "name", label: "Kaynak adı" },
        {
          key: "type",
          label: "Gelir türü",
          options: [
            ["salary", "Maaş"],
            ["client", "Müşteri"],
            ["sponsor", "Sponsor"],
            ["rent", "Kira"],
            ["sales", "Satış"],
            ["other", "Diğer"],
          ].map(([value, label]) => ({ value, label })),
        },
        {
          key: "expected_amount",
          label:
            values.period === "weekly"
              ? "Haftalık beklenen tutar (₺)"
              : "Beklenen tutar (₺)",
          type: "number",
          step: "0.01",
          optional: true,
        },
        {
          key: "period",
          label: "Periyot",
          options: [
            { value: "monthly", label: "Her ay" },
            { value: "weekly", label: "Her hafta" },
            { value: "once", label: "Tek seferlik" },
          ],
        },
        values.period === "weekly"
          ? {
              key: "expected_day",
              label: "Haftanın hangi günü?",
              options: weekdayOptions,
            }
          : values.period === "monthly"
            ? {
                key: "expected_day",
                label: "Ayın kaçıncı günü?",
                type: "number",
              }
            : { key: "expected_date", label: "Beklenen tarih", type: "date" },
        ...(values.period === "weekly"
          ? [
              {
                key: "expected_date",
                label: "Başlangıç tarihi",
                type: "date",
                hint: "Beklenen tutar her hafta bu günde gelir planına eklenir.",
              },
            ]
          : []),
        {
          key: "active",
          label: "Durum",
          options: [
            { value: "true", label: "Aktif" },
            { value: "false", label: "Pasif" },
          ],
        },
        { key: "note", label: "Not", optional: true },
      ];
      break;
    case "recurring_items":
      fields = [
        {
          key: "kind",
          label: "Gider türü",
          options: [
            { value: "bill", label: "Sabit gider" },
            { value: "subscription", label: "Abonelik" },
          ],
        },
        { key: "name", label: "Sabit kalem adı" },
        {
          key: "period",
          label: "Periyot",
          options: [
            { value: "monthly", label: "Her ay" },
            { value: "weekly", label: "Her hafta" },
          ],
        },
        {
          key: "amount",
          label:
            values.period === "weekly"
              ? "Haftalık tutar (₺)"
              : "Aylık tutar (₺)",
          type: "number",
          step: "0.01",
        },
        values.period === "weekly"
          ? {
              key: "day",
              label: "Haftanın hangi günü?",
              options: weekdayOptions,
            }
          : { key: "day", label: "Ayın kaçıncı günü?", type: "number" },
        {
          key: "bucket_id",
          label: "Kova",
          options: bucketOptions,
          optional: true,
        },
        {
          key: "account_id",
          label: "Hesap",
          options: [
            { value: "", label: "Ödeme anında seç" },
            ...accountOptions,
          ],
          optional: true,
        },
        { key: "start_date", label: "Başlangıç tarihi", type: "date" },
        {
          key: "end_date",
          label: "Bitiş tarihi",
          type: "date",
          optional: true,
        },
      ];
      break;
    case "installment_plans":
      fields = [
        { key: "name", label: "Alışveriş / işyeri" },
        {
          key: "account_id",
          label: "Kredi kartı",
          options: accountOptions.filter((o) =>
            data.accounts.some(
              (a) => a.id === o.value && a.account_type === "credit_card",
            ),
          ),
        },
        {
          key: "total_amount",
          label: "Alışveriş toplamı (₺)",
          type: "number",
          step: "0.01",
        },
        {
          key: "installment_amount",
          label: "Aylık taksit (₺)",
          type: "number",
          step: "0.01",
          hint: "Yuvarlama farkı son takside eklenir.",
        },
        {
          key: "installment_count",
          label: "Toplam taksit sayısı",
          type: "number",
        },
        {
          key: "recorded_count",
          label: "Daha önce kaydedilen taksit sayısı",
          type: "number",
          hint: "Bu sayıyı değiştirmek işlem eklemez veya silmez. Henüz hiç kaydedilmediyse 0 gir.",
        },
        { key: "first_due_on", label: "İlk taksidin tarihi", type: "date" },
        {
          key: "bucket_id",
          label: "Kova",
          options: bucketOptions,
          optional: true,
        },
      ];
      break;
    case "holdings":
      fields = [
        { key: "name", label: "Birikimin adı" },
        {
          key: "asset",
          label: "Birikim türü",
          options: Object.entries(SAVINGS_ASSETS).map(([value, meta]) => ({
            value,
            label: meta.name,
          })),
        },
        {
          key: "quantity",
          label: `Miktar (${SAVINGS_ASSETS[values.asset as SavingsAsset]?.unit || "birim"})`,
          type: "number",
          step: "0.000001",
          hint: "Döviz için para miktarını, altın ve gümüş için gramı, ziynet altınları için adedi gir. TL karşılığı güncel alış fiyatıyla hesaplanır.",
        },
        {
          key: "cost_basis",
          label: "Toplam alış maliyeti (₺)",
          type: "number",
          step: "0.01",
          optional: true,
          hint: "İsteğe bağlı toplam maliyet; girersen kazanç veya kaybını görebilirsin.",
        },
        {
          key: "goal_id",
          label: "Hedefe ayır",
          optional: true,
          options: [
            { value: "", label: "Serbest birikim" },
            ...data.goals.map((g) => ({ value: g.id, label: g.name })),
          ],
        },
        { key: "note", label: "Not", optional: true },
      ];
      break;
    case "goals":
      fields = [
        { key: "name", label: "Hedefin adı" },
        {
          key: "amount",
          label: "Hedef tutar (₺)",
          type: "number",
          step: "0.01",
        },
        {
          key: "target_date",
          label: "Hedef tarihi",
          type: "date",
          optional: true,
          hint: "İsteğe bağlı. Birikim eklerken bu hedefi seçerek ilerlemeni takip edebilirsin.",
        },
      ];
      break;
    case "buckets":
      fields = [
        { key: "name", label: "Kova adı" },
        {
          key: "ratio",
          label: "Gelirdeki payı (%)",
          type: "number",
          step: "0.01",
        },
        {
          key: "kind",
          label: "Kova türü",
          options: [
            ["living", "Zorunlu yaşam"],
            ["fixed", "Sabit faturalar (otomatik bütçe)"],
            ["leisure", "Gezi / keyif"],
            ["flexible", "Esnek"],
            ["savings", "Birikim / hedef"],
            ["custom", "Özel kova"],
          ].map(([value, label]) => ({ value, label })),
        },
        { key: "color", label: "Renk", type: "color" },
        { key: "sort_order", label: "Sıra", type: "number" },
      ];
      break;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (
        await onSave({
          action: "save",
          table: modal.table,
          id: d.id,
          record: values,
        })
      )
        onClose();
      else setError("Kaydedilemedi. Ekrandaki uyarıyı kontrol edin.");
    } finally {
      setBusy(false);
    }
  }
  const suggestedSource =
    modal.table === "transactions" &&
    values.direction === "income" &&
    !values.income_source_id
      ? data.income_sources.find((s) =>
          normalizeMerchant(String(values.merchant || "")).includes(
            normalizeMerchant(s.name),
          ),
        )
      : null;
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal"
      >
        <header>
          <div>
            <span className="eyebrow">FİNANSAL ALANIN</span>
            <h2 id="modal-title">{modal.title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Pencereyi kapat"
          >
            <X size={20} />
          </button>
        </header>
        <form onSubmit={submit}>
          {suggestedSource && (
            <div className="notice">
              <span>
                Gönderen adına göre öneri: <b>{suggestedSource.name}</b>
              </span>
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setValues({ ...values, income_source_id: suggestedSource.id })
                }
              >
                Kaynağa bağla
              </button>
            </div>
          )}
          <div className="form-grid">
            {fields.map((f) => (
              <label key={f.key} className={f.hint ? "wide" : ""}>
                {f.label}
                {f.optional && <span className="optional"> isteğe bağlı</span>}
                {f.options ? (
                  <select
                    value={String(values[f.key] ?? "")}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        [f.key]: e.target.value,
                        ...(f.key === "period"
                          ? {
                              day: 1,
                              expected_day: 1,
                              ...(e.target.value === "weekly" &&
                              !values.expected_date
                                ? { expected_date: todayTR() }
                                : {}),
                            }
                          : {}),
                      })
                    }
                    required={!f.optional}
                  >
                    <option value="" disabled={!f.optional}>
                      Seçiniz
                    </option>
                    {f.options.map((o) => (
                      <option value={o.value} key={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    autoFocus={f.key === fields[0].key}
                    type={f.type || "text"}
                    step={f.step}
                    required={!f.optional}
                    value={String(values[f.key] ?? "")}
                    maxLength={200}
                    onChange={(e) =>
                      setValues({ ...values, [f.key]: e.target.value })
                    }
                  />
                )}{" "}
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
          </div>
          {modal.table === "transactions" && data.accounts.length === 0 && (
            <p className="form-error">
              Önce Genel bakıştaki Hesaplarımı yönet bölümünden hesap ekle.
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              Vazgeç
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : null}Kaydet
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
