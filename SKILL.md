---
name: stickman-story
description: Seslendirmeli, dikey (1080x1920) çöp adam hikâye Short'u üretir — YouTube Shorts, Reels, TikTok. Fikir bulur, Türkçe senaryo yazar, seslendirmeden kelime zamanlarını çıkarır; karakterleri, 3D dünyayı, müziği ve efektleri kodla üretip altyazılı bitmiş MP4 verir. Video yapay zekâsı, Blender ya da kurgu programı gerekmez. "Çöp adam videosu yap", "stickman story", "hikâye short'u", "bu seslendirmeyi animasyona çevir", "animasyonlu kısa hikâye" isteklerinde kullan.
---

# stickman-story: fikirden bitmiş Short'a

**Ne çıkar:** Büyük yuvarlak beyaz kafalı, ince çizgi gövdeli, boynunda renkli bir atkı olan çöp adamlar; sıcak ışıklı, maket gibi bir 3D dünyada. Ortada tek kelimelik altyazı, altta müzik ve efektler. Video, seslendirme kadar sürer.
İki görünüm vardır (`config.look`):
- `paper` (varsayılan): karakterler beyaz kenarlı kâğıt kesik gibi, altında yumuşak gölge; resmin üstünde hafif kâğıt dokusu.
- `ink`: karakterler sadece siyah çizgi; dünyadaki eşyalarda siyah dış çizgi.

Bu klasör = `<skill>`. Proje klasörleri ayrı durur (ör. `~/stickman/<kısa-ad>`).

## Değişmez kurallar
1. **Özgünlük.** Hikâye, karakterler ve çekimler bize ait olur. Başka bir videoyu sahne sahne yeniden yapma; aynı konuyu kendi yorumunla anlat.
2. **Gerçek kişi ve marka yok.** Yaşayan kişileri karakter yapma, logo ve marka maskotu çizme. Tarihî kişiler, isim tabelasıyla temsilî bir çöp adam olur.
3. **Doğruluk.** Gerçek diye anlatılan her bilgiyi önce web aramasıyla doğrula. Kanıtı zayıf olanı "rivayete göre / anlatılana göre" diye kur. Uydurma rakam yok.
4. **Seslendirmeye dokunma.** Ses kesilmez, hızlandırılmaz. Görüntü sese göre zamanlanır; her tepki, kelimesinden 0–3 kare önce başlar.
5. **Claude sesi duyamaz.** Zamanlama, okunan metnin kendisinden çıkar. Kullanıcıdan **son okunan metni** mutlaka al ve `script.txt`'ye birebir koy.
6. **Uzun render'dan önce kontrol sayfası.** Önizleme karelerinin kontak sayfasına bak, hataları düzelt, kullanıcıya gönder.
7. **Ses dengesi.** Müzik konuşmanın ~17 dB altında, efektler daha da altında. Seslendirmenin üstüne hiçbir şey çıkmaz.

## Kurulum (bir kez)
- `<skill>` içinde `npm install` (three.js + Playwright).
- **ffmpeg** PATH'te olmalı.
- **Zamanlama** için Python + faster-whisper. En kolayı `uv`: `uv run <skill>/tools/timing.py <proje>` gereken paketi kendisi kurar. uv yoksa: `pip install faster-whisper` ve `python <skill>/tools/timing.py <proje>`.
- **Tarayıcı:** Playwright'ın kurduğu herhangi bir Chromium kullanılır. Hiç yoksa: `npx playwright-core install chromium-headless-shell`. Başka bir yol vermek için `STICKMAN_BROWSER=<chrome.exe yolu>`.

## Akış

### 1. Başlangıç (her zaman ilk)
Ses dosyası mesajla geldiyse doğrudan 4. adıma geç (okunan metni de iste). Yoksa tek soru sor (AskUserQuestion varsa onunla): **"Nereden başlıyoruz?"**
- **Seslendirmem hazır** → ses + okunan metin → 4. adım.
- **Metnim var** → metni 3. adımdaki kalıba göre sıkılaştır, seslendirme notlarıyla geri ver → ses gelince 4. adım.
- **Fikir lazım** → 2. adım.
- **Anlatımsız** (sadece müzik + efekt + kısa ekran yazıları) → hikâyeyi kur, çekim planına geç; zamanlama adımı yok (aşağıda "Anlatımsız mod").
Süreyi de sor: varsayılan **30–40 sn**; 45–60 sn de olur.

