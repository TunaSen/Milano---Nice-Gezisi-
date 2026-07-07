# Milano - Nice Gezisi

Bu repo, Milano ve Nice gezi planinizi tek bir web sayfasinda toplamak icin hazirlanmis veri odakli bir yapidir.

## Ozellikler

- Tarih bazli rota akisi (itinerary)
- Ucak/ulasim bilgileri
- Konaklama kayitlari
- Gezilecek yerler listesi + harita linkleri
- Gezilmis yerlere ait fotograflar (GitHub klasorunden otomatik okunur)
- Duzenli klasor yapisi: sonradan kolay guncelleme

## Klasor Yapisi

- `index.html` -> Ana sayfa
- `assets/css/styles.css` -> Tasarim
- `assets/js/app.js` -> Dinamik veri yukleme ve render
- `trip-data/` -> Tum json verileri
  - `site-config.json` -> GitHub API ayarlari
  - `itinerary.json` -> Gun gun plan
  - `flights/*.json` -> Ucus/ulasim girdileri
  - `stays/*.json` -> Konaklama girdileri
  - `places/**/place.json` -> Sehir/yer detaylari
- `media/places/<city>/<place-slug>/` -> Yer fotograflari
- `documents/flights/...` -> Bilet/PDF gibi belgeler

## Yeni Veri Ekleme

### 1) Yeni gezilecek yer

1. `trip-data/places/<city>/<place-slug>/place.json` dosyasi olustur.
2. Fotograf eklemek icin `media/places/<city>/<place-slug>/` klasorune dosya yukle.
3. Commit + push yap. Site otomatik yeni veriyi okuyacak.

Alternatif hizli yol (PowerShell):

`./tools/new-place.ps1 -City "Milan" -PlaceSlug "brera" -PlaceName "Brera District" -PlannedDate "2026-08-08" -Description "Sanat galerileri ve sokaklar." -MapsUrl "https://maps.google.com/?q=Brera+Milan" -Tags gezi,sanat`

Bu komut su dosyalari otomatik acar:

- `trip-data/places/milan/brera/place.json`
- `media/places/milan/brera/`

### 2) Yeni ucus veya ulasim

1. `trip-data/templates/flight.template.json` dosyasini kopyalayip `trip-data/flights/` altina yeni bir `.json` olarak ekle.
2. Bilet/PDF dosyalarini `documents/flights/<kayit-slug>/` altina koy.
3. Commit + push yap.

### 3) Yeni konaklama

1. `trip-data/templates/stay.template.json` dosyasini kopyalayip `trip-data/stays/` altina yeni bir `.json` olarak ekle.
2. Commit + push yap.

### 4) Hazir template dosyalari

- `trip-data/templates/place.template.json`
- `trip-data/templates/flight.template.json`
- `trip-data/templates/stay.template.json`

## GitHub Pages Yayinlama

1. `trip-data/site-config.json` icinde `owner` alanina GitHub kullanici adini gir.
2. Repo ayarlarinda **Pages** bolumune gir.
3. Source olarak `Deploy from a branch` sec.
4. Branch: `main`, folder: `/ (root)` sec.
5. Kaydet. Site su adreste yayinlanir:
   - `https://<kullanici-adi>.github.io/Milano---Nice-Gezisi-/`

## Notlar

- Site, JSON dosyalarini ve fotograflari GitHub API ile okur.
- Public repo oldugu surece eklediginiz yeni json/fotograflar otomatik gorunur.