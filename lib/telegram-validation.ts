import { todayTR } from "./finance";
export class TelegramInputError extends Error {}
export type Receipt = {
  amount: number | null;
  merchant: string | null;
  occurred_on: string | null;
  currency: string | null;
};
export function cleanReceipt(input: unknown): Receipt {
  const r =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const amount =
    typeof r.amount === "number" &&
    Number.isFinite(r.amount) &&
    r.amount > 0 &&
    r.amount <= 1e11
      ? Math.round(r.amount * 100) / 100
      : null;
  const merchant =
    typeof r.merchant === "string" && r.merchant.trim().length <= 200
      ? r.merchant.trim() || null
      : null;
  const date = typeof r.occurred_on === "string" ? r.occurred_on : "";
  const occurred_on =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date &&
    date <= todayTR()
      ? date
      : null;
  return {
    amount,
    merchant,
    occurred_on,
    currency: r.currency === "TRY" ? "TRY" : null,
  };
}
export function missingReceipt(r: Receipt) {
  return [
    !r.amount && "tutar",
    !r.merchant && "işyeri",
    !r.occurred_on && "tarih (YYYY-AA-GG)",
    !r.currency && "para birimi (TRY)",
  ]
    .filter(Boolean)
    .join(", ");
}
export function parseCallback(value: unknown) {
  if (typeof value !== "string") return null;
  const m =
    /^([ab]):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(\d{1,3})$/i.exec(
      value,
    );
  return m ? { kind: m[1], id: m[2], index: Number(m[3]) } : null;
}
export function privateIdentity(message: {
  chat?: { id?: number; type?: string };
  from?: { id?: number; is_bot?: boolean };
}) {
  const id = message.from?.id;
  return typeof id === "number" &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    message.from?.is_bot !== true &&
    message.chat?.type === "private" &&
    message.chat?.id === id
    ? id
    : null;
}
export function modelErrorMessage(error: unknown) {
  const status =
    error && typeof error === "object"
      ? "status" in error
        ? Number(error.status)
        : "code" in error
          ? Number(error.code)
          : 0
      : 0;
  return status === 429
    ? "Günlük ücretsiz limit doldu, biraz sonra dene."
    : "Gemini şu an yanıt veremiyor. Biraz sonra tekrar dene; mevcut kayıtların korunuyor.";
}
