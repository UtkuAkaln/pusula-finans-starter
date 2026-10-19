# Pusula — Boş başlangıç sürümü

Türkçe kişisel finans paneli. Next.js, React, TypeScript ve Recharts ile hazırlanmıştır. Şifreli giriş ekranı, kişisel hesap, işlem, hedef, birikim veya bağlı bulut hesabı içermez.

## Uygulamadan görüntüler

Aşağıdaki ekran görüntüleri uygulamanın ayrı bir yerel önizlemesinde, **tamamen temsili hesap, işlem ve birikim kayıtlarıyla** hazırlanmıştır. Gerçek kişisel veri içermezler. Bu örnek kayıtlar başlangıç sürümüne eklenmez; uygulama ilk açılışta boş gelir. Görsellerdeki piyasa fiyatları çekim anına aittir.

### Genel bakış — paranın yönünü gör

![Pusula genel bakış: bakiye ve harcama kartları, gelir-gider sütun grafiği ve harcama dağılımı halkası](docs/images/genel-bakis.jpg)

Elindeki para, bu ayki harcama, kalan toplam ve son işlem tek ekranda görünür. Yan yana duran gelir–gider ve donut grafiklerle aylık hareketleri karşılaştırabilir; harcamaların dağılımını işyerine veya kovaya göre inceleyebilirsin. Hesaplarını aynı sayfadaki açılır bölümden yönetebilirsin.

### İşlemler — harcamalarını kolayca düzenle

![Pusula işlemler: gelir ve gider listesi, hesap filtresi, satır içi kova düğmeleri ve CSV dışa aktarma](docs/images/islemler.jpg)

Gelir ve harcamaları ara, hesaba göre filtrele ve her harcamanın kovasını doğrudan satırından seç. **Bu işyeri için hatırla** seçeneği sonraki sınıflandırmalara yardımcı olur; işlem listesini CSV olarak dışa aktarabilirsin.

### Sabit giderler — aboneliklerini ve ödeme günlerini takip et

![Pusula sabit giderler: aylık abonelik toplamı, ödeme günü kutuları, ödendi ve bekleniyor durumları](docs/images/sabit-giderler.jpg)

Aboneliklerin aylık toplamını, ödeme günlerini ve ödendi/bekleniyor durumlarını tema ile uyumlu kartlarda gör. Aynı sayfanın **Aylık düzenin** bölümünde aylık veya haftalık giderleri planlayabilir, yapılan ödemeleri işlemlerle eşleştirebilirsin. Tekrarlanan ödemelerden çıkarılan abonelik önerileri onayınla kayda dönüşür.

### Hedef ve Birikimler — birikimlerini hedeflerine bağla

![Pusula hedef ve birikimler: döviz ve maden fiyatları, temsili portföy, hedef tutarları ve ilerleme çubukları](docs/images/hedef-ve-birikimler.jpg)

TL, dolar, euro, sterlin, altın ve gümüş miktarlarını kaydet; piyasa alış fiyatlarıyla yaklaşık TL karşılıklarını takip et. Birikimlerini bir hedefe ayırdığında hedef tutarı, ayrılan miktar, kalan tutar ve ilerleme oranı birlikte gösterilir. Fiyat kaynağı ve son kotasyon zamanı da ekranda yer alır.

## Çalıştırma

Node.js 24 gerekir.

```sh
npm ci
npm run dev
```

[http://127.0.0.1:3000](http://127.0.0.1:3000) adresini açın. Şifre veya API anahtarı gerekmez. İlk açılışta yalnızca değiştirilebilir genel bütçe kovaları bulunur; finans kayıtları boştur.

## Kullanım

1. **Genel bakış → Hesaplarımı yönet** bölümünden kendi hesabınızı ekleyin.
2. **İşlemler** üzerinden gelir ve harcamaları girin; kovalarını seçin.
3. **Gelir kaynakları** ve **Sabit giderler** içinde aylık/haftalık kayıtlar oluşturun.
4. **Hedef ve Birikimler** içinde hedef tutarları ve döviz, altın, gümüş ya da TL miktarlarını ekleyin. Birikimleri hedeflere bağlayabilirsiniz.
5. **Ayarlar** içinde kova adlarını, oranlarını, renklerini ve yerel sınıflandırma tercihini değiştirin.

## Veriler nerede?

Kayıtlar tarayıcıdaki `localStorage` alanında tutulur. Sunucuya, GitHub'a veya bir bulut veritabanına gönderilmez. Her tarayıcının/alan adının verisi ayrıdır. Tarayıcı verilerini temizlemek kayıtları siler; işlem listesini CSV olarak dışa aktarabilirsiniz. Paylaşılan bilgisayarda aynı tarayıcı profilini kullanan kişiler bu kayıtlara erişebilir.

Bu sürümde Supabase, Gmail, Telegram, Gemini veya kişisel Vercel bağlantısı bulunmaz. Sunucuda finans verisi okuyan/yazan API ve giriş ekranı yoktur. `api/market` yalnızca herkese açık piyasa kotasyonlarını getirir.

## Piyasa fiyatları

[Trunçgil Finans](https://finans.truncgil.com/) üzerinden dolar, euro, sterlin, altın ve gümüş alış fiyatları alınır. Sayfa görünürken yaklaşık dakikada bir kontrol edilir; kaynağın kotasyon zamanı gösterilir. Kaynakta gecikme veya kesinti olursa bu durum belirtilir, mevcut sunucu sürecindeki son fiyatlar korunur. Değerler yaklaşık piyasa karşılığıdır; banka/kuyumcu fiyatları farklı olabilir. Kişisel kayıtlar fiyat sağlayıcısına iletilmez.

## Doğrulama ve üretim

```sh
npm test
npm run typecheck
npm run build
npm start
```

Herhangi bir Next.js barındırıcısında çalıştırılabilir. Giriş ekranı gerekmez; finans verileri her ziyaretçinin kendi tarayıcısında kalır. `.env*`, derleme çıktıları ve yerel veri/yedek dosyaları Git'e dahil edilmez. README için hazırlanmış temsili ekran görüntüleri `docs/images/` içinde sürümlenir; kişisel ekran görüntüleri depoya eklenmemelidir.

## Görseller

Banka amblemlerinin kaynakları `public/brand/banks/SOURCES.md` dosyasında belirtilmiştir. Pusula simgesi ve koyu yeşil tema projeyle birlikte gelir.
