# Pusula — Boş başlangıç sürümü

Türkçe kişisel finans paneli. Next.js, React, TypeScript ve Recharts ile hazırlanmıştır. Şifreli giriş ekranı, kişisel hesap, işlem, hedef, birikim veya bağlı bulut hesabı içermez.

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

Herhangi bir Next.js barındırıcısında çalıştırılabilir. Giriş ekranı gerekmez; finans verileri her ziyaretçinin kendi tarayıcısında kalır. `.env*`, derleme çıktıları, yerel veri/yedek dosyaları ve ekran görüntüleri Git'e dahil edilmez.

## Görseller

Banka amblemlerinin kaynakları `public/brand/banks/SOURCES.md` dosyasında belirtilmiştir. Pusula simgesi ve koyu yeşil tema projeyle birlikte gelir.
