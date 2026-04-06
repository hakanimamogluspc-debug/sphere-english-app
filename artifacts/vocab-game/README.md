# Vocab Quest — Sphere English AI Vocabulary Game

AI destekli kelime tahmin oyunu. İngilizce kelimeleri görsel betimlemeler ve akıllı ipuçlarıyla öğren.

## Mimari

```
artifacts/vocab-game/
├── main.py              # FastAPI uygulaması — sunucu girişi
├── database.py          # SQLite başlatma + bağlantı yönetimi
├── seed_words.py        # 410+ sık kullanılan kelime (İngilizce ↔ Türkçe + görsel ipucu)
├── routes/
│   ├── game.py          # Oyun API rotaları
│   └── scores.py        # Skor / lider tablosu rotaları
├── public/
│   └── index.html       # Vanilla JS + özel CSS SPA arayüzü
└── requirements.txt     # Python bağımlılıkları
```

## Kurulum

```bash
pip install -r requirements.txt
PORT=8090 python main.py
```

## Nasıl Çalışır?

### Veritabanı Başlatma
İlk çalıştırmada `init_db()` otomatik olarak:
1. SQLite şemasını oluşturur (words, game_sessions, session_words, retry_list, leaderboard)
2. `seed_words.py` dosyasından 410+ kelimeyi içe aktarır
3. Tablo zaten doluysa atlar

### Oyun Akışı
1. Kullanıcı adını ve seviyesini (A1–C2 veya Karma) seçer
2. Sistem rastgele bir kelime seti (10/15/20) seçer
3. Her kelime için görsel bir betimlem gösterilir
4. Kullanıcı İngilizce kelimeyi tahmin eder
5. Yanlış tahmin → hata sayacı artar (3 hak)
6. 3 hatta da yanlış → kelime tekrar listesine eklenir
7. İpucu butonu → OpenAI API kelimeyi açıklar (kelimeyi söylemeden)
8. Tur biter → skor, doğruluk oranı ve tekrar listesi görüntülenir

### Skor Sistemi
| Durum | Puan |
|-------|------|
| İpuçsuz doğru cevap | +10 |
| İpuçlu doğru cevap | +5 |
| Yanlış (3 hak sonrası geçilen kelime) | 0 |

### AI İpucu Sistemi
- `OPENAI_API_KEY` ortam değişkeni varsa → GPT-4o-mini modeli kullanılır
- API anahtarı yoksa → kategori bazlı yerleşik ipucu kullanılır
- İpucu asla doğrudan kelimeyi veya Türkçe karşılığını içermez

## API Uç Noktaları

| Method | Yol | Açıklama |
|--------|-----|----------|
| POST | `/api/game/start` | Yeni oyun oturumu başlat |
| GET  | `/api/game/word` | Sonraki kelimeyi getir |
| POST | `/api/game/guess` | Tahmini gönder |
| GET  | `/api/game/hint` | AI ipucu al |
| POST | `/api/game/finish` | Oyunu bitir ve skoru kaydet |
| GET  | `/api/game/retry-list` | Tekrar listesini getir |
| GET  | `/api/scores/leaderboard` | Lider tablosunu görüntüle |
| GET  | `/api/scores/stats` | Genel istatistikleri al |

## Veri Seti

- **410+ kelime** — A1 (başlangıç) → C2 (yetkinlik) seviyeleri
- Kategoriler: Hayvanlar, Renkler, Aile, Vücut, Yiyecek, Giyim, Ev, Doğa, Ulaşım, Duygular, Hava, Mekanlar, Teknoloji, İş, Sağlık, Eğitim, Spor, Kültür, Seyahat, Finans, Bilim ve daha fazlası
- Her kelime: İngilizce, Türkçesi ve detaylı görsel betimlem içerir

## Tasarım

- **Tema**: Premium Safir Lacivert & Mat Altın
- **Font**: Inter (arayüz) + Playfair Display (başlıklar)
- **Renk Paleti**: `#07111E` (lacivert) · `#C9A227` (mat altın) · `#F0EAD6` (krem)
- **Tam mobil uyumlu** responsive tasarım

## Ortam Değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `PORT` | Hayır | Sunucu portu (varsayılan: 8090) |
| `OPENAI_API_KEY` | Hayır | AI ipucu için (yoksa yerleşik ipucu kullanılır) |
