"""Recorta os concept sheets de bioma em props 64x64 transparentes."""
from pathlib import Path
import sys
from PIL import Image
from collections import deque


NAMES = {
    "desert": ["saguaro", "barrel_cactus", "straw_bundle", "sun_bleached_skull"],
    "forest": ["broadleaf_tree", "leafy_bush", "mossy_log", "fern_flowers"],
}


def build(sheet_path: Path, biome: str, output_root: Path) -> None:
    sheet = Image.open(sheet_path).convert("RGBA")
    # O fundo gerado não é um magenta perfeitamente uniforme. Remove todas as
    # variações claramente dominadas por vermelho+azul sem atingir flores rosas.
    pixels = sheet.load()
    for y in range(sheet.height):
        for x in range(sheet.width):
            r, g, b, a = pixels[x, y]
            is_bright_key = r > 170 and b > 145 and g < 105 and r + b > 365
            is_forest_fringe = (
                biome == "forest" and r > g * 1.25 and b > g * 1.25 and r + b > 100
            )
            if a and (is_bright_key or is_forest_fringe):
                pixels[x, y] = (0, 0, 0, 0)
    width, height = sheet.size
    boxes = [
        (0, 0, width // 2, height // 2),
        (width // 2, 0, width, height // 2),
        (0, height // 2, width // 2, height),
        (width // 2, height // 2, width, height),
    ]
    target = output_root / biome
    target.mkdir(parents=True, exist_ok=True)

    for name, box in zip(NAMES[biome], boxes):
        prop = sheet.crop(box)
        alpha = prop.getchannel("A")
        bbox = alpha.getbbox()
        if bbox is None:
            raise RuntimeError(f"{name}: quadrante vazio")
        prop = prop.crop(bbox)
        max_width = 58
        max_height = 60 if name in {"saguaro", "broadleaf_tree"} else 54
        scale = min(max_width / prop.width, max_height / prop.height)
        size = (max(1, round(prop.width * scale)), max(1, round(prop.height * scale)))
        prop = prop.resize(size, Image.Resampling.NEAREST)
        frame = Image.new("RGBA", (64, 64))
        x = (64 - prop.width) // 2
        y = 62 - prop.height
        frame.alpha_composite(prop, (x, y))
        frame.save(target / f"{name}.png")

    if biome == "forest":
        make_tree_sway(target / "broadleaf_tree.png", target / "broadleaf_tree_sway.png")


def make_prop_sway(
    source_path: Path,
    output_path: Path,
    max_width: int = 154,
    max_height: int = 166,
    sway: int = 4,
) -> None:
    """Converte a árvore 64x64 em quatro frames 192x192, com o pé imóvel."""
    source = Image.open(source_path).convert("RGBA")
    pixels = source.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = pixels[x, y]
            if a and r > g * 1.22 and b > g * 1.22 and r + b > 110:
                pixels[x, y] = (0, 0, 0, 0)
    bbox = source.getchannel("A").getbbox()
    tree = source.crop(bbox)
    scale = min(max_width / tree.width, max_height / tree.height)
    tree = tree.resize(
        (round(tree.width * scale), round(tree.height * scale)),
        Image.Resampling.NEAREST,
    )
    frames = []
    # A copa oscila; o deslocamento decai linearmente até zero na base do tronco.
    for amplitude in (-sway, -1, sway, 1):
        frame = Image.new("RGBA", (192, 192))
        for row in range(tree.height):
            factor = 1 - row / max(1, tree.height - 1)
            shift = round(amplitude * factor)
            strip = tree.crop((0, row, tree.width, row + 1))
            x = (192 - tree.width) // 2 + shift
            y = 188 - tree.height + row
            frame.alpha_composite(strip, (x, y))
        frames.append(polish_tree_frame(frame))
    sheet = Image.new("RGBA", (192 * len(frames), 192))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * 192, 0))
    sheet.save(output_path)


def make_tree_sway(source_path: Path, output_path: Path) -> None:
    make_prop_sway(source_path, output_path)


def polish_tree_frame(frame: Image.Image) -> Image.Image:
    """Fecha furos internos e adiciona o contorno fino usado pelos pinheiros."""
    frame = frame.convert("RGBA")
    width, height = frame.size
    px = frame.load()

    # Alpha binário evita o pontilhado semitransparente deixado pelo chroma.
    opaque = [[px[x, y][3] >= 96 for x in range(width)] for y in range(height)]

    # Marca todo transparente conectado à borda; o restante são furos internos.
    outside = [[False] * width for _ in range(height)]
    queue = deque()
    for x in range(width):
        queue.extend([(x, 0), (x, height - 1)])
    for y in range(height):
        queue.extend([(0, y), (width - 1, y)])
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height or outside[y][x] or opaque[y][x]:
            continue
        outside[y][x] = True
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    holes = {(x, y) for y in range(height) for x in range(width)
             if not opaque[y][x] and not outside[y][x]}
    # Propaga a cor do vizinho opaco mais próximo para dentro de cada furo.
    while holes:
        filled = []
        for x, y in holes:
            neighbours = [
                px[nx, ny] for nx, ny in (
                    (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1),
                    (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1), (x + 1, y + 1),
                )
                if 0 <= nx < width and 0 <= ny < height and px[nx, ny][3] >= 96
            ]
            if neighbours:
                r = sum(c[0] for c in neighbours) // len(neighbours)
                g = sum(c[1] for c in neighbours) // len(neighbours)
                b = sum(c[2] for c in neighbours) // len(neighbours)
                px[x, y] = (r, g, b, 255)
                opaque[y][x] = True
                filled.append((x, y))
        if not filled:
            break
        holes.difference_update(filled)

    # Consolida o restante do alpha antes de construir a borda.
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if opaque[y][x] else 0)

    mask = frame.getchannel("A")
    # Pillow expõe os filtros pelo módulo ImageFilter.
    from PIL import ImageFilter
    expanded = mask.filter(ImageFilter.MaxFilter(3))
    outline_alpha = expanded.point(lambda value: 255 if value else 0)
    # Retira a área ocupada pela própria árvore, deixando somente o anel externo.
    outline_px = outline_alpha.load()
    mask_px = mask.load()
    for y in range(height):
        for x in range(width):
            if mask_px[x, y]:
                outline_px[x, y] = 0
    # #161c2e é o tom de contorno predominante em tree_campo.png.
    outline = Image.new("RGBA", frame.size, (22, 28, 46, 0))
    outline.putalpha(outline_alpha)
    outline.alpha_composite(frame)
    return outline


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "tree-sway":
        make_tree_sway(Path(sys.argv[2]), Path(sys.argv[3]))
    elif len(sys.argv) == 7 and sys.argv[1] == "prop-sway":
        make_prop_sway(
            Path(sys.argv[2]),
            Path(sys.argv[3]),
            int(sys.argv[4]),
            int(sys.argv[5]),
            int(sys.argv[6]),
        )
    elif len(sys.argv) == 4:
        build(Path(sys.argv[2]), sys.argv[1], Path(sys.argv[3]))
    else:
        raise SystemExit(
            "uso: build_biome_props.py <desert|forest> <sheet.png> <output-root>\n"
            "  ou: build_biome_props.py tree-sway <tree.png> <output.png>"
        )
