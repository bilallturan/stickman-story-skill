# /// script
# requires-python = ">=3.9"
# dependencies = ["faster-whisper>=1.0"]
# ///
"""Word timings for the narration.

    uv run tools/timing.py <project>          (or: python tools/timing.py <project> with faster-whisper installed)

Reads <project>/voice.(mp3|wav|m4a|ogg) and <project>/script.txt (the text exactly as it was read).
Whisper hears the words; the script decides how they are written. Each script word gets the time of the
letters Whisper matched to it, so captions always use the script's spelling.

Writes <project>/work/words.json   [{"w": word, "start": s, "end": s, "p": punctuation after the word}]
       <project>/work/sentences.json [{"i", "text", "start", "end", "from", "to"}]  (frames at 30 fps)
Env: WHISPER_MODEL (default "small"), LANG_CODE (default "tr"), FPS (default 30).
"""
import difflib, glob, json, os, re, sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

proj = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
fps = int(os.environ.get("FPS", "30"))
voices = [p for ext in ("mp3", "wav", "m4a", "ogg") for p in glob.glob(os.path.join(proj, f"voice.{ext}"))]
if not voices:
    sys.exit("voice.mp3 (or .wav/.m4a/.ogg) not found in the project folder")
script_path = os.path.join(proj, "script.txt")
if not os.path.exists(script_path):
    sys.exit("script.txt not found: put the exact text that was read into it")
script = open(script_path, encoding="utf-8").read().strip()


def letters(s):
    s = s.replace("I", "ı").replace("İ", "i").lower()
    return [c for c in s if c.isalnum()]


# script tokens: the word as shown in captions + the punctuation that follows it
tokens = []
for m in re.finditer(r"([^\s]+)", script):
    raw = m.group(1)
    word = raw.strip("\"'“”‘’«»()[]{}—–-")
    trail = re.findall(r"[.,!?…:;]+$", word)
    word = re.sub(r"[.,!?…:;]+$", "", word)
    if not letters(word):
        if tokens and re.search(r"[.!?…]", raw):
            tokens[-1]["p"] += re.sub(r"[^.!?…]", "", raw)
        continue
    tokens.append({"w": word, "p": trail[0] if trail else ""})

import subprocess

import numpy as np
from faster_whisper import WhisperModel

# decode with ffmpeg ourselves (16 kHz mono float) — avoids audio-library version clashes
raw = subprocess.run([os.environ.get("FFMPEG", "ffmpeg"), "-v", "error", "-i", voices[0], "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(raw, dtype=np.float32).copy()
duration = len(audio) / 16000
model = WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, language=os.environ.get("LANG_CODE", "tr"), word_timestamps=True,
                                  vad_filter=False, beam_size=5, initial_prompt=script[:220])
heard = [w for s in segments for w in s.words]

# letter-level alignment: every heard letter carries a time (spread across its word)
h_chars, h_times = [], []
for w in heard:
    ls = letters(w.word)
    for k, c in enumerate(ls):
        h_chars.append(c)
        h_times.append(w.start + (k + 0.5) / len(ls) * (w.end - w.start))
s_chars, s_owner = [], []
for i, t in enumerate(tokens):
    for c in letters(t["w"]):
        s_chars.append(c)
        s_owner.append(i)

times = [None] * len(s_chars)
for a, b, n in difflib.SequenceMatcher(None, s_chars, h_chars, autojunk=False).get_matching_blocks():
    for k in range(n):
        times[a + k] = h_times[b + k]
known = [i for i, t in enumerate(times) if t is not None]
if not known:
    sys.exit("Could not match the audio to script.txt. Is it the same text, in the same language (LANG_CODE)?")
for i in range(len(times)):          # fill unmatched letters between their matched neighbours
    if times[i] is None:
        left = max((k for k in known if k < i), default=None)
        right = min((k for k in known if k > i), default=None)
        if left is None:
            times[i] = max(0.0, times[right] - (right - i) * 0.06)
        elif right is None:
            times[i] = min(duration, times[left] + (i - left) * 0.06)
        else:
            times[i] = times[left] + (times[right] - times[left]) * (i - left) / (right - left)

words = []
for i, t in enumerate(tokens):
    ts = [times[k] for k, o in enumerate(s_owner) if o == i]
    words.append({"w": t["w"], "start": round(min(ts) - 0.04, 3), "end": round(max(ts) + 0.06, 3), "p": t["p"]})
for a, b in zip(words, words[1:]):   # keep words in order and non-overlapping
    if b["start"] < a["start"]:
        b["start"] = a["start"] + 0.02
    a["end"] = min(a["end"], b["start"])

sentences, cur = [], []
for w in words:
    cur.append(w)
    if re.search(r"[.!?…]", w["p"]) or w is words[-1]:
        sentences.append({"i": len(sentences), "text": " ".join(x["w"] for x in cur), "start": cur[0]["start"], "end": cur[-1]["end"],
                          "from": round(cur[0]["start"] * fps), "to": round(cur[-1]["end"] * fps)})
        cur = []

work = os.path.join(proj, "work")
os.makedirs(work, exist_ok=True)
json.dump(words, open(os.path.join(work, "words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
json.dump(sentences, open(os.path.join(work, "sentences.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

match = len(known) / max(1, len(s_chars))
print(f"voice: {os.path.basename(voices[0])} · {duration:.2f} s · {len(words)} words · {match:.0%} of script letters matched")
if match < 0.85:
    print("WARNING: low match. script.txt may differ from what was read; captions can drift.")
for s in sentences:
    print(f"  S{s['i']:02d}  frames {s['from']:4d}-{s['to']:4d}  ({s['start']:5.2f}-{s['end']:5.2f} s)  {s['text']}")
