#!/usr/bin/env python3
"""
Exact sentence timing with speech recognition (word-level forced alignment).

The admin page's "Avtomatik sinxronlash" button is usually enough. Use this script when you want
word-accurate timings, e.g. for audio with music or very short pauses. It writes start/end times
straight into the lesson JSON.

Setup (once):   pip install pocketsphinx        (bundles an English model; needs ffmpeg on PATH)
Usage:          python scripts/align-audio.py content/summaries/atomic-habits.json public/audio/atomic-habits.mp3
Unknown words:  add a pronunciation, e.g.  --word aziz="AH Z IY Z"   (CMUdict phone set)
"""
import argparse, json, re, subprocess, sys

from pocketsphinx import Decoder

SPELLING = {"practising": "practicing", "practise": "practice", "behaviour": "behavior", "favours": "favors",
            "favour": "favor", "colour": "color", "organise": "organize", "realise": "realize"}
NUMBERS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
           "8": "eight", "9": "nine", "10": "ten"}
EXTRA = {"bookly": "B UH K L IY", "bookly's": "B UH K L IY Z", "aziz": "AH Z IY Z", "covey": "K AH V IY",
         "covey's": "K AH V IY Z", "synergize": "S IH N ER JH AY Z", "proactivity": "P R OW AE K T IH V IH T IY",
         "onstage": "AA N S T EY JH", "clear's": "K L IH R Z", "carnegie's": "K AA R N AH G IY Z",
         "teammate": "T IY M M EY T", "textbook": "T EH K S T B UH K", "timetable": "T AY M T EY B AH L"}


def words_of(sentence):
    s = sentence.replace("’", "'").replace("‘", "'")
    out = []
    for tok in re.split(r"[\s\-—–;:,.!?\"“”«»()]+", s.lower()):
        tok = tok.strip("'")
        if tok:
            out.append(NUMBERS.get(tok, SPELLING.get(tok, tok)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lesson")
    ap.add_argument("audio")
    ap.add_argument("--word", action="append", default=[], help='extra pronunciation: word="PH ON ES"')
    args = ap.parse_args()

    doc = json.load(open(args.lesson, encoding="utf-8"))
    sentences = [s for sec in doc["content"]["sections"] for s in sec["sentences"]]

    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", args.audio, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         check=True, capture_output=True).stdout
    duration = len(raw) / 32000

    d = Decoder(samprate=16000, bestpath=False)
    extra = dict(EXTRA)
    for w in args.word:
        k, v = w.split("=", 1)
        extra[k.lower()] = v.strip('"')

    words, owner = [], []
    for i, s in enumerate(sentences):
        for w in words_of(s["en"]):
            words.append(w)
            owner.append(i)
    missing = sorted({w for w in words if d.lookup_word(w) is None})
    unknown = [w for w in missing if w not in extra]
    if unknown:
        sys.exit("Unknown words (add with --word word=\"PHONES\"): " + ", ".join(unknown))
    for w in missing:
        d.add_word(w, extra[w], True)

    d.set_align_text(" ".join(words))
    d.start_utt()
    d.process_raw(raw, full_utt=True)
    d.end_utt()
    if d.hyp() is None:
        sys.exit("Alignment failed: check that the text matches the audio exactly.")
    segs = [(re.sub(r"\(\d+\)$", "", s.word), s.start_frame / 100, (s.end_frame + 1) / 100) for s in d.seg()]
    segs = [s for s in segs if s[0] not in ("<sil>", "<s>", "</s>", "[NOISE]")]
    if len(segs) != len(words):
        sys.exit(f"Alignment returned {len(segs)} words for {len(words)} expected.")

    spans = []
    for i in range(len(sentences)):
        ws = [s for s, o in zip(segs, owner) if o == i]
        spans.append((ws[0][1], ws[-1][2]))
    for i, s in enumerate(sentences):
        start = 0.0 if i == 0 else max(spans[i - 1][1], spans[i][0] - 0.12)
        nxt = spans[i + 1][0] if i + 1 < len(spans) else duration
        s["start"] = round(start, 2)
        s["end"] = round(min(spans[i][1] + 0.2, max(nxt - 0.05, spans[i][1]), duration), 2)

    doc["content"].setdefault("audio", {})
    if doc["content"]["audio"]:
        doc["content"]["audio"]["durationSec"] = round(duration, 2)
    json.dump(doc, open(args.lesson, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"Timed {len(sentences)} sentences ({duration:.1f}s of audio) → {args.lesson}")


if __name__ == "__main__":
    main()
