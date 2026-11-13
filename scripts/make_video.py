"""Burn Chinese captions into the recorded demo.

    python scripts/make_video.py video/raw.webm video/mo-tong-demo.mp4

Captions are rendered with Pillow (full control of the CJK typography) and
composited by ffmpeg with time windows, so no font handling happens in ffmpeg.
"""
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"

# (start, end, text) — tuned against the recording produced by scripts/record.mjs
CAPTIONS = [
    (0.6, 3.7, "墨童 · 一个会学你的小妖怪"),
    (5.4, 10.9, "一笔：连起所有朱砂，收在印上"),
    (11.3, 13.9, "结算：它开始记住你这一笔"),
    (14.4, 17.2, "墨渍挡笔，笔路可以回撤"),
    (17.6, 21.9, "每关墨量有限，绕远要付代价"),
    (22.5, 27.6, "第四关：墨影先走一步——它学的是你上一笔"),
    (27.8, 32.6, "你爱绕远它就绕，你爱贴边它就贴着墨渍走"),
    (33.0, 38.2, "第五关起，它抢得越来越准"),
    (38.6, 46.4, "第六关：故意反着画，看它跟不跟"),
    (47.0, 54.4, "终局对影：这一局，跟自己的习惯比"),
    (55.2, 60.0, "收卷：你这一局的每一笔，都在画里"),
]


def caption_png(text: str, out: Path) -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # a soft ink band at the bottom so white text always reads
    band = Image.new("RGBA", (W, 190), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for y in range(190):
        a = int(132 * (y / 190) ** 1.5)
        bd.line([(0, y), (W, y)], fill=(12, 10, 8, a))
    img.alpha_composite(band, (0, H - 190))

    size = 30
    font = ImageFont.truetype(FONT, size)
    while draw.textlength(text, font=font) > W - 120 and size > 18:
        size -= 2
        font = ImageFont.truetype(FONT, size)

    tw = draw.textlength(text, font=font)
    x = (W - tw) / 2
    y = H - 96
    # a soft shadow keeps the text off the paper texture
    draw.text((x + 1.5, y + 2), text, font=font, fill=(0, 0, 0, 140))
    draw.text((x, y), text, font=font, fill=(250, 245, 233, 245))
    img.save(out)


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "video/raw.webm")
    dst = Path(sys.argv[2] if len(sys.argv) > 2 else "video/mo-tong-demo.mp4")
    caps_dir = Path("video/captions")
    caps_dir.mkdir(parents=True, exist_ok=True)

    inputs = ["-i", str(src)]
    filters = []
    for i, (start, end, text) in enumerate(CAPTIONS):
        png = caps_dir / f"cap{i:02d}.png"
        caption_png(text, png)
        inputs += ["-i", str(png)]
        filters.append(f"[{i + 1}:v]setpts=PTS-STARTPTS[c{i}]")
    # chain overlays
    last = "[0:v]"
    for i, (start, end, _) in enumerate(CAPTIONS):
        out = f"[v{i}]" if i < len(CAPTIONS) - 1 else "[vout]"
        filters.append(f"{last}[c{i}]overlay=0:0:enable='between(t,{start},{end})'{out}")
        last = out

    ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
    audio = Path("video/score.wav")
    cmd = [ffmpeg, "-y", *inputs]
    if audio.exists():
        cmd += ["-i", str(audio)]
    cmd += ["-filter_complex", ";".join(filters), "-map", "[vout]"]
    if audio.exists():
        cmd += [
            "-map", f"{len(CAPTIONS) + 1}:a",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000",
            "-c:a", "aac", "-b:a", "160k", "-shortest",
        ]
    cmd += [
        "-c:v", "libx264", "-preset", "slow", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(dst),
    ]
    print(" ".join(cmd[:6]), "...")
    subprocess.run(cmd, check=True)
    print(f"wrote {dst}")


if __name__ == "__main__":
    main()
