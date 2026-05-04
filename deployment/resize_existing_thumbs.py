from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    print('Pillow is required. Install it with: pip install Pillow')
    raise SystemExit(1)


FULL_DIR = Path('public') / 'assets' / 'gallery' / 'full'
THUMB_DIR = Path('public') / 'assets' / 'gallery' / 'thumb'

THUMB_BOUNDS_LANDSCAPE = (640, 360)
THUMB_BOUNDS_PORTRAIT = (360, 640)

if hasattr(Image, 'Resampling'):
    RESAMPLE_LANCZOS = Image.Resampling.LANCZOS
else:
    RESAMPLE_LANCZOS = Image.LANCZOS


def fit_inside_bounds(image: Image.Image, bounds: tuple[int, int]) -> Image.Image:
    max_width, max_height = bounds
    if image.width <= max_width and image.height <= max_height:
        return image.copy()

    resized = image.copy()
    resized.thumbnail(bounds, RESAMPLE_LANCZOS)
    return resized


def pick_orientation_bounds(image: Image.Image) -> tuple[int, int]:
    return THUMB_BOUNDS_LANDSCAPE if image.width >= image.height else THUMB_BOUNDS_PORTRAIT


def resize_thumb_from_full(full_path: Path, thumb_path: Path) -> bool:
    with Image.open(full_path) as full_image:
        normalized = ImageOps.exif_transpose(full_image).convert('RGBA')

    thumb_bounds = pick_orientation_bounds(normalized)
    thumb_image = fit_inside_bounds(normalized, thumb_bounds)

    thumb_path.parent.mkdir(parents=True, exist_ok=True)
    thumb_image.save(thumb_path, format='WEBP', quality=90, method=6)

    normalized.close()
    thumb_image.close()
    return True


def main():
    if not FULL_DIR.exists():
        print(f'Missing directory: {FULL_DIR}')
        raise SystemExit(1)

    THUMB_DIR.mkdir(parents=True, exist_ok=True)

    resized_count = 0
    skipped_count = 0

    for full_path in sorted(FULL_DIR.glob('*.webp')):
        thumb_path = THUMB_DIR / full_path.name
        if resize_thumb_from_full(full_path, thumb_path):
            resized_count += 1
        else:
            skipped_count += 1

    print(f'Thumbnails resized: {resized_count}')
    print(f'Thumbnails skipped: {skipped_count}')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Thumbnail resize failed: {exc}')
        raise SystemExit(1)
