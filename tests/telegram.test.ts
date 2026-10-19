import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanReceipt,
  missingReceipt,
  parseCallback,
  privateIdentity,
  modelErrorMessage,
} from "../lib/telegram-validation";
test("Telegram yalnızca gerçek kullanıcının kendi özel sohbetini kabul eder", () => {
  assert.equal(
    privateIdentity({ chat: { type: "private", id: 123 }, from: { id: 123 } }),
    123,
  );
  for (const message of [
    { chat: { type: "group", id: -123 }, from: { id: 123 } },
    { chat: { type: "private", id: 456 }, from: { id: 123 } },
    { chat: { type: "private", id: 123 }, from: { id: 123, is_bot: true } },
    { chat: { type: "private", id: 123 } },
  ])
    assert.equal(privateIdentity(message), null);
});
test("Fişte eksik veya belirsiz alanlar uydurulmaz", () => {
  const receipt = cleanReceipt({
    amount: 0,
    merchant: " ",
    occurred_on: "2026-02-30",
    currency: "USD",
  });
  assert.deepEqual(receipt, {
    amount: null,
    merchant: null,
    occurred_on: null,
    currency: null,
  });
  assert.match(missingReceipt(receipt), /tutar.*işyeri.*tarih.*para birimi/);
  assert.equal(cleanReceipt({ amount: NaN }).amount, null);
  assert.equal(cleanReceipt({ amount: 1e12 }).amount, null);
  assert.equal(cleanReceipt({ occurred_on: "2999-01-01" }).occurred_on, null);
});
test("TRY fişi iki ondalıkla doğrulanır", () => {
  const receipt = cleanReceipt({
    amount: 123.456,
    merchant: " Migros ",
    occurred_on: "2026-01-01",
    currency: "TRY",
  });
  assert.deepEqual(receipt, {
    amount: 123.46,
    merchant: "Migros",
    occurred_on: "2026-01-01",
    currency: "TRY",
  });
  assert.equal(missingReceipt(receipt), "");
});
test("Telegram kova düğmeleri yalnızca geçerli eylem kimliği ve indeksi taşır", () => {
  const id = "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb";
  const value = `b:${id}:4`;
  assert.ok(Buffer.byteLength(value) <= 64);
  assert.deepEqual(parseCallback(value), { kind: "b", id, index: 4 });
  for (const invalid of [
    `delete:${id}:4`,
    `b:${id}:-1`,
    `b:${id}:1000`,
    "b:other:4",
    null,
  ])
    assert.equal(parseCallback(invalid), null);
});
test("Gemini limit ve servis hataları sır içermeyen Türkçe yanıt verir", () => {
  assert.match(
    modelErrorMessage({ status: 429, message: "secret" }),
    /limit doldu/,
  );
  assert.doesNotMatch(modelErrorMessage(new Error("secret")), /secret/);
});
