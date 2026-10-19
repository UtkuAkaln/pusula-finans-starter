"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coffee,
  Download,
  Ellipsis,
  ExternalLink,
  Flame,
  Inbox,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Navigation,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  Zap,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { EMPTY_DATA, type FinanceData, type Transaction } from "@/lib/types";
import {
  accountBalance,
  recurringDates,
  recurringOccurrences,
  recurringPayment,
  recurringPeriodStart,
  weekdays,
  budgets,
  dueDate,
  expectedPayments,
  monthKey,
  monthLabel,
  money,
  monthly,
  normalizeMerchant,
  projection,
  recurringSuggestions,
  savingPace,
  shiftMonth,
  sum,
  todayTR,
  trend,
} from "@/lib/finance";
import {
  readLocalData,
  writeLocalData,
  applyLocalAction,
  isLocalDataEvent,
} from "@/lib/local-data";
import EntityModal, { type ModalState } from "./entity-modal";
import SavingsPage from "./savings-page";
import { overviewSummary } from "@/lib/overview";
import {
  FlowChart,
  ProjectionChart,
  BucketHistoryChart,
  SpendingDonut,
} from "./charts";
import { expenseDistribution } from "@/lib/insights";
import {
  CardsPanel,
  WeeklyPanel,
  SubscriptionsPanel,
  ClassificationPanel,
  AutomationSettings,
} from "./finance-features";
const NAV = [
  { key: "panel", url: "/", label: "Genel bakış", icon: LayoutDashboard },
  { key: "islemler", url: "/islemler", label: "İşlemler", icon: ArrowDownLeft },
  {
    key: "gelirler",
    url: "/gelirler",
    label: "Gelir kaynakları",
    icon: Landmark,
  },
  {
    key: "sabitler",
    url: "/sabitler",
    label: "Sabit giderler",
    icon: ReceiptText,
  },
  {
    key: "hedefler",
    url: "/hedefler",
    label: "Hedef ve Birikimler",
    icon: Target,
  },
];
const TITLES: Record<string, [string, string]> = {
  panel: [
    "Paranın yönü net.",
    "Bugün nerede olduğunu gör, yarın nereye gideceğine karar ver.",
  ],
  islemler: [
    "Her hareket, bir hikâye.",
    "Gelirlerini ve harcamalarını tek bir yerden takip et.",
  ],
  gelirler: [
    "Emeğinin karşılığı.",
    "Gelir kaynakların, beklenen ödemelerin ve büyüyen imkânların.",
  ],
  sabitler: [
    "Planlı gider, rahat bir ay.",
    "Her ay neyin, ne zaman ödeneceğini önceden bil.",
  ],
  hesaplar: [
    "Bugünden yarına.",
    "Hesaplarının durumunu gör, hayallerine yer aç.",
  ],
  hedefler: [
    "Bugünden yarına, adım adım.",
    "Birikimlerinin değerini gör, hedeflerine ne kadar yaklaştığını takip et.",
  ],
  ayarlar: [
    "Sana uyan bir düzen.",
    "Kovalarını ve kişisel finans akışını kendine göre şekillendir.",
  ],
};
const dateLabel = (s: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(
    new Date(s + "T12:00:00"),
  );
const humanType: Record<string, string> = {
  salary: "Maaş",
  client: "Müşteri",
  sponsor: "Sponsor",
  rent: "Kira",
  sales: "Satış",
  other: "Diğer",
};
const shortBucket = (kind: string, name: string) =>
  ({
    living: "Yaşam",
    fixed: "Faturalar",
    leisure: "Keyif",
    flexible: "Esnek",
    savings: "Birikim",
  })[kind] || name;
function MerchantIcon({ name }: { name: string }) {
  const n = name.toLocaleLowerCase("tr");
  const Icon = /migros|carrefour|market/.test(n)
    ? ShoppingBag
    : /petra|kahve|coffee/.test(n)
      ? Coffee
      : /shell|petrol/.test(n)
        ? Flame
        : /maaş|tasarım/.test(n)
          ? Landmark
          : ReceiptText;
  return (
    <span
      className={
        "merchant-icon " +
        (/migros|carrefour/.test(n)
          ? "orange"
          : /petra/.test(n)
            ? "lavender"
            : /shell/.test(n)
              ? "yellow"
              : "mint")
      }
    >
      <Icon size={18} />
    </span>
  );
}
function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Sparkles size={24} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
export default function FinanceApp({ section }: { section: string }) {
  const [data, setData] = useState<FinanceData>(EMPTY_DATA),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [connected, setConnected] = useState(false),
    [month, setMonth] = useState(monthKey()),
    [modal, setModal] = useState<ModalState | null>(null),
    [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [search, setSearch] = useState(""),
    [direction, setDirection] = useState("all"),
    [accountFilter, setAccountFilter] = useState("all"),
    [history, setHistory] = useState(6),
    [distribution, setDistribution] = useState<"bucket" | "merchant">(
      "merchant",
    ),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [remember, setRemember] = useState<Record<string, boolean>>({}),
    [working, setWorking] = useState(false),
    [confirm, setConfirm] = useState<{
      title: string;
      body: string;
      action: Record<string, unknown>;
    } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const notify = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );
  const load = useCallback(
    async (_process = false) => {
      setRefreshing(true);
      try {
        setData(readLocalData());
        setConnected(true);
      } catch (e) {
        setConnected(false);
        notify(e instanceof Error ? e.message : "Bağlantı kurulamadı.", true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [notify],
  );
  useEffect(() => {
    load();
    const onStorage = (event: StorageEvent) => {
      if (isLocalDataEvent(event)) void load();
    };
    window.addEventListener("storage", onStorage);
    const query = new URLSearchParams(window.location.search).get("q");
    if (query) setSearch(query);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setModal(null);
        setConfirm(null);
        setNotifications(false);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  async function mutate(body: Record<string, unknown>) {
    setWorking(true);
    try {
      const next = applyLocalAction(readLocalData(), body);
      writeLocalData(next);
      await load();
      notify(
        body.action === "clear_demo"
          ? "Örnek veriler temizlendi."
          : "Değişiklik kaydedildi.",
      );
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "İşlem tamamlanamadı.", true);
      return false;
    } finally {
      setWorking(false);
    }
  }
  function edit(table: string, title: string, record?: object) {
    setModal({
      table,
      title,
      record: record as Record<string, unknown> | undefined,
    });
  }
  function remove(table: string, id: string, name: string) {
    setConfirm({
      title: "Kaydı sil?",
      body: `“${name}” silinecek.${table === "income_sources" ? " Geçmiş gelirlerin korunacak ve kaynaksız görünecek." : ""}`,
      action: { action: "delete", table, id },
    });
  }
  const tx = monthly(data, month),
    spend = sum(tx, "expense"),
    income = sum(tx, "income"),
    pending = data.transactions.filter(
      (t) => t.direction === "expense" && !t.bucket_id,
    ),
    budgetRows = budgets(data, month),
    total = data.accounts.reduce((s, a) => s + accountBalance(data, a.id), 0),
    payments = expectedPayments(data, month),
    flow = trend(data, month, history),
    forecast = projection(data, month),
    demo =
      data.transactions.some((t) => t.is_demo) ||
      data.accounts.some((a) => a.is_demo),
    issues = data.raw_notifications.filter((n) => n.status === "error"),
    unlinked = data.transactions.filter((t) => !t.account_id),
    ratioTotal = data.buckets.reduce((s, b) => s + Number(b.ratio), 0);
  const totalBudget = budgetRows
      .filter((b) => b.kind !== "savings")
      .reduce((s, b) => s + b.budget, 0),
    remainingBudget = totalBudget - spend;
  const overview = overviewSummary(data, month);
  const [latestTransaction, previousTransaction] = overview.recent;
  const signedAmount = (t: Transaction) =>
    (t.direction === "income" ? "+" : "−") + money(Number(t.amount));
  function showAccounts() {
    const section = document.getElementById("hesaplar");
    if (section instanceof HTMLDetailsElement) section.open = true;
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const filtered = data.transactions.filter(
    (t) =>
      t.occurred_on.startsWith(month) &&
      (direction === "all" || t.direction === direction) &&
      (accountFilter === "all" || t.account_id === accountFilter) &&
      normalizeMerchant(t.merchant + " " + t.note).includes(
        normalizeMerchant(search),
      ),
  );
  const topMerchants = Object.entries(
    tx
      .filter((t) => t.direction === "expense")
      .reduce<Record<string, number>>((a, t) => {
        a[t.merchant] = (a[t.merchant] || 0) + Number(t.amount);
        return a;
      }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const goLink = (url: string, label: string) => (
    <Link href={url} className="text-link">
      {label}
      <ArrowUpRight size={14} />
    </Link>
  );
  function downloadCsv() {
    const cols = [
      "Tarih",
      "Yön",
      "İşyeri",
      "Tutar",
      "Para birimi",
      "Kova",
      "Hesap",
      "Not",
    ];
    const safe = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+@\-]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const csv =
      "\ufeff" +
      [
        cols,
        ...filtered.map((t) => [
          t.occurred_on,
          t.direction === "income" ? "Gelir" : "Gider",
          t.merchant,
          t.amount,
          "TRY",
          data.buckets.find((b) => b.id === t.bucket_id)?.name || "",
          data.accounts.find((a) => a.id === t.account_id)?.name || "",
          t.note,
        ]),
      ]
        .map((row) => row.map(safe).join(";"))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `pusula-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const renderTransactionTable = () =>
    filtered.length ? (
      <div className="table-scroll">
        <table className="transaction-quick-table">
          <thead>
            <tr>
              <th>İŞLEM</th>
              <th>TARİH</th>
              <th>KOVA / KAYNAK</th>
              <th>HESAP</th>
              <th className="align-right">TUTAR</th>
              <th>
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="merchant-cell">
                    <MerchantIcon name={t.merchant} />
                    <div>
                      <strong>{t.merchant}</strong>
                      <small>
                        {t.method === "email"
                          ? "E-posta"
                          : t.method === "recurring"
                            ? "Sabit gider"
                            : "Manuel kayıt"}
                        {t.is_demo ? " · Örnek" : ""}
                      </small>
                    </div>
                  </div>
                </td>
                <td data-label="Tarih">{dateLabel(t.occurred_on)}</td>
                <td className="transaction-category-cell">
                  {t.direction === "expense" ? (
                    <div className="transaction-category-picker">
                      <span
                        className={"tag " + (!t.bucket_id ? "pending-tag" : "")}
                      >
                        <i
                          style={{
                            background:
                              data.buckets.find((b) => b.id === t.bucket_id)
                                ?.color || "#d7b87c",
                          }}
                        />
                        {data.buckets.find((b) => b.id === t.bucket_id)?.name ||
                          "Kova bekliyor"}
                      </span>
                      <div
                        className="bucket-buttons transaction-bucket-buttons"
                        role="group"
                        aria-label={`${t.merchant} için kova seç`}
                      >
                        {data.buckets.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            disabled={working}
                            aria-pressed={t.bucket_id === b.id}
                            title={b.name}
                            style={
                              {
                                "--bucket-color": b.color,
                              } as React.CSSProperties
                            }
                            onClick={() =>
                              mutate({
                                action: "assign",
                                id: t.id,
                                bucket_id: b.id,
                                remember: !!remember[t.id],
                              })
                            }
                          >
                            <span style={{ background: b.color }} />
                            {shortBucket(b.kind, b.name)}
                          </button>
                        ))}
                      </div>
                      <label className="transaction-remember">
                        <input
                          type="checkbox"
                          checked={!!remember[t.id]}
                          disabled={working}
                          onChange={(e) =>
                            setRemember((current) => ({
                              ...current,
                              [t.id]: e.target.checked,
                            }))
                          }
                        />
                        Bu işyeri için hatırla
                      </label>
                    </div>
                  ) : (
                    <span className="tag income-tag">
                      {data.income_sources.find(
                        (s) => s.id === t.income_source_id,
                      )?.name || "Kaynaksız"}
                    </span>
                  )}
                </td>
                <td data-label="Hesap">
                  {data.accounts.find((a) => a.id === t.account_id)?.name || (
                    <span className="warning-text">Hesap seçilmeli</span>
                  )}
                </td>
                <td
                  className={
                    "align-right amount " +
                    (t.direction === "income" ? "positive" : "")
                  }
                >
                  {t.direction === "income" ? "+" : "−"}
                  {money(Number(t.amount))}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`${t.merchant} düzenle`}
                      onClick={() => edit("transactions", "İşlemi düzenle", t)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-button danger-hover"
                      aria-label={`${t.merchant} sil`}
                      onClick={() => remove("transactions", t.id, t.merchant)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Bu görünüm henüz boş."
        body="Filtrelerini değiştirebilir veya ilk işlemini ekleyebilirsin."
        action={
          <button
            className="button secondary"
            onClick={() => edit("transactions", "Yeni işlem")}
          >
            İşlem ekle
          </button>
        }
      />
    );
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "is-open" : "")}>
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Navigation size={21} />
          </span>
          pusula<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">P</span>
          <div>
            <strong>Kişisel alanım</strong>
            <small>Finansal özgürlüğe doğru</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-caption">ÇALIŞMA ALANIN</span>
        <nav>
          {NAV.map((n) => (
            <Link
              href={n.url}
              key={n.key}
              className={"nav-item " + (section === n.key ? "active" : "")}
              onClick={() => setMobile(false)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.key === "islemler" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-insight">
            <span className="insight-icon">
              <TrendingUp size={18} />
            </span>
            <h4>Küçük adımlar, büyük farklar.</h4>
            <p>
              Her kaydettiğin harcama, bir sonraki hedefine biraz daha netlik
              katar.
            </p>
            <span className="insight-line" />
          </div>
          <Link
            href="/ayarlar"
            className={"nav-item " + (section === "ayarlar" ? "active" : "")}
          >
            <Settings2 size={18} />
            <span>Ayarlar</span>
          </Link>
          <a href="/ayarlar#kurulum" className="nav-item">
            <CircleHelp size={18} />
            <span>Kurulum & yardım</span>
            <ArrowUpRight size={13} />
          </a>
          <div className="profile">
            <span className="profile-avatar">P</span>
            <div>
              <strong>Kişisel alanım</strong>
              <small>Kişisel finans paneli</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Menüyü aç"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Kişisel alanım</span>
            <ChevronRight size={12} />
            <strong>
              {section === "ayarlar"
                ? "Ayarlar"
                : NAV.find((n) => n.key === section)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <form
              className="search-box"
              onSubmit={(e) => {
                e.preventDefault();
                if (section !== "islemler")
                  window.location.href =
                    "/islemler?q=" + encodeURIComponent(search);
              }}
            >
              <Search size={16} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İşlemlerinde ara…"
                aria-label="İşlemlerde ara"
              />
              <kbd>⌘ K</kbd>
            </form>
            <span className="top-divider" />
            <span className="connection">
              <i className="status-dot" />
              {loading
                ? "Bağlanıyor"
                : connected
                  ? "Bu tarayıcıda kayıtlı"
                  : "Bağlantı yok"}
            </span>
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label="Bildirimleri göster"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {issues.length > 0 && <i />}
              </button>
              {notifications && (
                <div className="notification-popover">
                  <h4>Bildirim merkezi</h4>
                  <p>
                    {issues.length
                      ? `${issues.length} e-posta elle kontrol bekliyor.`
                      : "Kontrol gerektiren e-posta yok."}
                  </p>
                  <p className="muted">
                    {pending.length} harcama kova atamanı bekliyor.
                  </p>
                  <Link
                    href="/ayarlar"
                    onClick={() => setNotifications(false)}
                    className="text-link"
                  >
                    Bildirim kuyruğuna git <ArrowUpRight size={13} />
                  </Link>
                </div>
              )}
            </div>
            <span className="top-avatar">P</span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {section === "panel"
                  ? "KİŞİSEL FİNANSINA GENİŞ BİR BAKIŞ"
                  : monthLabel(month).toLocaleUpperCase("tr")}
              </span>
              <h1>{TITLES[section][0]}</h1>
              <p>{TITLES[section][1]}</p>
            </div>
            <div className="heading-actions">
              {section === "hedefler" ? (
                <button
                  className="button primary"
                  onClick={() => edit("holdings", "Birikim ekle")}
                >
                  <Plus size={17} />
                  Birikim ekle
                </button>
              ) : (
                <>
                  <div className="month-picker">
                    <button
                      aria-label="Önceki ay"
                      onClick={() => setMonth(shiftMonth(month, -1))}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <label>
                      <input
                        type="month"
                        value={month}
                        onChange={(e) =>
                          e.target.value && setMonth(e.target.value)
                        }
                        aria-label="Ay seç"
                      />
                      <span>
                        {monthLabel(month)}
                        <ChevronDown size={13} />
                      </span>
                    </label>
                    <button
                      aria-label="Sonraki ay"
                      onClick={() => setMonth(shiftMonth(month, 1))}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => edit("transactions", "Yeni işlem")}
                  >
                    <Plus size={17} />
                    İşlem ekle
                  </button>
                </>
              )}
            </div>
          </div>
          {loading ? (
            <div className="skeleton-layout">
              <div />
              <div />
              <div />
              <div />
              <section />
              <section />
            </div>
          ) : (
            <>
              {demo && (
                <div className="demo-banner">
                  <FlaskIcon />
                  <span>
                    Keşfetmen için örnek veriler yüklü.{" "}
                    <b>Gerçek banka hareketlerini içermez.</b>
                  </span>
                  <button
                    onClick={() =>
                      setConfirm({
                        title: "Örnek verileri temizle?",
                        body: "Örnek işlemler, hesaplar, hedefler ve gelir kaynakları silinecek. Kendi eklediğin kayıtlar korunacak; örnek hesaba bağlı gerçek kayıt varsa temizleme duracak.",
                        action: { action: "clear_demo" },
                      })
                    }
                  >
                    Örnekleri temizle <X size={12} />
                  </button>
                </div>
              )}
              {unlinked.length > 0 && (
                <div className="notice warning">
                  <TriangleAlert size={17} />
                  <span>
                    {unlinked.length} işlemin hesabı eksik. Bakiyeye yansıması
                    için İşlemler sayfasından hesap seç.
                  </span>
                  {goLink("/islemler", "Hesap ata")}
                </div>
              )}
              {Math.abs(ratioTotal - 100) > 0.01 && (
                <div className="notice warning">
                  <TriangleAlert size={17} />
                  <span>
                    Kova oranların %{ratioTotal}. Dengeli dağılım için toplam
                    %100 olmalı.
                  </span>
                  {goLink("/ayarlar", "Düzenle")}
                </div>
              )}
              {section === "panel" && (
                <>
                  <section className="stats-grid" aria-label="Finans özeti">
                    <article className="stat-card total-stat">
                      <div className="stat-top">
                        <span>Elimdeki para</span>
                        <Wallet size={17} />
                      </div>
                      <h2>{money(overview.cash)}</h2>
                      <div className="stat-bottom">
                        <span className="stat-chip">
                          <span className="status-dot" />
                          Banka ve nakit
                        </span>
                        <button
                          className="stat-account-link"
                          onClick={showAccounts}
                          aria-label="Genel bakışta hesapları yönet"
                        >
                          {overview.cashAccountCount} hesapta
                        </button>
                      </div>
                      <div className="stat-spark">
                        <svg viewBox="0 0 110 42" aria-hidden="true">
                          <path
                            d="M1 40 L14 34 L26 36 L40 25 L55 28 L69 15 L81 19 L95 8 L109 2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-top">
                        <span>Bu ay harcanan</span>
                        <ArrowUpRight size={17} />
                      </div>
                      <h2 className="negative">−{money(spend, true)}</h2>
                      <div className="stat-bottom">
                        <span
                          className={remainingBudget < 0 ? "negative" : "muted"}
                        >
                          {remainingBudget < 0
                            ? "Bütçe aşıldı"
                            : money(Math.max(0, remainingBudget), true) +
                              " bütçe kaldı"}
                        </span>
                        <span className="mini-progress">
                          <i
                            style={{
                              width:
                                Math.min(
                                  100,
                                  totalBudget ? (spend / totalBudget) * 100 : 0,
                                ) + "%",
                            }}
                          />
                        </span>
                      </div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-top">
                        <span>Toplam varlığım</span>
                        <Landmark size={17} />
                      </div>
                      <h2>{money(overview.assets, true)}</h2>
                      <div className="stat-bottom">
                        <span>Elimdeki para − bu ay harcanan</span>
                      </div>
                    </article>
                    <article className="stat-card recent-stat">
                      <div className="stat-top">
                        <span
                          className="recent-source"
                          title={latestTransaction?.merchant}
                        >
                          {latestTransaction?.merchant || "Son işlem"}
                        </span>
                        {latestTransaction?.direction === "income" ? (
                          <ArrowDownLeft size={17} />
                        ) : (
                          <ArrowUpRight size={17} />
                        )}
                      </div>
                      <h2
                        className={
                          latestTransaction?.direction === "income"
                            ? "positive"
                            : undefined
                        }
                      >
                        {latestTransaction
                          ? signedAmount(latestTransaction)
                          : "—"}
                      </h2>
                      <div className="stat-bottom recent-meta">
                        <span>
                          {latestTransaction
                            ? `${latestTransaction.direction === "income" ? "Gelen" : "Giden"} · ${data.accounts.find((a) => a.id === latestTransaction.account_id)?.name || "Hesap seçilmedi"}`
                            : "Henüz işlem yok"}
                        </span>
                      </div>
                      {previousTransaction && (
                        <div
                          className="recent-previous"
                          aria-label="Bir önceki işlem"
                        >
                          <span title={previousTransaction.merchant}>
                            Önceki · {previousTransaction.merchant}
                          </span>
                          <strong>{signedAmount(previousTransaction)}</strong>
                        </div>
                      )}
                    </article>
                  </section>
                  <details className="overview-accounts" id="hesaplar">
                    <summary>
                      <span>Hesaplarımı yönet</span>
                      <span>{data.accounts.length} hesap</span>
                    </summary>
                    <div className="overview-accounts-content">
                      <div className="section-heading">
                        <div>
                          <h2>Hesaplarım</h2>
                          <p>
                            Banka, nakit ve kredi kartı hesaplarını buradan
                            yönet.
                          </p>
                        </div>
                        <button
                          className="button secondary"
                          onClick={() => edit("accounts", "Yeni hesap")}
                        >
                          <Plus size={15} />
                          Hesap ekle
                        </button>
                      </div>
                      <div className="accounts-grid">
                        {data.accounts.map((a) => (
                          <article
                            className="account-card"
                            key={a.id}
                            style={
                              {
                                "--account-color": a.color,
                              } as React.CSSProperties
                            }
                          >
                            <div className="account-top">
                              <span
                                className={
                                  "account-bank-icon" +
                                  (["İş Bankası", "Yapı Kredi"].includes(a.bank)
                                    ? " bank-brand-icon " +
                                      (a.bank === "İş Bankası"
                                        ? "bank-mark-isbank"
                                        : "bank-mark-yapi-kredi")
                                    : "")
                                }
                              >
                                {a.bank === "İş Bankası" ? (
                                  <Image
                                    src="/brand/banks/is-bankasi-pusula.svg"
                                    alt="İş Bankası amblemi"
                                    width={18}
                                    height={32}
                                    unoptimized
                                  />
                                ) : a.bank === "Yapı Kredi" ? (
                                  <Image
                                    src="/brand/banks/yapi-kredi-pusula.svg"
                                    alt="Yapı Kredi Koç amblemi"
                                    width={30}
                                    height={20}
                                    unoptimized
                                  />
                                ) : (
                                  <Landmark size={21} />
                                )}
                              </span>
                              <span>{a.bank}</span>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`${a.name} düzenle`}
                                  onClick={() =>
                                    edit("accounts", "Hesabı düzenle", a)
                                  }
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  className="icon-button danger-hover"
                                  aria-label={`${a.name} sil`}
                                  onClick={() =>
                                    remove("accounts", a.id, a.name)
                                  }
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <h3>{a.name}</h3>
                            <h2>{money(accountBalance(data, a.id))}</h2>
                            <div className="account-bottom">
                              <span>
                                Açılış: {money(Number(a.opening_balance), true)}
                              </span>
                              <span>
                                {dateLabel(a.balance_date)}{" "}
                                {a.balance_date.slice(0, 4)}
                              </span>
                            </div>
                          </article>
                        ))}
                        {!data.accounts.length && (
                          <Empty
                            title="İlk hesabını ekle."
                            body="Bir banka hesabı veya nakit cüzdanı ile başla."
                          />
                        )}
                      </div>
                    </div>
                  </details>
                  <div className="overview-charts">
                    <section className="panel flow-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Gelir ve gider dengesi</h2>
                          <p>Rakamların anlattığı hikâye</p>
                        </div>
                        <select
                          className="small-select"
                          aria-label="Grafik dönemi"
                          value={history}
                          onChange={(e) => setHistory(Number(e.target.value))}
                        >
                          <option value={6}>Son 6 ay</option>
                          <option value={12}>Son 12 ay</option>
                        </select>
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i style={{ background: "#b4d797" }} />
                          Gelir
                        </span>
                        <span>
                          <i style={{ background: "#4b6150" }} />
                          Gider
                        </span>
                      </div>
                      <FlowChart data={flow} />
                      <div className="flow-summary">
                        <div>
                          <small>Bu ay net fark</small>
                          <strong
                            className={
                              income - spend >= 0 ? "positive" : "negative"
                            }
                          >
                            {income - spend >= 0 ? "+" : ""}
                            {money(income - spend, true)}
                          </strong>
                        </div>
                        <span className="flow-summary-icon">
                          <TrendingUp size={23} />
                        </span>
                        <p>
                          Gelen her tutar,
                          <br />
                          yarının için bir imkân.
                        </p>
                      </div>
                    </section>
                    <section className="panel donut-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Harcamaların dağılımı</h2>
                          <p>Seçili ayın gerçek harcamaları</p>
                        </div>
                        <select
                          className="small-select"
                          aria-label="Harcama dağılımı türü"
                          value={distribution}
                          onChange={(e) =>
                            setDistribution(
                              e.target.value as "bucket" | "merchant",
                            )
                          }
                        >
                          <option value="merchant">İşyerine göre</option>
                          <option value="bucket">Kovaya göre</option>
                        </select>
                      </div>
                      <SpendingDonut
                        data={expenseDistribution(data, month, distribution)}
                      />
                    </section>
                  </div>
                  <div className="overview-grid">
                    <section className="panel bucket-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Her kuruşun bir yeri var</h2>
                          <p>Aylık kovaların ve kullanım durumları</p>
                        </div>
                        {goLink("/ayarlar", "Kovaları düzenle")}
                      </div>
                      <div className="bucket-list">
                        {budgetRows.map((b) => (
                          <div className="bucket-row" key={b.id}>
                            <div className="bucket-row-top">
                              <span className="bucket-name">
                                <i style={{ background: b.color }} />
                                {b.name}
                                <small>%{b.ratio}</small>
                                {b.kind === "fixed" && (
                                  <span className="auto-tag">Otomatik</span>
                                )}
                              </span>
                              <span>
                                <strong>{money(b.spent, true)}</strong>
                                <small> / {money(b.budget, true)}</small>
                              </span>
                            </div>
                            <div
                              className={
                                "progress " +
                                (b.percent > 100 ? "over-budget" : "")
                              }
                            >
                              <span
                                style={{
                                  width: Math.min(100, b.percent) + "%",
                                  background:
                                    b.percent > 100 ? "#ed9e8f" : b.color,
                                }}
                              />
                            </div>
                            <div className="bucket-row-bottom">
                              <span
                                className={b.remaining < 0 ? "negative" : ""}
                              >
                                {b.remaining < 0
                                  ? money(-b.remaining, true) + " aşıldı"
                                  : money(b.remaining, true) + " kaldı"}
                              </span>
                              <span>{Math.round(b.percent)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="subtle-note">
                        <span className="status-dot" />
                        Sabit faturalar bütçesi, bu ayın sabit giderlerinden
                        hesaplanır.
                      </div>
                    </section>
                    <WeeklyPanel data={data} />
                  </div>
                  <CardsPanel
                    data={data}
                    edit={edit}
                    mutate={mutate}
                    working={working}
                  />
                  <div className="overview-grid lower-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Önümüzdeki 6 ay</h2>
                          <p>Beklenen gelir ve bütçelere göre ay sonu bakiye</p>
                        </div>
                        <span className="tag">
                          <Activity size={12} />
                          Projeksiyon
                        </span>
                      </div>
                      {forecast.length ? (
                        <ProjectionChart data={forecast} />
                      ) : (
                        <Empty
                          title="Bu dönem hesaplanamıyor."
                          body="Seçilen ay, hesaplarının açılış bakiyesi tarihinden önce."
                        />
                      )}
                      <p className="chart-footnote">
                        Bu ay: kova başına bütçe ile gerçekleşenin büyüğü.
                        Gelecek aylar: beklenen gelir ve bütçe. Birikim payı
                        gider olarak düşülmez.
                      </p>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>En çok nerede harcadın?</h2>
                          <p>Bu ayın öne çıkan işyerleri</p>
                        </div>
                        <ShoppingBag size={18} className="muted" />
                      </div>
                      <div className="merchant-ranking">
                        {topMerchants.length ? (
                          topMerchants.map(([name, amount], i) => (
                            <div key={name}>
                              <span className="ranking-number">0{i + 1}</span>
                              <MerchantIcon name={name} />
                              <strong>{name}</strong>
                              <span>{money(amount, true)}</span>
                            </div>
                          ))
                        ) : (
                          <Empty
                            title="Henüz harcama yok."
                            body="İlk kaydından sonra dağılımını burada göreceksin."
                          />
                        )}
                      </div>
                    </section>
                  </div>
                  <div className="overview-grid lower-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Gelirinin dağılımı</h2>
                          <p>
                            {money(income, true)} aylık gelirin için kova
                            payları
                          </p>
                        </div>
                      </div>
                      <div className="allocation-chart">
                        {data.buckets.map((b) => (
                          <div key={b.id}>
                            <span>
                              <i style={{ background: b.color }} />
                              {b.name}
                            </span>
                            <div className="progress">
                              <span
                                style={{
                                  width: b.ratio + "%",
                                  background: b.color,
                                }}
                              />
                            </div>
                            <b>%{b.ratio}</b>
                            <strong>
                              {money((income * b.ratio) / 100, true)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Kovaların aylık ritmi</h2>
                          <p>Her ay bütçenin yüzde kaçı kullanıldı?</p>
                        </div>
                      </div>
                      <BucketHistoryChart data={flow} buckets={data.buckets} />
                    </section>
                  </div>
                </>
              )}
              {section === "hedefler" && (
                <SavingsPage
                  data={data}
                  edit={edit}
                  remove={remove}
                  working={working}
                />
              )}
              {section === "islemler" && (
                <>
                  <ClassificationPanel
                    data={data}
                    mutate={mutate}
                    working={working}
                  />
                  <div className="mini-stats">
                    <span>
                      Bu ay <strong>{filtered.length} işlem</strong>
                    </span>
                    <span>
                      Gelir{" "}
                      <strong className="positive">
                        {money(sum(filtered, "income"), true)}
                      </strong>
                    </span>
                    <span>
                      Gider{" "}
                      <strong>{money(sum(filtered, "expense"), true)}</strong>
                    </span>
                    <button className="button secondary" onClick={downloadCsv}>
                      <Download size={15} />
                      CSV indir
                    </button>
                  </div>
                  <section className="panel transaction-panel">
                    <div className="table-toolbar">
                      <div className="segmented">
                        {[
                          ["all", "Tüm işlemler"],
                          ["expense", "Harcamalar"],
                          ["income", "Gelirler"],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            className={direction === key ? "selected" : ""}
                            onClick={() => setDirection(key)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="table-filters">
                        <select
                          aria-label="Hesaba göre filtrele"
                          value={accountFilter}
                          onChange={(e) => setAccountFilter(e.target.value)}
                        >
                          <option value="all">Tüm hesaplar</option>
                          {data.accounts.map((a) => (
                            <option value={a.id} key={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                        <div className="inline-search">
                          <Search size={15} />
                          <input
                            aria-label="İşlem filtrele"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="İşyeri veya not ara"
                          />
                        </div>
                      </div>
                    </div>
                    {renderTransactionTable()}
                  </section>
                  <div className="subtle-note">
                    <ShieldCheck size={14} />
                    Gelir işlemlerini düzenleyerek kaynağa bağlayabilirsin.
                    Kaynak adıyla eşleşenler düzenleme sırasında önerilir.
                  </div>
                </>
              )}
              {section === "gelirler" && (
                <>
                  <section className="stats-grid three-stats">
                    <article className="stat-card">
                      <div className="stat-top">
                        <span>Bu ay gelen</span>
                        <ArrowDownLeft size={18} />
                      </div>
                      <h2>{money(income, true)}</h2>
                      <span className="positive">
                        {tx.filter((t) => t.direction === "income").length}{" "}
                        gelir işlemi
                      </span>
                    </article>
                    <article className="stat-card">
                      <div className="stat-top">
                        <span>Beklenen ödemeler</span>
                        <Wallet size={18} />
                      </div>
                      <h2>
                        {money(
                          payments.reduce((s, p) => s + p.remaining, 0),
                          true,
                        )}
                      </h2>
                      <span className="muted">
                        {payments.length} ödeme bekleniyor
                      </span>
                    </article>
                    <article className="stat-card">
                      <div className="stat-top">
                        <span>Aktif kaynaklar</span>
                        <Landmark size={18} />
                      </div>
                      <h2>
                        {data.income_sources.filter((s) => s.active).length}
                      </h2>
                      <button
                        className="text-link"
                        onClick={() =>
                          edit("income_sources", "Yeni gelir kaynağı")
                        }
                      >
                        <Plus size={14} />
                        Kaynak ekle
                      </button>
                    </article>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Gelir kaynakların</h2>
                        <p>Geçmiş gelirin, kaynak silindiğinde de korunur.</p>
                      </div>
                      <button
                        className="button secondary"
                        onClick={() =>
                          edit("income_sources", "Yeni gelir kaynağı")
                        }
                      >
                        <Plus size={15} />
                        Kaynak ekle
                      </button>
                    </div>
                    {data.income_sources.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>KAYNAK</th>
                              <th>BEKLENEN</th>
                              <th>BU AY GELEN</th>
                              <th>SON {history} AY</th>
                              <th>DURUM</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {data.income_sources.map((s) => (
                              <tr key={s.id}>
                                <td>
                                  <div className="merchant-cell">
                                    <span className="merchant-icon mint">
                                      <Landmark size={18} />
                                    </span>
                                    <div>
                                      <strong>{s.name}</strong>
                                      <small>
                                        {humanType[s.type]} ·{" "}
                                        {s.period === "monthly"
                                          ? `Her ayın ${s.expected_day || 1}. günü`
                                          : s.period === "weekly"
                                            ? `Her hafta ${weekdays[(s.expected_day || 1) - 1]}`
                                            : s.expected_date
                                              ? dateLabel(s.expected_date)
                                              : "Tek seferlik"}
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {s.expected_amount
                                    ? money(Number(s.expected_amount), true)
                                    : "Belirtilmedi"}
                                </td>
                                <td className="positive amount">
                                  {money(
                                    sum(
                                      tx.filter(
                                        (t) => t.income_source_id === s.id,
                                      ),
                                      "income",
                                    ),
                                    true,
                                  )}
                                </td>
                                <td className="amount">
                                  {money(
                                    sum(
                                      data.transactions.filter(
                                        (t) =>
                                          t.income_source_id === s.id &&
                                          t.occurred_on >=
                                            shiftMonth(month, 1 - history) +
                                              "-01" &&
                                          t.occurred_on <= month + "-31",
                                      ),
                                      "income",
                                    ),
                                    true,
                                  )}
                                </td>
                                <td>
                                  <span
                                    className={
                                      "tag " + (s.active ? "income-tag" : "")
                                    }
                                  >
                                    {s.active ? "Aktif" : "Pasif"}
                                  </span>
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      className="icon-button"
                                      aria-label={`${s.name} düzenle`}
                                      onClick={() =>
                                        edit(
                                          "income_sources",
                                          "Kaynağı düzenle",
                                          s,
                                        )
                                      }
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    <button
                                      className="icon-button danger-hover"
                                      aria-label={`${s.name} sil`}
                                      onClick={() =>
                                        remove("income_sources", s.id, s.name)
                                      }
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="İlk gelir kaynağını ekle."
                        body="Bir maaş, serbest iş veya yeni bir gelir kapısı."
                      />
                    )}
                  </section>
                  <div className="overview-grid lower-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Henüz gelmeyen ödemeler</h2>
                          <p>
                            Kalan tutarı “Geldi” ile gelir kaydına dönüştür.
                          </p>
                        </div>
                      </div>
                      {payments.length ? (
                        <div className="payments-list">
                          {payments.map((p) => (
                            <div key={p.id + p.due}>
                              <span
                                className={
                                  "payment-date " +
                                  (p.overdue ? "is-overdue" : "")
                                }
                              >
                                {new Date(p.due + "T12:00:00").getDate()}
                                <small>
                                  {monthLabel(p.due.slice(0, 7), true)}
                                </small>
                              </span>
                              <div>
                                <h4>{p.name}</h4>
                                <small
                                  className={p.overdue ? "negative" : "muted"}
                                >
                                  {p.overdue
                                    ? "Tarihi geçti"
                                    : p.period === "weekly"
                                      ? "Haftalık ödeme"
                                      : p.period === "monthly"
                                        ? "Düzenli ödeme"
                                        : "Tek seferlik"}
                                </small>
                              </div>
                              <strong>{money(p.remaining, true)}</strong>
                              <button
                                className="button secondary"
                                disabled={working || !data.accounts.length}
                                onClick={() =>
                                  setConfirm({
                                    title: "Ödeme geldi mi?",
                                    body: `${p.name} için ${money(p.remaining)} gelir, ${data.accounts[0]?.name || "ilk hesabına"} kaydedilecek. Gerekirse sonrasında hesabı düzenleyebilirsin.`,
                                    action: {
                                      action: "receive",
                                      id: p.id,
                                      month,
                                      due_on: p.due,
                                      account_id: data.accounts[0]?.id,
                                    },
                                  })
                                }
                              >
                                <Check size={14} />
                                Geldi
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          title="Beklenen ödeme yok."
                          body="Bu dönemin ödemeleri tamamlandı veya henüz kaynak eklenmedi."
                        />
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Gelirinin kaynakları</h2>
                          <p>Bu ay gelen tutarın dağılımı</p>
                        </div>
                      </div>
                      <div className="source-distribution">
                        {[
                          ...data.income_sources.map((s) => ({
                            id: s.id,
                            name: s.name,
                          })),
                          { id: "", name: "Kaynaksız" },
                        ].map((s, i) => {
                          const value = sum(
                            tx.filter(
                              (t) => (t.income_source_id || "") === s.id,
                            ),
                            "income",
                          );
                          if (!value) return null;
                          return (
                            <div key={s.id}>
                              <div>
                                <span>
                                  <i
                                    style={{
                                      background: [
                                        "#b4d797",
                                        "#b7a0da",
                                        "#8db9d5",
                                      ][i % 3],
                                    }}
                                  />
                                  {s.name}
                                </span>
                                <b>{money(value, true)}</b>
                              </div>
                              <div className="progress">
                                <span
                                  style={{
                                    width:
                                      (income ? (value / income) * 100 : 0) +
                                      "%",
                                    background: [
                                      "#b4d797",
                                      "#b7a0da",
                                      "#8db9d5",
                                    ][i % 3],
                                  }}
                                />
                              </div>
                              <small>
                                {income
                                  ? Math.round((value / income) * 100)
                                  : 0}
                                %
                              </small>
                            </div>
                          );
                        })}
                        {!income && (
                          <Empty
                            title="Dağılım henüz oluşmadı."
                            body="Gelir eklendiğinde kaynak payları burada görünür."
                          />
                        )}
                      </div>
                    </section>
                  </div>
                  <section className="panel lower-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Gelir kaynaklarının zaman içindeki toplamı</h2>
                        <p>Her kaynak için ay ay gerçekleşen gelir</p>
                      </div>
                      <select
                        className="small-select"
                        value={history}
                        onChange={(e) => setHistory(Number(e.target.value))}
                      >
                        <option value={6}>Son 6 ay</option>
                        <option value={12}>Son 12 ay</option>
                      </select>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>KAYNAK</th>
                            {flow.map((m) => (
                              <th key={m.month}>{m.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ...data.income_sources.map((s) => ({
                              id: s.id,
                              name: s.name,
                            })),
                            { id: "", name: "Kaynaksız" },
                          ].map((s) => (
                            <tr key={s.id}>
                              <td>
                                <strong>{s.name}</strong>
                              </td>
                              {flow.map((m) => (
                                <td key={m.month} className="amount">
                                  {money(
                                    sum(
                                      monthly(data, m.month).filter(
                                        (t) =>
                                          (t.income_source_id || "") === s.id,
                                      ),
                                      "income",
                                    ),
                                    true,
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
              {section === "sabitler" && (
                <>
                  <SubscriptionsPanel
                    month={month}
                    data={data}
                    edit={edit}
                    mutate={mutate}
                    working={working}
                  />
                  <div className="page-summary-strip">
                    <div>
                      <span>Bu ay beklenen</span>
                      <strong>
                        {money(
                          data.recurring_items.reduce(
                            (s, r) =>
                              s +
                              recurringDates(r, month).length *
                                Number(r.amount),
                            0,
                          ),
                          true,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Ödenen kalem</span>
                      <strong>
                        {
                          recurringOccurrences(data, month).filter(
                            (p) => p.matched,
                          ).length
                        }{" "}
                        / {recurringOccurrences(data, month).length}
                      </strong>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() =>
                        edit("recurring_items", "Yeni sabit gider", {
                          bucket_id:
                            data.buckets.find((b) => b.kind === "fixed")?.id ||
                            "",
                        })
                      }
                    >
                      <Plus size={15} />
                      Sabit gider ekle
                    </button>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Aylık düzenin</h2>
                        <p>
                          Ödenen giderleri bir işlemle eşleştirerek bu ayı
                          kapat.
                        </p>
                      </div>
                      <span className="tag">{monthLabel(month)}</span>
                    </div>
                    {data.recurring_items.length ? (
                      <div className="recurring-list">
                        {data.recurring_items.map((r) => {
                          const dates = recurringDates(r, month);
                          return (
                            dates.length ? dates : [dueDate(month, r.day)]
                          ).map((due) => {
                            const active = dates.length > 0,
                              matched = active
                                ? recurringPayment(data, r, due)
                                : undefined,
                              late = active && !matched && due < todayTR(),
                              suggestion = pending.find(
                                (t) =>
                                  t.occurred_on.startsWith(month) &&
                                  recurringSuggestions(data, t, due).some(
                                    (v) => v.id === r.id,
                                  ),
                              );
                            return (
                              <article
                                key={r.id + due}
                                className={!active ? "inactive" : ""}
                              >
                                <span
                                  className={
                                    "recurring-date " + (matched ? "paid" : "")
                                  }
                                >
                                  {matched ? (
                                    <CheckCheck size={20} />
                                  ) : r.period === "weekly" ? (
                                    Number(due.slice(8))
                                  ) : (
                                    r.day
                                  )}
                                  <small>
                                    {matched
                                      ? "Ödendi"
                                      : r.period === "weekly"
                                        ? "Haftalık"
                                        : "Her ay"}
                                  </small>
                                </span>
                                <div className="recurring-name">
                                  <h3>{r.name}</h3>
                                  <span>
                                    {data.buckets.find(
                                      (b) => b.id === r.bucket_id,
                                    )?.name || "Kovasız"}
                                    {r.period === "weekly"
                                      ? ` · Her hafta ${weekdays[r.day - 1]} · ${dateLabel(due)}`
                                      : ""}
                                    {r.end_date
                                      ? " · " +
                                        dateLabel(r.end_date) +
                                        " tarihine kadar"
                                      : ""}
                                  </span>
                                </div>
                                <strong className="amount">
                                  {money(Number(r.amount), true)}
                                </strong>
                                <span
                                  className={
                                    "tag " +
                                    (matched
                                      ? "income-tag"
                                      : late
                                        ? "late-tag"
                                        : "")
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
                                <div className="recurring-action">
                                  {active &&
                                    !matched &&
                                    (suggestion ? (
                                      <button
                                        className="button secondary"
                                        disabled={working}
                                        onClick={() =>
                                          mutate({
                                            action: "match",
                                            id: suggestion.id,
                                            recurring_id: r.id,
                                            due_on: due,
                                          })
                                        }
                                      >
                                        <Zap size={13} />
                                        Eşleştir
                                      </button>
                                    ) : (
                                      <button
                                        className="button secondary"
                                        onClick={() =>
                                          edit(
                                            "transactions",
                                            "Sabit gider ödemesi",
                                            {
                                              merchant: r.name,
                                              amount: r.amount,
                                              bucket_id: r.bucket_id,
                                              account_id:
                                                r.account_id ||
                                                data.accounts[0]?.id,
                                              recurring_item_id: r.id,
                                              recurring_period_start:
                                                recurringPeriodStart(r, due),
                                              occurred_on:
                                                due <= todayTR()
                                                  ? due
                                                  : todayTR(),
                                              note: `${r.name} ödemesi`,
                                            },
                                          )
                                        }
                                      >
                                        <Plus size={13} />
                                        Ödeme gir
                                      </button>
                                    ))}
                                </div>
                                <div className="row-actions">
                                  <button
                                    className="icon-button"
                                    aria-label={`${r.name} düzenle`}
                                    onClick={() =>
                                      edit(
                                        "recurring_items",
                                        "Sabit gideri düzenle",
                                        r,
                                      )
                                    }
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    className="icon-button danger-hover"
                                    aria-label={`${r.name} sil`}
                                    onClick={() =>
                                      remove("recurring_items", r.id, r.name)
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </article>
                            );
                          });
                        })}
                      </div>
                    ) : (
                      <Empty
                        title="Düzenli giderlerini ekle."
                        body="Kira, faturalar, abonelikler ve bitiş tarihi olan taksitler."
                      />
                    )}
                  </section>
                </>
              )}
              {section === "ayarlar" && (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Kovaların, senin kuralların</h2>
                        <p>
                          Varsayılan dağılım %50 ihtiyaç, %30 esneklik ve keyif,
                          %20 birikim.
                        </p>
                      </div>
                      <button
                        className="button secondary"
                        onClick={() => edit("buckets", "Yeni kova")}
                      >
                        <Plus size={15} />
                        Kova ekle
                      </button>
                    </div>
                    <div className="bucket-settings">
                      {data.buckets.map((b) => (
                        <div key={b.id}>
                          <span
                            className="bucket-swatch"
                            style={{ background: b.color }}
                          />
                          <div>
                            <strong>{b.name}</strong>
                            <small>
                              {b.kind === "fixed"
                                ? "Bütçe sabit giderlerden otomatik hesaplanır"
                                : b.kind === "savings"
                                  ? "Hedeflere ayrılır, harcama bütçesi sayılmaz"
                                  : "Gelir bazında aylık bütçe"}
                            </small>
                          </div>
                          <span className="ratio-display">%{b.ratio}</span>
                          <button
                            className="icon-button"
                            aria-label={`${b.name} düzenle`}
                            onClick={() => edit("buckets", "Kovayı düzenle", b)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger-hover"
                            aria-label={`${b.name} sil`}
                            onClick={() => remove("buckets", b.id, b.name)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div
                      className={
                        "ratio-total " +
                        (Math.abs(ratioTotal - 100) < 0.01
                          ? "positive"
                          : "negative")
                      }
                    >
                      <span>Toplam dağılım</span>
                      <strong>%{ratioTotal}</strong>
                      {Math.abs(ratioTotal - 100) < 0.01 ? (
                        <Check size={17} />
                      ) : (
                        <TriangleAlert size={17} />
                      )}
                    </div>
                  </section>
                  <AutomationSettings
                    data={data}
                    mutate={mutate}
                    working={working}
                  />
                  <section className="panel" id="kurulum">
                    <div className="panel-heading">
                      <div>
                        <h2>Yerel çalışma alanın</h2>
                        <p>Şifresiz, boş ve bağlantısız başlangıç sürümü.</p>
                      </div>
                    </div>
                    <div className="feature-content">
                      <p>
                        Kayıtların yalnızca bu tarayıcının yerel depolama
                        alanında saklanır. Başka bir tarayıcıda veya cihazda
                        otomatik görünmez.
                      </p>
                      <p>
                        Başlamak için Genel bakış → Hesaplarımı yönet bölümünden
                        kendi hesabını ekle. Ardından işlemlerini, gelirlerini,
                        giderlerini ve birikimlerini girebilirsin.
                      </p>
                      <p>
                        Gmail, Telegram veya Supabase bağlantısı kurulmaz.
                        Birikimler sayfası yalnızca herkese açık piyasa
                        fiyatlarını alır; finans kayıtlarını sunucuya göndermez.
                      </p>
                      <p>
                        Tarayıcı verilerini temizlemek yerel kayıtlarını siler.
                        İşlem geçmişini CSV olarak dışa aktarabilirsin.
                      </p>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Hatırlanan işyerleri</h2>
                        <p>Yalnızca sen istediğinde otomatik kova atanır.</p>
                      </div>
                    </div>
                    {data.merchant_rules.length ? (
                      <div className="rules-list">
                        {data.merchant_rules.map((r) => (
                          <div key={r.id}>
                            <span>{r.merchant}</span>
                            <ArrowRight size={14} />
                            <strong>
                              {
                                data.buckets.find((b) => b.id === r.bucket_id)
                                  ?.name
                              }
                            </strong>
                            <button
                              className="icon-button danger-hover"
                              aria-label={`${r.merchant} kuralını sil`}
                              onClick={() =>
                                remove("merchant_rules", r.id, r.merchant)
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Kararı sana bırakıyoruz."
                        body="Bekleyen bir işlemde “Bu işyeri için hatırla” seçeneğiyle kendi kurallarını oluşturabilirsin."
                      />
                    )}
                  </section>
                  <section className="panel lower-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Ham bildirimler</h2>
                        <p>
                          Okunamayan metinler hata notuyla korunur. Hiçbir tutar
                          tahmin edilmez.
                        </p>
                      </div>
                      <span className="tag">
                        {data.raw_notifications.length} bildirim
                      </span>
                    </div>
                    {data.raw_notifications.length ? (
                      <div className="notification-list">
                        {data.raw_notifications.map((n) => (
                          <article key={n.id}>
                            <div>
                              <span
                                className={
                                  "tag " +
                                  (n.status === "error"
                                    ? "late-tag"
                                    : n.status === "processed"
                                      ? "income-tag"
                                      : "")
                                }
                              >
                                {
                                  (
                                    {
                                      pending: "Bekliyor",
                                      processed: "İşlendi",
                                      ignored: "Atlandı",
                                      error: "Kontrol gerekli",
                                    } as Record<string, string>
                                  )[n.status]
                                }
                              </span>
                              <small>
                                {new Date(n.created_at).toLocaleString(
                                  "tr-TR",
                                  { timeZone: "Europe/Istanbul" },
                                )}
                              </small>
                              {n.status === "error" && (
                                <button
                                  className="text-link"
                                  disabled={working}
                                  onClick={() =>
                                    mutate({ action: "retry", id: n.id })
                                  }
                                >
                                  <RefreshCw size={12} />
                                  Yeniden dene
                                </button>
                              )}
                            </div>
                            {n.error && <p>{n.error}</p>}
                            <details>
                              <summary>Ham metni göster</summary>
                              <pre>{n.raw_text}</pre>
                            </details>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="İlk bildirimin için hazır."
                        body="Gmail betiği bir bildirim gönderdiğinde burada görünür."
                      />
                    )}
                  </section>
                </>
              )}
              <footer className="page-footer">
                <span>
                  <Navigation size={13} /> pusula <i>·</i> Biraz daha net, biraz
                  daha özgür.
                </span>
                <button
                  className="text-link muted"
                  disabled={refreshing}
                  onClick={() => load(true)}
                >
                  <RefreshCw size={12} className={refreshing ? "spin" : ""} />
                  {refreshing ? "Güncelleniyor…" : "Verileri yenile"}
                </button>
                <span className="footer-private">
                  <ShieldCheck size={12} />
                  Sana özel finans alanı
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal && (
        <EntityModal
          key={modal.table + String(modal.record?.id || "new")}
          modal={modal}
          data={data}
          onClose={() => setModal(null)}
          onSave={mutate}
        />
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <span className="confirm-icon">
              <TriangleAlert size={24} />
            </span>
            <h2 id="confirm-title">{confirm.title}</h2>
            <p>{confirm.body}</p>
            <footer>
              <button
                className="button secondary"
                disabled={working}
                onClick={() => setConfirm(null)}
              >
                Vazgeç
              </button>
              <button
                className="button primary"
                disabled={working}
                onClick={async () => {
                  if (await mutate(confirm.action)) setConfirm(null);
                }}
              >
                {working ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Check size={15} />
                )}
                Onayla
              </button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div
          className={"toast " + (toast.error ? "error-toast" : "")}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <TriangleAlert size={18} /> : <CheckCheck size={18} />}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="Bildirimi kapat"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function FlaskIcon() {
  return (
    <span className="demo-icon">
      <Sparkles size={14} />
    </span>
  );
}
