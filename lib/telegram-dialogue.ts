import {
  cleanReceipt,
  missingReceipt,
  type Receipt,
} from "./telegram-validation";
import { money, todayTR } from "./finance";
export type NamedChoice = { id: string; name: string; bank?: string };
export type Catalog = { accounts: NamedChoice[]; buckets: NamedChoice[] };
export type Plan = {
  intent:
    | "transaction"
    | "continue"
    | "assign_bucket"
    | "query"
    | "unsupported"
    | "clarify"
    | "edit"
    | "delete"
    | "confirm"
    | "cancel";
  target_merchant?: string | null;
  target_amount?: number | null;
  target_date?: string | null;
  target_last?: boolean;
  target_id?: string;
  amount: number | null;
  merchant: string | null;
  occurred_on: string | null;
  date_explicit: boolean;
  currency: string | null;
  direction: "expense" | "income" | null;
  account_name: string | null;
  bucket_name: string | null;
  question: string | null;
  query: string | null;
};
export type DialogueAction = {
  id: string;
  owner_id: number;
  transaction_id: string | null;
  payload: {
    receipt: Receipt;
    account_ids: string[];
    bucket_ids: string[];
    source?: "text" | "photo";
    direction?: "expense" | "income";
    account_name?: string | null;
    bucket_name?: string | null;
  };
};
export type TransactionView = {
  id: string;
  merchant: string;
  amount: number;
  occurred_on: string;
  direction: string;
  bucket_id: string | null;
  account_id: string | null;
};
export type Reply = {
  text: string;
  keyboard?: { inline_keyboard: { text: string; callback_data: string }[][] };
};
export type DialogueState = {
  pending_mutation_id?: string | null;
  edit_choices?: string[];
  edit_plan?: Plan;
  active_action_id?: string | null;
  recent?: { user: string; answer: string }[];
  last_update_id?: number;
  last_reply?: Reply;
};
export interface DialoguePorts {
  change?(
    plan: Plan,
    active: DialogueAction | null,
    state: DialogueState,
    updateId: number,
  ): Promise<{ reply: Reply; state: Partial<DialogueState> }>;
  catalog(): Promise<Catalog>;
  state(): Promise<DialogueState>;
  saveState(state: DialogueState): Promise<void>;
  action(id: string): Promise<DialogueAction | null>;
  saveAction(action: DialogueAction): Promise<DialogueAction>;
  transaction(id: string): Promise<TransactionView | null>;
  commit(
    action: DialogueAction,
    account: string,
    bucket: string | null,
  ): Promise<{ transaction: TransactionView; duplicate: boolean }>;
  assign(action: DialogueAction, bucket: string): Promise<boolean>;
  plan(
    text: string,
    state: DialogueState,
    active: DialogueAction | null,
    catalog: Catalog,
  ): Promise<Plan>;
  query(text: string, recent: DialogueState["recent"]): Promise<string>;
  actionId(updateId: number): string;
}
export const fold = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function findNamed(
  name: string | null | undefined,
  rows: NamedChoice[],
) {
  if (!name) return null;
  const needle = fold(name);
  const exact = rows.filter((r) => fold(r.name) === needle);
  if (exact.length === 1) return exact[0];
  const bank = rows.filter((r) => r.bank && fold(r.bank) === needle);
  return bank.length === 1 ? bank[0] : null;
}
export function directChoice(text: string, rows: NamedChoice[]) {
  const simple = fold(text)
    .replace(
      /\b(kova|kovasi|kovasina|kovasini|kategori|kategorisi|kategorisine|kategorisini|sec|olsun|koy|yerlestir|ata|hesap|hesabi|hesabindan|evet|lutfen)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  return rows.find((r) => fold(r.name) === simple) || null;
}
const emptyPlan = (): Plan => ({
  intent: "clarify",
  amount: null,
  merchant: null,
  occurred_on: null,
  date_explicit: false,
  currency: null,
  direction: null,
  account_name: null,
  bucket_name: null,
  question: null,
  query: null,
});
function keyboard(
  a: DialogueAction,
  rows: NamedChoice[],
  kind: "a" | "b",
): Reply["keyboard"] {
  const ids = kind === "a" ? a.payload.account_ids : a.payload.bucket_ids;
  return {
    inline_keyboard: rows
      .filter((r) => ids.includes(r.id))
      .slice(0, 50)
      .map((r) => [
        {
          text: r.name.slice(0, 50),
          callback_data: `${kind}:${a.id}:${ids.indexOf(r.id)}`,
        },
      ]),
  };
}
export async function dialogueTurn(
  owner: number,
  updateId: number,
  text: string,
  ports: DialoguePorts,
  forcedPlan?: Partial<Plan> & Pick<Plan, "intent">,
): Promise<Reply> {
  const state = await ports.state();
  if (state.last_update_id === updateId && state.last_reply)
    return state.last_reply;
  const catalog = await ports.catalog();
  let active = state.active_action_id
    ? await ports.action(state.active_action_id)
    : null;
  const existing = await ports.action(ports.actionId(updateId));
  const recordReply = async (reply: Reply) => {
    await ports.saveState({
      ...state,
      active_action_id: active?.id || null,
      recent: [
        ...(state.recent || []),
        { user: text.slice(0, 700), answer: reply.text.slice(0, 900) },
      ].slice(-6),
      last_update_id: updateId,
      last_reply: reply,
    });
    return reply;
  };
  const finish = async (a: DialogueAction): Promise<Reply> => {
    active = a;
    if (a.transaction_id) {
      const tx = await ports.transaction(a.transaction_id);
      if (!tx)
        return recordReply({
          text: "Bu kayıt artık bulunmuyor. Yeni bir işlem eklemek istersen tutar ve açıklamasını yaz.",
        });
      return recordReply({
        text: `İşlem zaten kayıtlı: ${tx.merchant} · ${money(Number(tx.amount))}. Tekrar eklemedim.${tx.direction === "expense" && !tx.bucket_id ? " Kova bekliyor." : ""}`,
        keyboard:
          tx.direction === "expense" && !tx.bucket_id
            ? keyboard(a, catalog.buckets, "b")
            : undefined,
      });
    }
    const missing = missingReceipt(a.payload.receipt);
    if (missing)
      return recordReply({
        text: `Henüz kaydetmedim. ${a.payload.receipt.amount ? money(a.payload.receipt.amount) + " için " : ""}Eksik bilgi: ${missing}. Kısa bir yanıtla tamamlayabilirsin; vazgeçmek için /iptal.`,
      });
    if (!catalog.accounts.length)
      return recordReply({
        text: "Önce panelde bir hesap eklemelisin. İşlemi henüz kaydetmedim.",
      });
    const account =
      findNamed(a.payload.account_name, catalog.accounts) ||
      (!a.payload.account_name && catalog.accounts.length === 1
        ? catalog.accounts[0]
        : null);
    if (!account)
      return recordReply({
        text: `${money(a.payload.receipt.amount!)} · ${a.payload.receipt.merchant}\nHangi hesaptan ${a.payload.direction === "income" ? "alındı" : "ödendi"}? ${catalog.accounts.map((a) => a.name).join(", ")}. Henüz kaydetmedim.`,
        keyboard: keyboard(a, catalog.accounts, "a"),
      });
    const bucket =
      a.payload.direction === "income"
        ? null
        : findNamed(a.payload.bucket_name, catalog.buckets);
    if (a.payload.direction !== "income" && a.payload.bucket_name && !bucket)
      return recordReply({
        text: `“${a.payload.bucket_name}” adlı kovayı bulamadım. ${catalog.buckets.map((b) => b.name).join(", ")} arasından seçebilir veya “kovasız kaydet” yazabilirsin. Henüz kaydetmedim.`,
        keyboard: keyboard(a, catalog.buckets, "b"),
      });
    const saved = await ports.commit(
      a,
      account.id,
      a.payload.direction === "income" ? null : bucket?.id || null,
    );
    a.transaction_id = saved.transaction.id;
    const tx = saved.transaction;
    const currentBucket = catalog.buckets.find((b) => b.id === tx.bucket_id);
    return recordReply({
      text: `${saved.duplicate ? "Bu işlem zaten kayıtlı; ikinci kez eklemedim." : tx.direction === "income" ? "Gelir kaydedildi." : "Harcama kaydedildi."}\n${tx.merchant} · ${money(Number(tx.amount))}\n${tx.occurred_on} · ${account.name}${tx.direction === "expense" ? `\n${currentBucket ? "Kova: " + currentBucket.name : "Kova: Bekleyenler. İstersen yalnızca kova adını yaz veya düğmeden seç."}` : ""}`,
      keyboard:
        tx.direction === "expense" && !tx.bucket_id
          ? keyboard(a, catalog.buckets, "b")
          : undefined,
    });
  };
  if (existing) return finish(existing);
  const chosenBucket = active ? directChoice(text, catalog.buckets) : null;
  const chosenAccount =
    active && !active.transaction_id
      ? directChoice(text, catalog.accounts)
      : null;
  const editSelection =
    state.edit_choices && /^\d{1,2}$/.test(text.trim())
      ? state.edit_choices[Number(text.trim()) - 1]
      : null;
  const plan =
    editSelection && state.edit_plan
      ? { ...state.edit_plan, target_id: editSelection }
      : state.pending_mutation_id &&
          /^(?:\/onay|onayla|evet|onaylıyorum)$/i.test(text.trim())
        ? { ...emptyPlan(), intent: "confirm" as const }
        : forcedPlan
          ? { ...emptyPlan(), ...forcedPlan }
          : chosenBucket
            ? {
                ...emptyPlan(),
                intent: "assign_bucket" as const,
                bucket_name: chosenBucket.name,
              }
            : chosenAccount
              ? {
                  ...emptyPlan(),
                  intent: "continue" as const,
                  account_name: chosenAccount.name,
                }
              : await ports.plan(text, state, active, catalog);
  if (plan.intent === "cancel") {
    state.pending_mutation_id = null;
    state.edit_choices = undefined;
    state.edit_plan = undefined;
    active = null;
    return recordReply({
      text: "Konuşmadaki taslağı bıraktım. Kaydedilmiş işlemleri silmedim.",
    });
  }
  if (
    plan.intent === "edit" ||
    plan.intent === "delete" ||
    plan.intent === "confirm"
  ) {
    if (!ports.change)
      return recordReply({ text: "Bu değişiklik şu anda kullanılamıyor." });
    const result = await ports.change(plan, active, state, updateId);
    Object.assign(state, result.state);
    return recordReply(result.reply);
  }
  if (plan.intent === "query")
    return recordReply({
      text: await ports.query(plan.query || text, state.recent),
    });
  if (plan.intent === "unsupported")
    return recordReply({
      text: "Metinle gelir/gider ekleyebilir ve kova bekleyen son işlemi yerleştirebilirim. Kaydedilmiş tutar/tarih değişikliklerini ve silmeyi panelden yapabilirsin; bu mesajla mevcut kayıtları değiştirmedim.",
    });
  if (plan.intent === "assign_bucket") {
    if (!active)
      return recordReply({
        text: "Hangi harcamaya uygulayayım? Henüz bu konuşmada seçili bir işlem yok. Tutar ve açıklamayla yeni harcama yazabilir ya da panelde Bekleyenler’den kaydı seçebilirsin.",
      });
    const bucket = findNamed(plan.bucket_name, catalog.buckets);
    if (!bucket)
      return recordReply({
        text: `Hangi kova? ${catalog.buckets.map((b) => b.name).join(", ")}.`,
        keyboard: keyboard(active, catalog.buckets, "b"),
      });
    if (!active.transaction_id) {
      active.payload.bucket_name = bucket.name;
      active = await ports.saveAction(active);
      return finish(active);
    }
    const tx = await ports.transaction(active.transaction_id);
    if (!tx) return recordReply({ text: "Bu işlem panelde artık bulunmuyor." });
    if (tx.direction !== "expense")
      return recordReply({
        text: "Bu kayıt bir gelir; gelirler harcama kovasına yerleştirilmez.",
      });
    if (tx.bucket_id) {
      if (ports.change) {
        const result = await ports.change(
          { ...plan, intent: "edit", target_id: tx.id },
          active,
          state,
          updateId,
        );
        Object.assign(state, result.state);
        return recordReply(result.reply);
      }
      const selected = catalog.buckets.find((b) => b.id === tx.bucket_id);
      return recordReply({
        text: `${tx.merchant} · ${money(Number(tx.amount))} zaten ${selected?.name || "seçilmiş"} kovasında. Tekrar harcama eklemedim; mevcut kova değişikliği için paneli kullanabilirsin.`,
      });
    }
    const applied = await ports.assign(active, bucket.id);
    return recordReply({
      text: applied
        ? `${tx.merchant} · ${money(Number(tx.amount))} → ${bucket.name}. Kova seçimi kaydedildi; ikinci harcama oluşturulmadı.`
        : "Kayıt değişmiş veya zaten yerleştirilmiş. Yeni harcama eklemedim.",
    });
  }
  if (plan.intent !== "transaction" && plan.intent !== "continue")
    return recordReply({
      text: "Örneğin “250 TL market harcaması yaptım” yazabilir, fiş fotoğrafı gönderebilir veya finans sorusu sorabilirsin.",
    });
  if (plan.intent === "continue" && (!active || active.transaction_id))
    return recordReply({
      text: "Şu anda tamamlanmayı bekleyen bir taslak yok. Yeni işlem için tutar ve açıklamasını birlikte yazabilirsin.",
    });
  let a: DialogueAction;
  state.pending_mutation_id = null;
  state.edit_choices = undefined;
  state.edit_plan = undefined;
  if (plan.intent === "transaction")
    a = {
      id: ports.actionId(updateId),
      owner_id: owner,
      transaction_id: null,
      payload: {
        source: "text",
        direction: plan.direction || "expense",
        receipt: {
          amount: null,
          merchant: null,
          occurred_on: plan.date_explicit ? null : todayTR(),
          currency: "TRY",
        },
        account_ids: catalog.accounts.map((a) => a.id),
        bucket_ids: catalog.buckets.map((b) => b.id),
      },
    };
  else a = active!;
  const previous = a.payload.receipt;
  a.payload.receipt = cleanReceipt({
    amount: plan.amount ?? previous.amount,
    merchant: plan.merchant ?? previous.merchant,
    occurred_on: plan.date_explicit
      ? plan.occurred_on
      : (plan.occurred_on ?? previous.occurred_on),
    currency: plan.currency ?? previous.currency,
  });
  if (plan.direction) a.payload.direction = plan.direction;
  if (plan.account_name) a.payload.account_name = plan.account_name;
  if (plan.bucket_name) a.payload.bucket_name = plan.bucket_name;
  if (/kovas[ıi]z\s+kaydet/i.test(text)) a.payload.bucket_name = null;
  a = await ports.saveAction(a);
  return finish(a);
}
