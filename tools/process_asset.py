import argparse
import base64
from collections import deque
from pathlib import Path

from PIL import Image


def parse_size(value):
    try:
        width_text, height_text = value.lower().split("x", 1)
        return int(width_text), int(height_text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("size must use WIDTHxHEIGHT, for example 88x112") from exc


def white_distance(pixel):
    red, green, blue, _alpha = pixel
    return max(abs(255 - red), abs(255 - green), abs(255 - blue))


def is_white_like(pixel, tolerance, brightness):
    red, green, blue, _alpha = pixel
    return white_distance(pixel) <= tolerance or min(red, green, blue) >= brightness


def remove_white(image, tolerance, brightness, edge_only):
    source = image.convert("RGBA")
    pixels = source.load()
    width, height = source.size

    if not edge_only:
        for y in range(height):
            for x in range(width):
                pixel = pixels[x, y]
                if pixel[3] == 0 or is_white_like(pixel, tolerance, brightness):
                    pixels[x, y] = (pixel[0], pixel[1], pixel[2], 0)
                else:
                    pixels[x, y] = (pixel[0], pixel[1], pixel[2], 255)
        return source

    visited = set()
    queue = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= width or y >= height:
            continue
        visited.add((x, y))
        if not is_white_like(pixels[x, y], tolerance, brightness):
            continue
        pixel = pixels[x, y]
        pixels[x, y] = (pixel[0], pixel[1], pixel[2], 0)
        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            if pixel[3] > 0:
                pixels[x, y] = (pixel[0], pixel[1], pixel[2], 255)
    return source


def hard_alpha(image, threshold):
    source = image.convert("RGBA")
    pixels = source.load()
    width, height = source.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            pixels[x, y] = (red, green, blue, 255 if alpha >= threshold else 0)
    return source


def erode_alpha(image, radius):
    if radius <= 0:
        return image

    source = image.convert("RGBA")
    pixels = source.load()
    width, height = source.size
    transparent = set()

    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] == 0:
                continue
            should_remove = False
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    nx = x + dx
                    ny = y + dy
                    if nx < 0 or ny < 0 or nx >= width or ny >= height or pixels[nx, ny][3] == 0:
                        should_remove = True
                        break
                if should_remove:
                    break
            if should_remove:
                transparent.add((x, y))

    for x, y in transparent:
        red, green, blue, _alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
    return source


def trim_alpha(image, padding):
    bbox = image.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def fit_box(image, size):
    target_width, target_height = size
    source = image.convert("RGBA")
    ratio = min(target_width / source.width, target_height / source.height)
    new_width = max(1, round(source.width * ratio))
    new_height = max(1, round(source.height * ratio))
    resized = source.resize((new_width, new_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((target_width - new_width) // 2, target_height - new_height))
    return canvas


def resize_by_height(image, height):
    width = max(1, round(height * (image.width / image.height)))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def write_data_js(image_path, data_js_path, data_kind, data_key):
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    data_uri = f"data:image/png;base64,{encoded}"

    if data_kind == "player":
        content = f"window.PlayerRoleSprite = {{ dataUri: '{data_uri}' }};\n"
    elif data_kind == "monster":
        if not data_key:
            raise ValueError("--data-key is required for monster data")
        content = (
            "window.MonsterSprites = window.MonsterSprites || {};\n"
            f"window.MonsterSprites.{data_key} = {{ dataUri: '{data_uri}' }};\n"
        )
    elif data_kind == "background":
        if not data_key:
            raise ValueError("--data-key is required for background data")
        content = (
            "window.RoomBackgroundSprites = window.RoomBackgroundSprites || {};\n"
            f"window.RoomBackgroundSprites.{data_key} = {{ dataUri: '{data_uri}' }};\n"
        )
    else:
        raise ValueError(f"unknown data kind: {data_kind}")

    data_js_path.write_text(content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Process game image assets into clean PNG and optional data URI JS.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mode", choices=["none", "white", "edge-white", "alpha-hard"], default="white")
    parser.add_argument("--white-tolerance", type=int, default=38)
    parser.add_argument("--brightness", type=int, default=200)
    parser.add_argument("--alpha-threshold", type=int, default=200)
    parser.add_argument("--erode", type=int, default=0)
    parser.add_argument("--trim-alpha", action="store_true")
    parser.add_argument("--trim-padding", type=int, default=0)
    parser.add_argument("--fit-box", type=parse_size)
    parser.add_argument("--height", type=int)
    parser.add_argument("--data-js", type=Path)
    parser.add_argument("--data-kind", choices=["player", "monster", "background"])
    parser.add_argument("--data-key")
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    if args.mode == "white":
        image = remove_white(image, args.white_tolerance, args.brightness, edge_only=False)
    elif args.mode == "edge-white":
        image = remove_white(image, args.white_tolerance, args.brightness, edge_only=True)
    elif args.mode == "alpha-hard":
        image = hard_alpha(image, args.alpha_threshold)

    image = erode_alpha(image, args.erode)
    if args.trim_alpha:
        image = trim_alpha(image, args.trim_padding)
    if args.fit_box:
        image = fit_box(image, args.fit_box)
    if args.height:
        image = resize_by_height(image, args.height)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output)

    if args.data_js:
        if not args.data_kind:
            raise ValueError("--data-kind is required when --data-js is used")
        args.data_js.parent.mkdir(parents=True, exist_ok=True)
        write_data_js(args.output, args.data_js, args.data_kind, args.data_key)


if __name__ == "__main__":
    main()