### 2. On fikir
Tek mesajda numaralı **10 fikir** ver, kullanıcı numara seçsin ya da "başka" desin. Her fikirde:
- **Başlık:** 4–8 kelime, merak uyandıran.
- **İlk cümle:** videonun ilk okunan cümlesi; kısa, şaşırtan bir gerçek ("Bir köy, yüz yıl boyunca saatini hiç ayarlamadı.").
- **Son vuruş:** videoyu bitiren ters köşe, tek satır.
- **Canlanacak anlar:** ekranda büyük görünecek 2–3 an (kovalamaca, çöküş, ortaya çıkış, kalabalığın tepkisi).
- **Gerçeklik:** belgelenmiş / tartışmalı / rivayet.
İyi fikir: gösterilebilir bir sebep–sonuç, sıradan bir kahraman, gittikçe büyüyen bir durum, sonda ters köşe, basit şekillerle kurulabilen bir mekân (sokak, köy meydanı, saray, liman, laboratuvar, oda, pazar). Fikirleri dönemlere ve konulara yay: antik çağ, Osmanlı, 1800'ler, bugün, bilim, hayvanlar, icatlar, garip kanunlar, tesadüf buluşlar. Siyaset, şiddet ve gerçek kişiyle alay yok.

### 3. Senaryo
Sadece okunacak metni yaz. Türkçe konuşma ~2,5 kelime/sn: **30 sn ≈ 75 kelime, 40 sn ≈ 100, 60 sn ≈ 150.** Kalıp:
1. **Merak** — girişsiz, ilk cümle şaşırtır.
2. **Yer ve zaman** — kim, nerede, ne zaman; bir somut ayrıntı.
3. **Büyüyen olay** — 2–4 vuruş; her biri bir öncekinden büyük, biri komik abartı.
4. **Kırılma** — "Ama…" / "Meğer…" ile asıl sebep.
5. **Son cümle** — kısa, ironik; videonun son kelimeleri.
Cümleler 6–14 kelime; rakamlar yazıyla ("bin sekiz yüz yetmiş"); izleyicinin zaten gördüğünü anlatma. Yabancı adların okunuşunu ayrıca not et.
Kullanıcıya gönder: kopyalanabilir senaryo + kelime sayısı + tahmini süre, tek paragraflık görsel plan, seslendirme notları (tek anlatıcı, sıcak ve hikâye anlatan bir ses; ElevenLabs'te bir anlatıcı sesi, hız 1.0–1.1; cümle sonlarında doğal duraklar; müziksiz mp3/wav). Sonunda: **"Seslendirmeyi yükle, videonun tamamını ben yapayım."**

### 4. Proje
```
node <skill>/tools/new.mjs <proje>
```
Sesi `<proje>/voice.mp3` (veya .wav), okunan metni `<proje>/script.txt` olarak koy. Buradan sonra durmadan çalış; sadece zamanlama çözülemezse sor.

### 5. Zamanlama
```
uv run <skill>/tools/timing.py <proje>
```
→ `work/words.json` (her kelime: yazım, başlangıç, bitiş, ardından gelen noktalama) ve `work/sentences.json`. Çıktıdaki **S00, S01…** cümle listesi (kare aralıklarıyla) çekim planının iskeletidir. Eşleşme %85'in altındaysa `script.txt` okunanla aynı değildir: kullanıcıya sor ya da metni düzelt.

### 6. Çekim planı (`work/PLAN.md`, koddan önce)
Her çekim için tek satır: kare aralığı · cümle/kelimeler · mekân · ışık · kamera · karakterler (yer, poz, ifade) · efekt · ses efekti.
- **Kare 0 ilk görüntüdür:** boş açılış yok, ilk cümlenin resmiyle başla.
- Genelde **cümle başına bir çekim**; uzun cümleyi kelimesinden böl, çok kısa olanları birleştir. Çekim 1,5–4 sn.
- **Her cümleyi birebir canlandır.** Espriyi eşyalar taşır: tabela, gazete, kâğıt, para, telefon.
- **Çekim boylarını değiştir:** yakın açılış → geniş kuruluş planı → iki kişi → eşyaya yakın → tepki yakın planı → son için yavaş itme.
- **Işıkla duygu:** normal `day`, gerilim ya da düşüş `golden`/`dramatic`, sır ve açıklama `night`/`interior`. Zaman atlamasında 4–6 karelik beyaz flaş.
- **Son cümlede** müzik durur (`music.end`), vuruş (`sting`) gelir, kamera yavaşça yaklaşır.

### 7. story.js
`<proje>/story.js` üç şey dışa verir: `config`, `setup(S)` (dünyayı bir kez kurar), `shot(f, S)` (f. kareyi tarif eder; aynı f → aynı sonuç). Başlangıç şablonu her cümlede kesen basit bir örnektir; planına göre baştan yaz. Sahneleri birbirinden uzağa kur (ör. sokak x=0, iç mekân x=200), kamera hangisine bakıyorsa o görünür.

```js
export const config = { fps: 30, look: "paper" };     // frames/seconds verilmezse süre sesten gelir
export function setup(S) {
  S.ground(S.tex.paper("#e3d3b4", 2, [60, 60]), 400);
  S.street({ len: 160, width: 6 }); S.row(-40, 40, -9.5, { seed: 4 }); S.hills(-80);
  S.actor("ali", { accent: "#d97757", hat: "fez", moustache: true });
}
const PATH = [{ f: 0, v: [-2, 0, -1] }, { f: 60, v: [0, 0, -2] }];   // ~1,1 m/sn yürüyüş
export function shot(f, S) {
  const w = S.walk(f, PATH, { who: "ali" });                    // konum + adım + yön, ayak kaymaz
  const cam = (pad) => S.fit([PATH[0].v, PATH.at(-1).v], { from: [0.8, 0.3, 0.6], fov: 40, pad });   // herkes kadrajda
  return {
    light: "golden",
    camera: S.cam(f, [{ f: 0, ...cam(0.1) }, { f: 90, ...cam(0.05) }]),
    actors: [{ id: "ali", pos: w.pos, dir: w.dir, state: { ...w.state, face: "smug", blink: S.blink(f, 1) } }],
    effects: [{ kind: "exclaim", pos: [0.3, 2.2, -2], size: 0.5, t: S.clamp((f - 60) / 20) }],
  };
}
```

**`shot` dönüşü:** `camera {pos, target, fov}` · `light`: `day | golden | night | interior | dramatic` · `actors [{id, pos, state, dir, flip, scale, yaw, shadow, edgeOk, touchOk, hiddenOk}]` (kart kameraya döner; `dir` yürüme yönü: profilde yüzü o yöne çevirir; `edgeOk` gerçek bir giriş/çıkışta kenar uyarısını kapatır; `touchOk` banka oturma gibi bir nesneye bilerek değmeyi izinli yapar) · `effects [{kind, pos, size, t}]` · `caption`: verilmezse kelime zamanından otomatik; `false` kapatır; metin ya da `{text, age}` verilirse o yazılır (`age` saniye: yeni yazının küçük zıplaması için) · `flash`, `fade` (0..1) · `overlay(g, w, h, f)` (2D çizim: isim kartı, tarih yazısı) · `before(f, S)` (render'dan hemen önce, hareketli nesneler için).

**Dünya (metre, y yukarı, kamera genelde -z'ye bakar):**
`S.box(w,h,d, renk|malzeme|[6 malzeme], [x,y,z], {rot, parent, outline})` (y = taban) · `S.cyl(rÜst, rAlt, h, …)` · `S.ball(r, …, {squash})` · `S.cone(r, h, …)` · `S.card(w, h, …)` · `S.group([x,y,z], rot)` · `S.mat("#renk", {map, glow})` · `S.ground(doku, boyut)` · `S.building(x, z, {w, d, floors, wall, roof, rot, sign:{text,bg,fg}, shutter, flat})` · `S.row(x0, x1, z, {seed, rot, floors})` · `S.street({len, width, z})` · `S.lamp(x, z, {on})` · `S.tree(x, z, {s, type: round|pine})` · `S.bush` · `S.cloud(x, y, z, s)` · `S.hills(z)` · `S.sign("YAZI", w, h, [x,y,z], {bg, fg, sub, rot})` · `S.fence(x0, x1, z)` · `S.bench(x, z, rot)` · `S.crate` · `S.barrel` · `S.room({w, d, h, wall, floor, at, window})`.
Kule, köprü, gemi, saray gibi özel yapıları kutu/silindir/koni ile kur, `group` ile topla; hareketli parçanın referansını `S.refs` içinde sakla ve `before` içinde oynat.
**Dokular `S.tex`:** `paper(renk, seed, tekrar)`, `cobble(seed, tekrar, renk)`, `facade({wall, trim, glass, shutter, floors, cols, door, sign, meters})`, `tiles(renk)`, `signboard(yazı, {bg, fg, sub})`, `shade(renk, k)`, `makeCanvas`, `toTexture` (kendi tablonu/gazeteni CanvasTexture olarak çiz).

**Karakter `S.actor(id, spec)`:** `accent` (atkı rengi), `scarf:false`, `head` (kafa rengi), `hat: cap|beanie|top|bowler|fez|straw|crown|hood`, `hatColor`, `hair: tuft|bun|long|spiky`, `hairColor`, `moustache`, `beard`, `glasses`, `build: adult|kid|tall`.
**Durum `state`:** `face`: neutral happy laugh shock angry sad think smug scared sleep wow nervous · `arms`: down hips up cheer point wave shrug think cross present hold scared facepalm reach (ya da 4 açı: `[solÜst, solAlt, sağÜst, sağAlt]`) · `legs`: stand walk run sit jump + `phase` (0..1 adım döngüsü; yürüyüşte elle verme, `S.walk` versin) · `view`: front (kameraya dönük) | side (profil) | back (arkası dönük, yüz yok) | auto (yürüme yönünden) · `look` (-1..1 bakış) · `blink` · `talk` (0..1 ağız) · `lean` · `headTilt` (derece) · `sweat` · `blush` · `wind` (atkı) · `prop: {kind: lantern|paper|coin|phone|sign|magnifier|simit|ring|bread, text, color}` (sağ elde).
**Efektler:** exclaim question stars sparkle idea sweat hearts zzz anger burst(`text`) coin note.
**Yardımcılar:** `S.walk(f, [{f, v:[x,y,z], pass}], {who, run, scale})` → `{pos, dir, state}` (yürüyüş ve koşu: adım uzunluğu karakterin boyundan, adım fazı yürünen yoldan gelir, ayak yerde kaymaz; durup kalkarken yumuşak geçiş; aynı noktayı tekrar yazmak beklemek demek; `pass: true` köşeden yavaşlamadan geçer) · `S.fit([konum | {pos, crop, scale, build}], {from, fov, pad, bounds})` → kamera (listedeki herkesi tam kadraja alır; `bounds` kamerayı bir odanın içinde tutar; `crop` 0,4 = belden yukarı yakın plan; kadraja boş bir yer de koyabilirsin, ör. boş kalan sıra) · `S.floor(x, z)` (o noktadaki basılacak yükseklik: kaldırımda 0,15) · `S.cam(f, keys)` (yumuşak kamera, hafif nefes; anahtarlara `S.fit` sonucu da verilir) · `S.track(f, [{f, v:[x,y,z]}])` (kayan nesneler için; karakter yürütmek için değil) · `S.span(f, f0, f1)` (0..1) · `S.pick(f, [{from,…}])` · `S.sentences` ({from, to, text}) · `S.wordAt("kelime")` (karesi) · `S.wordFrame(i)` · `S.talking(f, f0, f1)` · `S.blink(f, tohum)` · `S.idle(f, tohum)` · `S.clamp`.

**Hareket ve yerleşim kuralları (her hikâyede):**
- **Yürüyüş hep `S.walk` ile.** `phase: f/20` gibi elle verilen faz ayakları kaydırır, absürt görünür. Normal hız yürüyüşte 1,0–1,4 m/sn, yaşlı biri 0,8–0,9, koşu 2,5–4. Köşe gerekiyorsa ara noktaya `pass: true` yaz, kare sayısını parça uzunluğuyla orantılı ver.
- **Profil en iyi okunan yürüyüştür.** `view: "auto"` yol kameraya neredeyse dik gelmiyorsa (20°'den geniş) profil seçer. Duran karakter yürüdüğü yöne bakmaya devam eder; kameraya bakmasını istiyorsan `view: "front"` ver.
- **Dikey kadrajda yan yana dizme, derinliğe diz.** 9:16 karede yan yana üç kişi ya küçülür ya kesilir. Sırayı, grubu, yürüyüş yolunu kameradan uzaklaşan bir çizgiye koy; kamerayı o çizgi boyunca baktır (`from` ile).
- **Kamerayı `S.fit` ile kur.** Elle konum yazıyorsan `--check` mutlaka geçsin. Kamera kayarken bir karakterin yarısı kenarda kalıyorsa ya o karakteri baştan kadraja al ya da kes (cut).
- **Kapalı mekânda `bounds` ver.** `S.fit(..., { bounds: [[x0,y0,z0],[x1,y1,z1]] })` kamerayı odanın içinde tutar; oda dar gelirse lensi genişletir. Vermezsen kamera duvarın dışına çıkar ve ekran duvarla dolar. Odada kameraya çok yakın (1–1,5 m) duran ya da koşan biri en geniş lensle bile sığmayabilir: yolları odanın ortasına al.
- **Karakteri kamerayla arasına bir şey girmeyecek yere koy.** Sütun, bank sırtı, kulübe kameranın önündeyse karakter görünmez (`--check` bunu `hidden` diye yazar). Oturan biri bankın arkasında kalıyorsa bankı çevir (`S.bench(x, z, Math.PI)`).
- **Kartlar düzdür:** karakteri bir nesneye (araba, tezgâh, duvar) 0,4 m'den fazla yaklaştırma, kart nesnenin içine girer ve bacak/kol kaybolur. Yükseltinin (kaldırım, sahne) üstünde duran karakterin `pos` y'si `S.floor(x, z)` olsun.
- **Sürprizi erken verme.** Sonda ortaya çıkacak tabela, nesne ya da kişi önceki çekimlerin kenarında bile görünmesin; kamerayı ona göre çevir.
Geniş planda kamera 2–3 m yükseklikte, yakın planda göz hizasında (1,4–1,6 m). Kamera bina ya da ağaç içinden geçmesin (`ink` görünümünde içeride kalan kamera ekranı siyaha boğar). Her çekimde bir şey kıpırdasın: göz kırpma, nefes, atkı, efekt, kamera.

### 8. Kontrol (uzun render'dan önce, zorunlu)
**a) Otomatik kare kare kontrol** (bütün kareler, resim kaydetmeden, birkaç dakika):
```
node <skill>/tools/render.mjs <proje> --check
```
Her karede bakar ve kare aralıklarıyla yazar:
- `left / right / top`: karakter kadraj kenarında yarım kalmış,
- `caption`: tek kelimelik altyazı bir yüzün üstüne biniyor,
- `prop`: karakterin kartı bir nesnenin içine girmiş (araba, duvar, kaldırım),
- `hidden`: karakterin başı ve göğsü bir nesnenin arkasında kalmış (sütun, kulübe, bank sırtı).
Rapor temiz çıkana kadar düzelt (kamera `S.fit`, konum, yol). `edgeOk` / `touchOk` / `hiddenOk` sadece gerçekten bilerek yapılan anlarda. `hidden` nesnenin kutusuna bakar: koni ya da küre gibi şekillerin arkasındaki biri karelerde görünüyorsa `hiddenOk` ver. Aynı geçiş ayak basışlarını da `work/steps.json`a yazar (bkz. 9. adım).

**b) Gözle kare kare kontrol.** Otomatik kontrol her şeyi görmez (yürüyüşün doğallığı, sürprizin erken görünmesi, boş kadraj, yanlış yöne bakış):
```
node <skill>/tools/render.mjs <proje> --frames 0-99999:6 --out <proje>/stills
node <skill>/tools/sheet.mjs <proje>/stills
```
Yürüyüş olan çekimlerde daha sık bak (her 2–4 kare). Şüpheli bir karenin tam boy halini kırp ve bak. Bakılacaklar: ayak yerde mi, adım doğal mı, karakter "kayıyor" mu, kamera duvar içinde mi, yüz kadrajda mı, karakter direğin arkasında mı, yazı ters mi, kadraj boş mu, sonda ortaya çıkacak şey önceden görünüyor mu. Sayfayı kullanıcıya tek satırlık çekim özetiyle göster, sonra tam render'a geç.

### 9. Ses
`<proje>/sound.json`:
```json
{ "voice": "voice.mp3",
  "music": { "mood": "playful", "bpm": 104, "level": -17, "start": 0, "end": 31.2, "sting": true },
  "sfx": [ { "t": 0.2, "kind": "whoosh" }, { "t": 6.1, "kind": "coin" }, { "t": 11.3, "kind": "thud", "gain": -3 } ],
  "steps": { "gain": -8 },
  "tail": 0.8 }
```
`"steps"`: kadrajdaki her yürüyen karakterin ayağı yere bastığı anda tek bir yumuşak adım sesi koyar (`render.mjs --check`in yazdığı `work/steps.json`dan). Elle `footsteps` koyma; yürüyüş değişirse önce `--check`, sonra ses.
**Anlatımsız mod:** `"voice": null` ve `"duration": <saniye>` yaz; müzik konuşma seviyesine çıkar, hiçbir şey kısılmaz. `story.js`te `config.seconds` aynı süre olsun ve yazılar `caption` ile kare aralıklarına göre verilsin (ör. `[[6,112,"Pazar sabahı"], …]`). Hikâye yazısız da anlaşılmalı: yazı sadece vuruşu güçlendirir.
Ruh hali: `playful` (oyuncu, sinsi), `mystery`, `tense`, `warm`, `epic`. Efektler: pop boing whoosh swish ding bell thud tick click sparkle magic coin sting impact splash step footsteps drumroll riser gasp. Zamanlar saniye (kare / 30). `node <skill>/tools/sound.mjs <proje>` → `work/mix.wav`. Görüntü zamanlaması değişirse sesi yeniden üret.

### 10. Render ve bitir
```
node <skill>/tools/render.mjs <proje>            (kesilirse: --resume)
node <skill>/tools/finish.mjs <proje> "Başlık"
```
→ `<proje>/out/<Başlık>.mp4` (H.264, −14 LUFS, tepe −1 dB) + donmuş ya da siyah kare raporu + `out/qa.jpg`. QA sayfasına bak; ≥0,5 sn donma ya da siyah kare varsa düzelt. Komut zaman aşımına uğruyorsa render'ı parça parça çalıştır (`--frames 0-299`, `300-599`, … `--resume` ile) ve her parçadan sonra kısa ilerleme yaz.
Teslimde: MP4 yolu, her çekimin ne gösterdiği (birkaç satır), sıradaki fikir önerisi.

## Klasör yapısı
`studio/` (tarayıcıda çalışan motor: `core.js` sahne-ışık-kamera-altyazı, `figure.js` çöp adam, `world.js` dünya parçaları, `textures.js` dokular, `effects.js` efektler, `index.html`) · `tools/` (new, timing, render, sheet, sound, finish) · `templates/story.js` (başlangıç hikâyesi) · `tests/style-test.js` (iki görünümün deneme sahnesi).
