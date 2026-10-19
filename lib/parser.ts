import { todayTR, normalizeMerchant } from "./finance";
export type Parsed =
  | {
      status: "ok";
      amount: number;
      merchant: string;
      occurred_on: string;
      direction: "income" | "expense";
      bank: string;
    }
  | { status: "ignored" | "error"; reason: string };
export function parseNotification(
  text: string,
  receivedDate = todayTR(),
): Parsed {
  const body = text
    .replace(/^Message-ID:.*$/gm, "")
    .replace(/^Received-Date:.*$/gm, "");
  const lower = body.toLocaleLowerCase("tr-TR");
  if (
    /kampanya|indirim fırsatı|avantajlı teklif|kazanabilirsiniz|başvurun|fırsatları kaçırma/.test(
      lower,
    )
  )
    return { status: "ignored", reason: "Kampanya veya reklam bildirimi." };
  if (/ekstre|hesap özeti|dönem borcu/.test(lower))
    return {
      status: "ignored",
      reason: "Ekstre bildirimi tekil işlem değildir.",
    };
  const income =
    /hesabınıza.{0,80}(yatırıl|yatmış|geçmiş|gönderil|transfer|giriş)|hesabınıza\s+.*\s+(tl|try)\s+(geldi|yattı)|gelen (eft|havale|fast)|hesaba giriş|alacak kaydedil/i.test(
      lower,
    );
  const expense =
    /harcama|harcan|alışveriş|ödeme.{0,20}(yapıl|gerçekleş|alın)|kartınızla|hesabınızdan.{0,80}(gönderil|transfer|çıkış)|hesaptan çıkış/.test(
      lower,
    );
  if (!income && !expense)
    return {
      status: "ignored",
      reason: "Tekil gelir veya harcama bilgisi yok.",
    };
  // Only currency-adjacent amounts, never masked account/card fragments.
  const amountMatches = [
    ...body.matchAll(
      /(?<![\dXx*])\b(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)\s*(?:TL|TRY|₺)(?![a-zA-Z])/gi,
    ),
  ];
  if (!amountMatches.length)
    return {
      status: "error",
      reason: "Para birimiyle birlikte okunabilir tutar bulunamadı.",
    };
  if (amountMatches.length > 1)
    return {
      status: "error",
      reason: "Birden fazla tutar var; elle kontrol gerekli.",
    };
  const raw = amountMatches[0][1];
  const amount = Number(
    raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : /^\d{1,3}(\.\d{3})+$/.test(raw)
        ? raw.replace(/\./g, "")
        : raw,
  );
  if (!Number.isFinite(amount) || amount <= 0)
    return { status: "error", reason: "Tutar geçersiz." };
  const iso = body.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const tr = body.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  if (!iso && !tr)
    return {
      status: "error",
      reason: "İşlem tarihi bulunamadı; tarih uydurulmadı.",
    };
  const date = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : `${tr![3]}-${tr![2].padStart(2, "0")}-${tr![1].padStart(2, "0")}`;
  const valid = new Date(date + "T00:00:00Z");
  if (
    Number.isNaN(valid.getTime()) ||
    valid.toISOString().slice(0, 10) !== date
  )
    return { status: "error", reason: "İşlem tarihi geçersiz." };
  const age =
    (new Date(receivedDate + "T00:00:00Z").getTime() - valid.getTime()) /
    86400000;
  if (age > 14) return { status: "ignored", reason: "İşlem 14 günden eski." };
  if (age < 0)
    return {
      status: "error",
      reason: "İleri tarihli işlem; elle kontrol gerekli.",
    };
  const merchant =
    body
      .match(
        /(?:İşyeri|Isyeri|Gönderen|Gonderen|Alıcı|Alici)\s*:\s*([^\n;]+)/i,
      )?.[1]
      ?.trim() ||
    body.match(/(?:işyerinde|iş\s*yerinde)\s+(.+?)(?:\.|$)/i)?.[1]?.trim() ||
    body
      .match(
        /\b(?:\d+[,.]?\d*\s*(?:TL|TRY))\s+(.+?)\s+(?:işyerinden|işyerinde)/i,
      )?.[1]
      ?.trim();
  if (!merchant || merchant.length > 200)
    return { status: "error", reason: "İşyeri veya gönderen adı okunamadı." };
  return {
    status: "ok",
    amount,
    merchant,
    occurred_on: date,
    direction: income ? "income" : "expense",
    bank: /yapı kredi|yapikredi/i.test(lower)
      ? "Yapı Kredi"
      : /iş bankası|işbank|isbank/i.test(lower)
        ? "İş Bankası"
        : "Diğer",
  };
}
export const transactionFingerprint = (p: {
  occurred_on: string;
  direction: string;
  amount: number;
  merchant: string;
}) =>
  `${p.occurred_on}|${p.direction}|${p.amount.toFixed(2)}|${normalizeMerchant(p.merchant)}`;
