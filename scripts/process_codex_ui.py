#!/usr/bin/env python3
"""Prepare the A.I.U.I.Codex chroma-key source as native game UI assets.

The generated plate is authored at roughly 4x its intended display size. This
script downsamples it with nearest-neighbor filtering, detects the deliberately
isolated components from their alpha bounds, and exports stable, named PNGs.
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/ui_codex_src/ui-kit-codex-alpha-full.png"
HP_SOURCE = ROOT / "assets/ui_codex_src/hp-kit-codex-alpha-full.png"
OUTPUT = ROOT / "public/assets/64/ui/codex"
SCALE = 4
HP_SCALE = 5
PADDING = 2


def connected_bounds(mask: Image.Image) -> list[tuple[int, int, int, int]]:
    """Return component bounds after a small detection-only dilation."""
    detection = mask.filter(ImageFilter.MaxFilter(5))
    width, height = detection.size
    pixels = detection.load()
    seen = bytearray(width * height)
    bounds: list[tuple[int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index] or pixels[x, y] == 0:
                continue
            queue = deque([(x, y)])
            seen[index] = 1
            min_x = max_x = x
            min_y = max_y = y
            area = 0
            while queue:
                cx, cy = queue.popleft()
                area += 1
                min_x, max_x = min(min_x, cx), max(max_x, cx)
                min_y, max_y = min(min_y, cy), max(max_y, cy)
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    ni = ny * width + nx
                    if seen[ni] or pixels[nx, ny] == 0:
                        continue
                    seen[ni] = 1
                    queue.append((nx, ny))
            if area >= 80:
                bounds.append((max(0, min_x + 2), max(0, min_y + 2), min(width, max_x - 1), min(height, max_y - 1)))
    return sorted(bounds, key=lambda box: (box[1], box[0]))


def classify(boxes: list[tuple[int, int, int, int]], size: tuple[int, int]) -> dict[str, tuple[int, int, int, int]]:
    width, height = size
    named: dict[str, tuple[int, int, int, int]] = {}
    slots: list[tuple[int, int, int, int]] = []
    buttons: list[tuple[int, int, int, int]] = []

    for box in boxes:
        left, top, right, bottom = box
        cx, cy = (left + right) / 2, (top + bottom) / 2
        bw, bh = right - left, bottom - top
        if cy < height * 0.38 and cx < width * 0.25:
            named["portrait-frame"] = box
        elif cy < height * 0.31 and bw > width * 0.5:
            named["hp-frame"] = box
        elif cy < height * 0.45 and bw > width * 0.5:
            named["hp-fill"] = box
        elif cx < width * 0.45 and cy > height * 0.45:
            named["panel"] = box
        elif cy < height * 0.72:
            slots.append(box)
        else:
            buttons.append(box)

    slots.sort(key=lambda box: box[0])
    buttons.sort(key=lambda box: box[0])
    for name, box in zip(("slot-neutral", "slot-selected", "slot-disabled"), slots, strict=True):
        named[name] = box
    for name, box in zip(("button-neutral", "button-selected", "button-disabled"), buttons, strict=True):
        named[name] = box

    expected = {
        "portrait-frame", "hp-frame", "hp-fill", "panel",
        "slot-neutral", "slot-selected", "slot-disabled",
        "button-neutral", "button-selected", "button-disabled",
    }
    if set(named) != expected:
        missing = sorted(expected - set(named))
        raise RuntimeError(f"Could not classify generated UI components; missing: {missing}; boxes={boxes}")
    return named


def padded_crop(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = box
    crop_box = (
        max(0, left - PADDING),
        max(0, top - PADDING),
        min(image.width, right + PADDING),
        min(image.height, bottom + PADDING),
    )
    return image.crop(crop_box)


def native_plate(path: Path, scale: int) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    cropped = source.crop((0, 0, source.width - source.width % scale, source.height - source.height % scale))
    return cropped.resize((cropped.width // scale, cropped.height // scale), Image.Resampling.NEAREST)


def hp_images() -> tuple[dict[str, Image.Image], dict[str, tuple[int, int, int, int]]]:
    native = native_plate(HP_SOURCE, HP_SCALE)
    boxes = connected_bounds(native.getchannel("A"))
    if len(boxes) != 3:
        raise RuntimeError(f"Expected 3 modular HP components, detected {len(boxes)}: {boxes}")
    boxes.sort(key=lambda box: box[1])
    names = ("hp-frame", "hp-track", "hp-fill")
    named_boxes = dict(zip(names, boxes, strict=True))
    images = {name: padded_crop(native, box) for name, box in named_boxes.items()}
    normalize_group(images, ("hp-track", "hp-fill"))
    return images, named_boxes


def normalize_group(images: dict[str, Image.Image], names: tuple[str, ...]) -> None:
    target_w = max(images[name].width for name in names)
    target_h = max(images[name].height for name in names)
    for name in names:
        source = images[name]
        canvas = Image.new("RGBA", (target_w, target_h))
        canvas.alpha_composite(source, ((target_w - source.width) // 2, (target_h - source.height) // 2))
        images[name] = canvas


def frame_opening(frame: Image.Image) -> tuple[int, int, int, int]:
    """Measure the hollow center from the alpha runs through the frame midpoint."""
    alpha = frame.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("HP frame has no visible pixels")
    left, top, right, bottom = bbox
    mid_x, mid_y = (left + right) // 2, (top + bottom) // 2

    row = [alpha.getpixel((x, mid_y)) > 0 for x in range(left, right)]
    col = [alpha.getpixel((mid_x, y)) > 0 for y in range(top, bottom)]
    inner_left = left + next(i for i, opaque in enumerate(row) if not opaque)
    inner_right = left + len(row) - next(i for i, opaque in enumerate(reversed(row)) if not opaque)
    inner_top = top + next(i for i, opaque in enumerate(col) if not opaque)
    inner_bottom = top + len(col) - next(i for i, opaque in enumerate(reversed(col)) if not opaque)
    return inner_left, inner_top, inner_right - inner_left, inner_bottom - inner_top


def center_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    if image.width < width or image.height < height:
        raise RuntimeError(f"Cannot crop {image.size} to larger target {size}")
    left = (image.width - width) // 2
    top = (image.height - height) // 2
    return image.crop((left, top, left + width, top + height))


def remove_key_fringe(image: Image.Image) -> Image.Image:
    """Remove rare bright magenta key remnants without touching dark UI purple."""
    cleaned = image.copy()
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha and red > 170 and blue > 170 and green < 30 and abs(red - blue) < 40:
                pixels[x, y] = (red, green, blue, 0)
    return cleaned


def main() -> None:
    native = native_plate(SOURCE, SCALE)
    boxes = connected_bounds(native.getchannel("A"))
    named_boxes = classify(boxes, native.size)
    images = {name: padded_crop(native, box) for name, box in named_boxes.items()}
    # The first plate established the control language; the second plate replaces
    # its non-modular HP concept with a hollow frame, track and fill.
    images.pop("hp-frame")
    images.pop("hp-fill")
    named_boxes.pop("hp-frame")
    named_boxes.pop("hp-fill")
    modular_hp, modular_hp_boxes = hp_images()
    images.update(modular_hp)
    named_boxes.update(modular_hp_boxes)
    hp_inset = frame_opening(images["hp-frame"])
    images["hp-track"] = center_crop(images["hp-track"], hp_inset[2:])
    images["hp-fill"] = center_crop(images["hp-fill"], hp_inset[2:])
    normalize_group(images, ("slot-neutral", "slot-selected", "slot-disabled"))
    normalize_group(images, ("button-neutral", "button-selected", "button-disabled"))
    images = {name: remove_key_fringe(image) for name, image in images.items()}

    OUTPUT.mkdir(parents=True, exist_ok=True)
    contact = Image.new("RGBA", (414, 250))
    contact.alpha_composite(images["portrait-frame"], (18, 18))
    contact.alpha_composite(images["hp-frame"], (95, 15))
    contact.alpha_composite(images["hp-track"], (95, 60))
    contact.alpha_composite(images["hp-fill"], (95, 90))
    contact.alpha_composite(images["panel"], (18, 130))
    for index, name in enumerate(("slot-neutral", "slot-selected", "slot-disabled")):
        contact.alpha_composite(images[name], (196 + index * 68, 128))
    for index, name in enumerate(("button-neutral", "button-selected", "button-disabled")):
        contact.alpha_composite(images[name], (201 + index * 68, 196))
    contact.save(OUTPUT / "ui-kit-codex-alpha.png", optimize=True)
    chroma = Image.new("RGB", contact.size, (255, 0, 255))
    chroma.paste(contact.convert("RGB"), mask=contact.getchannel("A"))
    chroma.save(OUTPUT / "ui-kit-codex-chroma.png", optimize=True)
    manifest = {
        "sources": [
            "assets/ui_codex_src/ui-kit-codex-chroma.png",
            "assets/ui_codex_src/hp-kit-codex-chroma.png",
        ],
        "scaleFactors": {"controls": SCALE, "hp": HP_SCALE},
        "pixelArt": True,
        "hpFrameInset": {
            "x": hp_inset[0],
            "y": hp_inset[1],
            "width": hp_inset[2],
            "height": hp_inset[3],
        },
        "assets": {},
    }
    for name, image in sorted(images.items()):
        filename = f"{name}.png"
        image.save(OUTPUT / filename, optimize=True)
        manifest["assets"][name] = {
            "file": filename,
            "width": image.width,
            "height": image.height,
            "sourceBoundsNative": list(named_boxes[name]),
        }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(images)} assets to {OUTPUT}")
    for name in sorted(images):
        print(f"  {name}: {images[name].width}x{images[name].height}")


if __name__ == "__main__":
    main()
