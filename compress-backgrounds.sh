#!/bin/bash
# Build the theme backgrounds into web-app/public/themes/<theme>/ .
# Run on your Mac (fast, hardware-accelerated). Requires ffmpeg:  brew install ffmpeg
#
# Theme ids match the wallpaper names used in the app (Appearance → Theme).
# Video themes → looping .mp4 (~1080p, 24 fps, ~24s, no audio, web-optimized).
# Image themes → downscaled .jpg. Every theme also gets a small thumb.jpg for the
# theme picker. Sources are bt709 (not HDR), so plain 8-bit conversion is correct.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
T="$ROOT/Themes"
O="$ROOT/web-app/public/themes"
START=6; LEN=14; CRF=23   # clip start (s), forward length (s), quality (lower = better/bigger)

# Boomerang loop: forward clip + its reverse, so the last frame == the first frame
# and the video loops seamlessly (no snap/blur when it restarts). Final length is
# ~2×LEN. The reverse filter buffers frames in RAM — fine on a Mac; keep LEN modest.
vid () { # src  out.mp4
  mkdir -p "$(dirname "$2")"; echo "→ $2 (seamless ping-pong)"
  ffmpeg -y -hwaccel videotoolbox -ss "$START" -t "$LEN" -i "$1" -an \
    -filter_complex "[0:v]scale=1920:-2,fps=24,format=yuv420p,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[out]" \
    -map "[out]" -c:v libx264 -preset slow -crf "$CRF" -movflags +faststart "$2"
}
img () { # src  out.jpg  [width=1920]
  mkdir -p "$(dirname "$2")"; echo "→ $2"
  ffmpeg -y -i "$1" -vf "scale=${3:-1920}:-2" -q:v 3 -frames:v 1 "$2"
}
thumb () { img "$1" "$(dirname "$2")/thumb.jpg" 520; }  # picker preview

# --- video themes ---
vid "$T/Tahoe/Tahoe Morning.mov"                              "$O/tahoe/day.mp4"
vid "$T/Tahoe/Tahoe Night.mov"                                "$O/tahoe/night.mp4"
vid "$T/Goa Beaches/B13D40FC-C033-436D-A197-185900EC3552.mov" "$O/goa-beaches/still.mp4"
vid "$T/Goa Cost/8A51AAE4-6ED6-432B-A222-4081D1F29D24.mov"    "$O/goa-coast/still.mp4"
vid "$T/Sequoia/97C3047F-ED39-472C-9778-CABF25D8682D.mov"     "$O/sequoia/still.mp4"
vid "$T/Tea Gardens/Morning.mov"                              "$O/tea-gardens/day.mp4"
vid "$T/Tea Gardens/Mist.mov"                                 "$O/tea-gardens/night.mp4"

# --- image themes (stills — no video version, which is fine) ---
img "$T/Ganges/B6461ECC-44F5-4BC9-877F-484A605D0D10.mov"      "$O/ganges/still.jpg"
img "$T/Golden Gate/Golden Gate Morning.jpg"                  "$O/golden-gate/day.jpg"
img "$T/Golden Gate/479305.jpg"                               "$O/golden-gate/night.jpg"

# --- picker thumbnails (one per theme) ---
thumb "$O/tahoe/day.mp4"        "$O/tahoe/x"
thumb "$O/goa-beaches/still.mp4" "$O/goa-beaches/x"
thumb "$O/goa-coast/still.mp4"   "$O/goa-coast/x"
thumb "$O/sequoia/still.mp4"     "$O/sequoia/x"
thumb "$O/tea-gardens/day.mp4"   "$O/tea-gardens/x"
thumb "$O/ganges/still.jpg"      "$O/ganges/x"
thumb "$O/golden-gate/day.jpg"   "$O/golden-gate/x"

echo "Done."; find "$O" -type f | sort
