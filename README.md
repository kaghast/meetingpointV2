# İnteraktif Toplantı, Canlı Oylama & Yoklama Platformu

Mobil uyumlu, gerçek zamanlı toplantı oylaması, anonim soru/geri bildirim, liderlik tablosu ve 90 saniyelik otomatik Geofencing (Lat-Long) + Cihaz Donanım İmzası destekli Yoklama platformu.

---

## 🚀 Coolify ile GitHub Public Repo Üzerinden Deploy Rehberi

Bu proje, **Coolify** (veya Docker / Nixpacks destekleyen herhangi bir PaaS) üzerinde sıfır ek yapılandırmayla tek tıkla çalışacak şekilde optimize edilmiştir.

### 1. GitHub Reposunu Coolify'a Bağlama
1. Coolify kontrol panelinizde **+ New Resource** -> **Application** seçin.
2. **Public Repository** seçeneğine tıklayın.
3. GitHub repo URL'nizi (örneğin: `https://github.com/kullaniciadi/proje-adi`) ve ana branch'inizi (`main`) girin.

### 2. Build Yapılandırması
Coolify projenizi otomatik olarak tanır:
- **Build Pack:** `Dockerfile` veya `Nixpacks` (Her ikisi de tam uyumludur; repoda `Dockerfile` ve `nixpacks.toml` hazır bulunmaktadır).
- **Ports Exposes:** `3000` (Coolify otomatik olarak 3000 portunu algılar).
- **Domain:** Kendi özel domaininizi veya Coolify'ın sağladığı alt alan adını (örneğin `https://toplanti.siteniz.com`) tanımlayın.

### 3. Kalıcı Veri Saklama (Persistent Storage - Önerilen)
Oturum verilerinin, anketlerin ve yoklama kayıtlarının container güncellemelerinde kaybolmaması için Coolify'da **Storages / Persistent Storage** sekmesinden bir hacim ekleyebilirsiniz:
- **Source / Volume Name:** `meeting-data`
- **Destination Path:** `/app/data`

*(Not: Kalıcı hacim eklenmese dahi sistem varsayılan şablon sorular ve oturumla çalışmaya hemen başlar.)*

### 4. Deploy Edin
- **Deploy** butonuna basın. Docker imajı derlenip canlıya alınacaktır.

---

## 🔑 Yönetici (Admin) Paneli Erişimi

- **Erişim Yolu:** URL'in sonuna `/admin` ekleyin (Örn: `https://alanadiniz.com/admin`).
- **Varsayılan Şifre:** `admin`
- Yönetici panelinden şifrenizi dilediğiniz zaman tek tıkla güncelleyebilirsiniz.

---

## 📋 Özellikler

1. **Canlı Oylama & Quiz (Sınav Modu):**
   - Çoktan seçmeli, doğru/yanlış, 1-5 derecelendirme, kısa ve uzun metin soru tipleri.
   - Puanlama ve anlık Liderlik Tablosu (Leaderboard).
   - Gizlilik kuralı: Katılımcılar sonuçları yalnızca yönetici oturumu sonlandırdığında görebilir.

2. **90 Saniyelik Otomatik Yoklama (Attendance):**
   - Tek tıkla herhangi bir oturumda başlatılabilir (diğer tüm sorular otomatik pasife alınır).
   - Katılımcının öğrenci numarası, ad-soyadı, GPS koordinatları (Lat-Long) ve cihaz donanım imzası güvenle toplanır.
   - 90 saniye tamamlandığında otomatik kapanır.
   - Yönetici panelinden toplanan yoklama verileri incelenebilir ve CSV olarak dışa aktarılabilir.

3. **Anonim Katılımcı Profili:**
   - Katılımcılara rastgele eğlenceli avatar ve anonim takma adlar atanır.
   - Katılımcı kendi anonim profilini dilediği an güncelleyebilir.

4. **Gerçek Zamanlı İletişim (SSE):**
   - Server-Sent Events ile soru değişiklikleri, yoklama durumu ve geri bildirimler canlı güncellenir.

---

## 💻 Yerel Geliştirme (Local Development)

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın (Port: 3000)
npm run dev

# Üretim (Production) derlemesi
npm run build

# Üretim sunucusunu başlatın
npm start
```

### Docker ile Yerel Çalıştırma

```bash
# İmajı oluşturun
docker build -t meeting-poll-app .

# Container'ı başlatın (Veriler yerel data klasörüne bağlanır)
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name meeting-poll meeting-poll-app
```
