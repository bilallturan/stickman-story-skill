# stickman-story

**Claude Code skill'i:** seslendirmeli, dikey (1080×1920) çöp adam hikâye Short'ları. YouTube Shorts, Instagram Reels ve TikTok için.

Claude sana hikâye fikirleri sunar ve Türkçe senaryoyu yazar. Seslendirmeyi verdiğinde kelimelerin zamanını çıkarır, sahneleri kurar, karakterleri oynatır, müziği ve efektleri üretir; sonunda altyazılı bir MP4 teslim eder. Her şey kodla üretilir: video yapay zekâsı, Blender ya da kurgu programı gerekmez. Müzik ve efektler de sentezlenir, telif sorunu yoktur.

*English: a Claude Code skill that turns a narration into a finished vertical stickman story short, entirely rendered with code (three.js + Playwright + ffmpeg). Instructions in SKILL.md are in Turkish; the code and API are in English.*

## Kurulum

```bash
git clone https://github.com/bilallturan/stickman-story-skill ~/.claude/skills/stickman-story
cd ~/.claude/skills/stickman-story
npm install
```

Gerekenler:
- **Node.js 18+**
- **ffmpeg** (PATH'te)
- **uv** ya da Python + `faster-whisper` (seslendirmeden kelime zamanları için)
- **Chromium:** Playwright'ın kurduğu herhangi bir Chromium kullanılır. Hiç yoksa: `npx playwright-core install chromium-headless-shell`

Windows, macOS ve Linux'ta çalışır. Ekran kartı varsa onu kullanır; Linux'ta varsayılan olarak işlemciyle (SwiftShader) çizer.

## Kullanım

Claude Code'da şöyle bir şey yaz: **"Çöp adam hikâye short'u yapalım"** ya da **"Bu seslendirmeyi çöp adam animasyonuna çevir"**.
Claude şu adımlardan geçer:
1. fikir;
2. senaryo;
3. sen seslendirirsin;
4. kelime zamanlaması;
5. çekim planı;
6. kontrol sayfası;
7. müzik ve efekt;
8. MP4.

Elle çalıştırmak istersen:

```bash
node tools/new.mjs ~/stickman/ilk-hikaye          # proje: story.js, script.txt, sound.json
# voice.mp3 ve script.txt'yi koy
uv run tools/timing.py ~/stickman/ilk-hikaye      # work/words.json, work/sentences.json
node tools/render.mjs ~/stickman/ilk-hikaye --frames 0-99999:30 --out ~/stickman/ilk-hikaye/stills
node tools/sheet.mjs ~/stickman/ilk-hikaye/stills # önizleme kontak sayfası
node tools/sound.mjs ~/stickman/ilk-hikaye        # work/mix.wav
node tools/render.mjs ~/stickman/ilk-hikaye       # bütün kareler
node tools/finish.mjs ~/stickman/ilk-hikaye "İlk Hikâye"   # out/İlk Hikâye.mp4
```

İki görünüm (`story.js` içinde `config.look`):
- **`paper`:** beyaz kenarlı kâğıt kesik karakterler.
- **`ink`:** sade siyah çizgi.

## Lisans

MIT, bkz. `LICENSE`.

Kullanılan kütüphaneler:
- **three.js** (MIT, npm ile kurulur)
- **Playwright** (Apache-2.0, npm ile kurulur)
- **Fredoka** fontu (SIL Open Font License 1.1, `studio/fonts/OFL.txt`)
