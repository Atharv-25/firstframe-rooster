#!/usr/bin/env python3
"""
Add creator demo reels to the roster, end to end.

Downloads an Instagram reel, verifies it was actually posted by the handle you
claim, compresses it to the roster's house spec, generates a poster frame, and
wires it into src/app/data/creators.json.

Why this exists
---------------
Instagram has closed off every unauthenticated download path we used to rely on:
instaloader's GraphQL endpoint returns 403, the /embed/ HTML no longer carries a
media URL, the RapidAPI subscription lapsed, and the public proxies are dead.
yt-dlp still works. This script is the one path that does.

The verify step is not optional padding. Reel URLs arrive pasted in chat, in an
order that does not always match the handles pasted next to them -- that has
already produced two wrong attributions. yt-dlp reports the true posting account,
so we check it instead of trusting the list.

Usage
-----
    # one reel
    python scripts/add_reel.py https://www.instagram.com/reel/ABC123/ somehandle

    # several at once
    python scripts/add_reel.py URL1 handle1 URL2 handle2 ...

    # from a file, one "<url> <handle>" pair per line (# comments allowed)
    python scripts/add_reel.py --file reels.txt

    # which roster creators still have no video?
    python scripts/add_reel.py --check

Flags
-----
    --check       report creators with no playable video, then exit
    --file PATH   read "<url> <handle>" pairs from PATH
    --force       install even if the posting account != the handle given
    --overwrite   replace an existing video instead of skipping it
    --keep-temp   leave the raw download in place for inspection

Requires: yt-dlp (python -m pip install yt-dlp) and ffmpeg on PATH.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO_DIR = os.path.join(ROOT, "public", "videos")
COVER_DIR = os.path.join(ROOT, "public", "covers")
CREATORS = os.path.join(ROOT, "src", "app", "data", "creators.json")

# Matches the existing library: h264 720p tall, 30fps, ~415-490 kbps total.
CRF = "30"
COVER_W, COVER_H = 360, 640


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def load_creators():
    with open(CREATORS, encoding="utf-8") as fh:
        return json.load(fh)


def save_creators(data):
    with open(CREATORS, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)


def shortcode(url):
    m = re.search(r"/(?:reel|reels|p)/([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else None


def have_video(creator, existing):
    reels = creator.get("reels") or []
    if not reels:
        return False
    url = reels[0].get("videoUrl") or ""
    if url.startswith("http"):
        return True
    return url[:-4].lower() in existing if url.endswith(".mp4") else False


def cmd_check():
    data = load_creators()
    existing = {f[:-4].lower() for f in os.listdir(VIDEO_DIR) if f.endswith(".mp4")}
    gaps = [c for c in data if not have_video(c, existing)]
    print(f"{len(data)} creators, {len(existing)} video files, {len(gaps)} without a video\n")
    for c in gaps:
        print(f"  {(c.get('name') or '?')[:32]:32} @{c.get('handle') or '?'}")
    return 0 if not gaps else 1


def probe_owner(url):
    """Ask yt-dlp who actually posted this, without downloading it."""
    r = run([sys.executable, "-m", "yt_dlp", "--no-warnings", "--skip-download",
             "--print", "%(channel)s", url])
    if r.returncode != 0:
        return None, (r.stderr.strip().splitlines() or ["yt-dlp failed"])[-1]
    owner = (r.stdout.strip().splitlines() or [""])[-1].strip()
    return (owner or None), None


def process(url, handle, args, data, existing):
    code = shortcode(url)
    if not code:
        print(f"  SKIP  {handle}: could not parse a shortcode from {url}")
        return False

    creator = next((c for c in data if (c.get("handle") or "").lower() == handle.lower()), None)
    if creator is None:
        print(f"  SKIP  {handle}: no creator with that handle in creators.json")
        return False

    dest = os.path.join(VIDEO_DIR, f"{handle}.mp4")
    if os.path.exists(dest) and not args.overwrite:
        print(f"  SKIP  {handle}: video already exists (use --overwrite to replace)")
        return False

    owner, err = probe_owner(url)
    if err:
        print(f"  FAIL  {handle}: {err}")
        return False
    if owner and owner.lower() != handle.lower():
        msg = f"posted by @{owner}, not @{handle}"
        if not args.force:
            print(f"  STOP  {handle}: {msg} -- re-check the pairing, or pass --force")
            return False
        print(f"  WARN  {handle}: {msg} -- installing anyway (--force)")

    tmp = tempfile.mkdtemp(prefix="reel_")
    try:
        raw = os.path.join(tmp, "raw.mp4")
        r = run([sys.executable, "-m", "yt_dlp", "--no-warnings", "--quiet",
                 "-f", "best[ext=mp4]/best", "-o", raw, url])
        if r.returncode != 0 or not os.path.exists(raw):
            print(f"  FAIL  {handle}: download failed -- "
                  f"{(r.stderr.strip().splitlines() or ['unknown error'])[-1]}")
            return False

        enc = os.path.join(tmp, "enc.mp4")
        r = run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", raw,
                 "-vf", "scale=-2:720", "-c:v", "libx264", "-crf", CRF,
                 "-preset", "veryfast", "-profile:v", "high", "-pix_fmt", "yuv420p",
                 "-r", "30", "-c:a", "aac", "-b:a", "64k",
                 "-movflags", "+faststart", enc])
        if r.returncode != 0 or not os.path.exists(enc):
            print(f"  FAIL  {handle}: ffmpeg encode failed -- {r.stderr.strip()[:120]}")
            return False

        cover = os.path.join(tmp, "cover.jpg")
        run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-ss", "1", "-i", enc,
             "-vframes", "1", "-vf",
             f"scale={COVER_W}:{COVER_H}:force_original_aspect_ratio=increase,"
             f"crop={COVER_W}:{COVER_H}",
             "-q:v", "4", cover])

        shutil.move(enc, dest)
        if os.path.exists(cover):
            shutil.move(cover, os.path.join(COVER_DIR, f"{handle}.jpg"))

        creator["reels"] = [{
            "id": f"reel_{code}",
            "label": "Demo Reel",
            "videoUrl": f"{handle}.mp4",
            "coverUrl": f"/covers/{handle}.jpg",
        }]
        existing.add(handle.lower())
        kb = os.path.getsize(dest) // 1024
        print(f"  OK    {handle}: {kb}KB  (verified @{owner or 'unknown'})")
        return True
    finally:
        if args.keep_temp:
            print(f"        temp kept at {tmp}")
        else:
            shutil.rmtree(tmp, ignore_errors=True)


def parse_pairs(args):
    if args.file:
        pairs = []
        with open(args.file, encoding="utf-8") as fh:
            for line in fh:
                line = line.split("#", 1)[0].strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) != 2:
                    print(f"  SKIP  malformed line: {line!r}")
                    continue
                pairs.append((parts[0], parts[1].lstrip("@")))
        return pairs
    if len(args.pairs) % 2 != 0:
        sys.exit("Arguments must be <url> <handle> pairs -- got an odd number.")
    return [(args.pairs[i], args.pairs[i + 1].lstrip("@"))
            for i in range(0, len(args.pairs), 2)]


def main():
    ap = argparse.ArgumentParser(
        description="Download, verify, compress and register creator demo reels.")
    ap.add_argument("pairs", nargs="*", metavar="URL HANDLE")
    ap.add_argument("--file", help='file of "<url> <handle>" lines')
    ap.add_argument("--check", action="store_true", help="list creators with no video")
    ap.add_argument("--force", action="store_true", help="install despite a handle mismatch")
    ap.add_argument("--overwrite", action="store_true", help="replace an existing video")
    ap.add_argument("--keep-temp", action="store_true", help="keep the raw download")
    args = ap.parse_args()

    if args.check:
        return cmd_check()
    if not args.pairs and not args.file:
        ap.print_help()
        return 1
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is not on PATH -- install it and retry.")

    os.makedirs(VIDEO_DIR, exist_ok=True)
    os.makedirs(COVER_DIR, exist_ok=True)

    pairs = parse_pairs(args)
    data = load_creators()
    existing = {f[:-4].lower() for f in os.listdir(VIDEO_DIR) if f.endswith(".mp4")}

    print(f"Processing {len(pairs)} reel(s)\n")
    added = sum(process(u, h, args, data, existing) for u, h in pairs)

    if added:
        save_creators(data)
    print(f"\n{added} added, {len(pairs) - added} skipped or failed.")
    if added:
        print("creators.json updated. Review with `git diff`, then commit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
