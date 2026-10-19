import test from "node:test";
import assert from "node:assert/strict";
import { findNamed, directChoice } from "../lib/telegram-dialogue";
import { fixture, plan, A, B, K, K2 } from "./telegram-fixture";
test("Ekrandaki akış: 250 TL market ekle → zorunlu yaşam; tek işlem ve doğru kova", async () => {
  const f = fixture([plan()]);
  const first = await f.turn(1, "250 tl market harcaması yaptım");
  assert.match(first.text, /Harcama kaydedildi/);
  assert.equal(f.rows.size, 1);
  assert.equal([...f.rows.values()][0].bucket_id, null);
  const second = await f.turn(2, "zorunlu yaşam");
  assert.match(second.text, /Kova seçimi kaydedildi/);
  assert.equal([...f.rows.values()][0].bucket_id, K);
  assert.equal(f.rows.size, 1);
  assert.equal(f.queries, 0);
});
test("Kova ilk mesajda açık verilirse tekrar sorulmaz", async () => {
  const f = fixture([plan({ bucket_name: "zorunlu yasam" })]);
  const r = await f.turn(1, "250 tl zorunlu yaşam market harcaması yaptım");
  assert.match(r.text, /Kova: Zorunlu yaşam/);
  assert.equal([...f.rows.values()][0].bucket_id, K);
  assert.equal(f.commits, 1);
});
test("Eksik açıklama sonraki mesajda tamamlanır; tutar kaybolmaz", async () => {
  const f = fixture([
    plan({ merchant: null }),
    plan({
      intent: "continue",
      amount: null,
      merchant: "Market",
      direction: null,
      currency: null,
    }),
  ]);
  assert.match(
    (await f.turn(1, "250 TL harcama ekle")).text,
    /Henüz kaydetmedim/,
  );
  assert.equal(f.rows.size, 0);
  assert.match((await f.turn(2, "market")).text, /Harcama kaydedildi/);
  assert.equal([...f.rows.values()][0].amount, 250);
});
test("Birden fazla hesapta seçim sorulur, düz hesap cevabıyla kayıt tamamlanır", async () => {
  const f = fixture([plan()], {
    accounts: [
      { id: A, name: "Yapı Kredi" },
      { id: B, name: "İş Bankası" },
    ],
    buckets: [{ id: K, name: "Zorunlu yaşam" }],
  });
  assert.match(
    (await f.turn(1, "250 TL market harcaması yaptım")).text,
    /Hangi hesaptan/,
  );
  assert.equal(f.rows.size, 0);
  await f.turn(2, "İş Bankası");
  assert.equal([...f.rows.values()][0].account_id, B);
  assert.equal(f.rows.size, 1);
});
test("Araya sorgu girince son işlem için kova seçimi unutulmaz", async () => {
  const f = fixture([
    plan(),
    plan({ intent: "query", query: "Bu ay harcamam ne kadar?" }),
  ]);
  await f.turn(1, "250 TL market harcaması yaptım");
  await f.turn(2, "bu ay ne kadar harcadım");
  await f.turn(3, "zorunlu yaşam kategorisini seç");
  assert.equal(f.queries, 1);
  assert.equal(f.assigns, 1);
  assert.equal(f.rows.size, 1);
});
test("Aynı webhook güncellemesi tekrarlanırsa cevap önbellekten gelir", async () => {
  const f = fixture([plan()]);
  const first = await f.turn(1, "250 TL market harcaması yaptım");
  assert.deepEqual(await f.turn(1, "250 TL market harcaması yaptım"), first);
  assert.equal(f.commits, 1);
  assert.equal(f.rows.size, 1);
});
test("Mevcut kova sessizce değiştirilmez; yeni harcama da oluşmaz", async () => {
  const f = fixture([plan({ bucket_name: "Zorunlu yaşam" })]);
  await f.turn(1, "250 TL zorunlu yaşam market");
  const r = await f.turn(2, "Esnek");
  assert.match(r.text, /zaten Zorunlu yaşam/);
  assert.equal([...f.rows.values()][0].bucket_id, K);
  assert.equal(f.rows.size, 1);
});
test("İleri tarih veya desteklenmeyen döviz kayda dönüşmez", async () => {
  const f = fixture([
    plan({ date_explicit: true, occurred_on: "2999-01-01" }),
    plan({ currency: "USD" }),
  ]);
  assert.match((await f.turn(1, "2999 tarihinde 250 TL market")).text, /tarih/);
  assert.equal(f.rows.size, 0);
  assert.match(
    (await f.turn(2, "250 USD market harcaması")).text,
    /para birimi/,
  );
  assert.equal(f.rows.size, 0);
});
test("Veritabanı başarısızsa kaydedildi yanıtı üretilmez", async () => {
  const f = fixture([plan()]);
  f.ports.commit = async () => {
    throw new Error("DB failed");
  };
  await assert.rejects(() => f.turn(1, "250 TL market"), /DB failed/);
  assert.equal(f.state.last_reply, undefined);
  assert.equal(f.rows.size, 0);
});
test("İptal kaydedilmiş işlemi silmez; son işlem bağlantısını bırakır", async () => {
  const f = fixture([plan(), plan({ intent: "cancel" })]);
  await f.turn(1, "250 TL market");
  await f.turn(2, "iptal");
  assert.equal(f.rows.size, 1);
  assert.equal(f.state.active_action_id, null);
});
test("Gelir mesajı gelir olarak kaydedilir; kova sorulmaz", async () => {
  const f = fixture([
    plan({ direction: "income", amount: 50000, merchant: "Maaş" }),
  ]);
  const r = await f.turn(1, "50000 TL maaş geldi");
  assert.match(r.text, /Gelir kaydedildi/);
  assert.doesNotMatch(r.text, /Kova:/);
  assert.equal([...f.rows.values()][0].direction, "income");
});
test("Hesap/kova belirsiz adları yanlış seçenekle eşleştirmez", () => {
  assert.equal(
    findNamed("ZORUNLU YASAM", [{ id: K, name: "Zorunlu yaşam" }])?.id,
    K,
  );
  assert.equal(findNamed("yaşam", [{ id: K, name: "Zorunlu yaşam" }]), null);
  assert.equal(
    directChoice("Bu ay zorunlu yaşamda ne kadar harcadım", [
      { id: K, name: "Zorunlu yaşam" },
    ]),
    null,
  );
});
test("Sorgu ve desteklenmeyen silme isteği hiçbir kayıt oluşturmaz", async () => {
  const f = fixture([
    plan({ intent: "query", query: "250 TL harcama eklenmiş mi?" }),
    plan({ intent: "unsupported" }),
  ]);
  await f.turn(1, "250 TL harcama eklenmiş mi?");
  const r = await f.turn(2, "Bütün işlemleri sil");
  assert.match(r.text, /değiştirmedim/);
  assert.equal(f.rows.size, 0);
  assert.equal(f.queries, 1);
});
