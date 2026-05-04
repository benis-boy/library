import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

try:
    from PIL import Image, ImageOps
except ImportError:
    print('Pillow is required. Install it with: pip install Pillow')
    raise SystemExit(1)


FULL_BOUNDS_LANDSCAPE = (1920, 1080)
FULL_BOUNDS_PORTRAIT = (1080, 1920)
THUMB_BOUNDS_LANDSCAPE = (640, 360)
THUMB_BOUNDS_PORTRAIT = (360, 640)
ID_LENGTH = 8
ENTRY_ADDED_FIELD = 'entryAddedAt'
TAG_TRANSLATIONS_FIELD = 'tagTranslations'
EPOCH_UTC = datetime(1970, 1, 1, tzinfo=timezone.utc)
TAG_VALUE_PATTERN = re.compile(r'^[a-z0-9][a-z0-9_-]*$')
ALLOWED_PREFIXES = ('c:', 's:', 'a:')
SOURCE_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg'}
OPENCODE_EXECUTABLE = 'opencode'
LLM_TRANSLATION_MODEL = 'github-copilot/gpt-5.2'
LLM_TRANSLATION_VARIANT = 'high'
LLM_TRANSLATION_TIMEOUT_SECONDS = 180


def parse_cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate gallery assets and manifest metadata.')
    parser.add_argument(
        '--retranslate-tags',
        action='store_true',
        help='Regenerate all in-use tag translations through the configured LLM model.',
    )
    return parser.parse_args()


def resolve_opencode_executable() -> Optional[str]:
    explicit = os.environ.get('OPENCODE_BIN')
    if explicit:
        return explicit

    candidates: list[str]
    if os.name == 'nt':
        candidates = ['opencode.cmd', 'opencode.exe', 'opencode']
    else:
        candidates = [OPENCODE_EXECUTABLE]

    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    return None

GALLERY_ROOT = Path('public') / 'assets' / 'gallery'
FULL_DIR = GALLERY_ROOT / 'full'
THUMB_DIR = GALLERY_ROOT / 'thumb'
GALLERY_JSON_PATH = GALLERY_ROOT / 'gallery.json'
PUBLIC_ROOT = Path('public')

if hasattr(Image, 'Resampling'):
    RESAMPLE_LANCZOS = Image.Resampling.LANCZOS
else:
    RESAMPLE_LANCZOS = Image.LANCZOS


def load_existing_gallery(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {'version': 1, 'images': []}

    with path.open('r', encoding='utf-8') as f:
        payload = json.load(f)

    if not isinstance(payload, dict):
        raise ValueError(f'Invalid gallery payload in {path}: expected object')

    images = payload.get('images')
    if not isinstance(images, list):
        payload['images'] = []

    if not isinstance(payload.get('version'), int):
        payload['version'] = 1

    return payload


def write_gallery(path: Path, payload: dict[str, Any]):
    with path.open('w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write('\n')


def format_utc_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def parse_utc_timestamp(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None

    normalized = value.strip()
    if normalized.endswith('Z'):
        normalized = normalized[:-1] + '+00:00'

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def normalize_single_tag(raw_tag: Any) -> Optional[str]:
    if not isinstance(raw_tag, str):
        return None

    tag = raw_tag.strip().lower()
    if not tag:
        return None

    value_to_validate = tag
    if tag.startswith(ALLOWED_PREFIXES):
        value_to_validate = tag[2:]

    if not value_to_validate or not TAG_VALUE_PATTERN.fullmatch(value_to_validate):
        return None

    return tag


def normalize_tags(raw_tags: Any) -> list[str]:
    if not isinstance(raw_tags, list):
        return []

    normalized: list[str] = []
    seen: set[str] = set()

    for raw_tag in raw_tags:
        tag = normalize_single_tag(raw_tag)
        if not tag or tag in seen:
            continue

        seen.add(tag)
        normalized.append(tag)

    return normalized


def normalize_tag_translations(raw_translations: Any) -> dict[str, str]:
    if not isinstance(raw_translations, dict):
        return {}

    normalized: dict[str, str] = {}
    for raw_tag, raw_label in raw_translations.items():
        tag = normalize_single_tag(raw_tag)
        if not tag:
            continue

        if not isinstance(raw_label, str):
            continue

        label = raw_label.strip()
        if not label:
            continue

        normalized[tag] = label

    return normalized


def humanize_slug(value: str) -> str:
    if not value:
        return value

    words = [word for word in re.split(r'[_-]+', value) if word]
    if not words:
        return value

    titled_words: list[str] = []
    for word in words:
        if not word:
            continue
        titled_words.append(word[0].upper() + word[1:])

    return ' '.join(titled_words)


def fallback_tag_translation(tag: str) -> str:
    if tag.startswith(ALLOWED_PREFIXES):
        return humanize_slug(tag[2:])

    return humanize_slug(tag)


def extract_json_from_text(text: str) -> Optional[dict[str, Any]]:
    candidate = text.strip()
    if not candidate:
        return None

    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = candidate.find('{')
    end = candidate.rfind('}')
    if start < 0 or end <= start:
        return None

    try:
        parsed = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, dict) else None


def parse_opencode_json_output(stdout: str) -> str:
    text_parts: list[str] = []

    for raw_line in stdout.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        if not isinstance(event, dict) or event.get('type') != 'text':
            continue

        part = event.get('part')
        if not isinstance(part, dict):
            continue

        text = part.get('text')
        if isinstance(text, str) and text.strip():
            text_parts.append(text)

    return ''.join(text_parts).strip()


def request_tag_translations_from_llm(tags: list[str]) -> dict[str, str]:
    if not tags:
        return {}

    opencode_bin = resolve_opencode_executable()
    if not opencode_bin:
        print('LLM translation skipped: opencode binary not found on PATH.')
        return {}

    prompt = (
        'Translate gallery tag keys into concise, user-facing English labels. '\
        'Return exactly one JSON object and no extra text. '\
        'Rules: keep all input keys unchanged; every key must be present exactly once; '\
        'values are the English labels; remove c:/s:/a: semantics from labels; '\
        'use proper names and casing; preserve intended mixed/camel case for known handles. '\
        'Examples that must be followed exactly: '\
        '{"s:pokemon":"Pokémon","c:lopunny":"Lopunny","a:benisboy14":"BenisBoy14","easter":"Easter Themed"}. '\
        f'Input keys: {json.dumps(tags, ensure_ascii=False)}'
    )

    command = [
        opencode_bin,
        'run',
        '--pure',
        '--format',
        'json',
        '--model',
        LLM_TRANSLATION_MODEL,
        '--variant',
        LLM_TRANSLATION_VARIANT,
        prompt,
    ]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=LLM_TRANSLATION_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError:
        print(f'LLM translation skipped: {opencode_bin} not found on PATH.')
        return {}
    except subprocess.TimeoutExpired:
        print('LLM translation timed out, using fallback translation for missing tags.')
        return {}

    if completed.returncode != 0:
        stderr_text = (completed.stderr or '').strip()
        if stderr_text:
            print(f'LLM translation failed: {stderr_text}')
        else:
            print(f'LLM translation failed with exit code {completed.returncode}.')
        return {}

    raw_text = parse_opencode_json_output(completed.stdout)
    parsed = extract_json_from_text(raw_text)
    if not isinstance(parsed, dict):
        print('LLM translation returned unparsable output, using fallback translation.')
        return {}

    translations: dict[str, str] = {}
    expected_tags = set(tags)
    for raw_tag, raw_label in parsed.items():
        tag = normalize_single_tag(raw_tag)
        if not tag or tag not in expected_tags:
            continue

        if not isinstance(raw_label, str):
            continue

        label = raw_label.strip()
        if not label:
            continue

        translations[tag] = label

    return translations


def tag_sort_group(tag: str) -> int:
    if tag.startswith('a:'):
        return 0
    if tag.startswith('s:'):
        return 1
    if tag.startswith('c:'):
        return 2
    return 3


def build_tag_translations(
    images: list[dict[str, Any]], existing_translations: dict[str, str], force_retranslate: bool
) -> tuple[dict[str, str], int, int, int]:
    collected_tags: set[str] = set()
    for image in images:
        tags = normalize_tags(image.get('tags'))
        image['tags'] = tags
        collected_tags.update(tags)

    if force_retranslate:
        merged_translations: dict[str, str] = {}
        missing_tags = sorted(collected_tags)
    else:
        merged_translations = {
            tag: label for tag, label in existing_translations.items() if tag in collected_tags and isinstance(label, str)
        }
        missing_tags = sorted(tag for tag in collected_tags if tag not in merged_translations)

    llm_translations = request_tag_translations_from_llm(missing_tags)
    llm_generated_count = 0
    fallback_generated_count = 0

    for tag in missing_tags:
        label = llm_translations.get(tag)
        if isinstance(label, str) and label.strip():
            merged_translations[tag] = label.strip()
            llm_generated_count += 1
        else:
            merged_translations[tag] = fallback_tag_translation(tag)
            fallback_generated_count += 1

    ordered_translations: dict[str, str] = {}
    for tag in sorted(merged_translations, key=lambda value: (tag_sort_group(value), value)):
        ordered_translations[tag] = merged_translations[tag]

    return ordered_translations, len(missing_tags), llm_generated_count, fallback_generated_count


def fit_inside_bounds(image: Image.Image, bounds: tuple[int, int]) -> Image.Image:
    max_width, max_height = bounds
    if image.width <= max_width and image.height <= max_height:
        return image.copy()

    resized = image.copy()
    resized.thumbnail(bounds, RESAMPLE_LANCZOS)
    return resized


def pick_orientation_bounds(
    image: Image.Image, landscape_bounds: tuple[int, int], portrait_bounds: tuple[int, int]
) -> tuple[int, int]:
    return landscape_bounds if image.width >= image.height else portrait_bounds


def normalize_image(source_path: Path) -> Image.Image:
    with Image.open(source_path) as source:
        transposed = ImageOps.exif_transpose(source)
        normalized = transposed.convert('RGBA')

    full_bounds = pick_orientation_bounds(normalized, FULL_BOUNDS_LANDSCAPE, FULL_BOUNDS_PORTRAIT)
    return fit_inside_bounds(normalized, full_bounds)


def image_digest(image: Image.Image) -> str:
    digest = hashlib.sha256()
    digest.update(f'{image.mode}|{image.width}x{image.height}'.encode('ascii'))
    digest.update(image.tobytes())
    return digest.hexdigest()


def make_unique_short_id(seed: str, used_ids: set[str]) -> str:
    if not seed:
        raise ValueError('Cannot generate image ID from empty seed')

    candidate = seed[:ID_LENGTH]
    if len(candidate) < ID_LENGTH:
        candidate = hashlib.sha256(seed.encode('utf-8')).hexdigest()[:ID_LENGTH]

    if candidate not in used_ids:
        return candidate

    counter = 1
    while True:
        salted = hashlib.sha256(f'{seed}:{counter}'.encode('utf-8')).hexdigest()[:ID_LENGTH]
        if salted not in used_ids:
            return salted
        counter += 1


def save_webp(image: Image.Image, path: Path):
    image.save(path, format='WEBP', quality=90, method=6)


def build_entry(image_id: str, entry_added_at: Optional[str] = None) -> dict[str, Any]:
    entry = {
        'id': image_id,
        'thumbSrc': f'assets/gallery/thumb/{image_id}.webp',
        'fullSrc': f'assets/gallery/full/{image_id}.webp',
        'tags': [],
    }
    if entry_added_at:
        entry[ENTRY_ADDED_FIELD] = entry_added_at
    return entry


def asset_src_to_path(asset_src: Any) -> Optional[Path]:
    if not isinstance(asset_src, str) or not asset_src:
        return None

    normalized = asset_src.replace('\\', '/').lstrip('/')
    return PUBLIC_ROOT / normalized


def source_exists(asset_src: Any) -> bool:
    path = asset_src_to_path(asset_src)
    return path.exists() if path else False


def migrate_base_entries_to_short_ids(base_images: list[Any]) -> tuple[list[dict[str, Any]], set[str], int]:
    migrated_images: list[dict[str, Any]] = []
    used_ids: set[str] = set()
    remapped_entry_count = 0

    for item in base_images:
        if not isinstance(item, dict):
            continue

        existing_id = item.get('id')
        if not isinstance(existing_id, str) or not existing_id:
            continue

        target_id = existing_id
        if len(existing_id) > ID_LENGTH:
            target_id = make_unique_short_id(existing_id, used_ids)
        elif target_id in used_ids:
            target_id = make_unique_short_id(existing_id, used_ids)

        used_ids.add(target_id)

        entry = dict(item)
        if target_id != existing_id:
            canonical = build_entry(target_id)
            old_full_path = asset_src_to_path(entry.get('fullSrc'))
            old_thumb_path = asset_src_to_path(entry.get('thumbSrc'))
            new_full_path = asset_src_to_path(canonical['fullSrc'])
            new_thumb_path = asset_src_to_path(canonical['thumbSrc'])

            if old_full_path and old_full_path.exists() and new_full_path and old_full_path != new_full_path:
                if new_full_path.exists():
                    old_full_path.unlink()
                else:
                    old_full_path.rename(new_full_path)

            if old_thumb_path and old_thumb_path.exists() and new_thumb_path and old_thumb_path != new_thumb_path:
                if new_thumb_path.exists():
                    old_thumb_path.unlink()
                else:
                    old_thumb_path.rename(new_thumb_path)

            entry['id'] = target_id
            entry['fullSrc'] = canonical['fullSrc']
            entry['thumbSrc'] = canonical['thumbSrc']
            remapped_entry_count += 1
            print(f'Remapped existing id {existing_id} -> {target_id}')

        entry['tags'] = normalize_tags(entry.get('tags'))

        migrated_images.append(entry)

    return migrated_images, used_ids, remapped_entry_count


def sort_images_by_entry_added(images: list[dict[str, Any]]):
    def _sort_key(image: dict[str, Any]):
        parsed = parse_utc_timestamp(image.get(ENTRY_ADDED_FIELD))
        image_id = image.get('id') if isinstance(image.get('id'), str) else ''
        return (parsed or EPOCH_UTC, image_id)

    images.sort(key=_sort_key)


def merge_with_base(base_images: list[Any], generated_entries: list[dict[str, str]]) -> list[dict[str, Any]]:
    entries_by_id: dict[str, dict[str, Any]] = {}
    ordered_ids: list[str] = []

    for item in base_images:
        if not isinstance(item, dict):
            continue

        image_id = item.get('id')
        if not isinstance(image_id, str) or not image_id:
            continue

        if image_id not in entries_by_id:
            ordered_ids.append(image_id)

        entries_by_id[image_id] = dict(item)

    for generated in generated_entries:
        image_id = generated['id']
        merged = dict(entries_by_id.get(image_id, {}))
        previous_timestamp = merged.get(ENTRY_ADDED_FIELD)
        previous_tags = merged.get('tags')

        merged.update(generated)
        if parse_utc_timestamp(previous_timestamp) is not None:
            merged[ENTRY_ADDED_FIELD] = previous_timestamp
        if isinstance(previous_tags, list):
            merged['tags'] = previous_tags

        entries_by_id[image_id] = merged

        if image_id not in ordered_ids:
            ordered_ids.append(image_id)

    final_images: list[dict[str, Any]] = []
    for image_id in ordered_ids:
        entry = entries_by_id[image_id]
        if not source_exists(entry.get('fullSrc')):
            continue
        if not source_exists(entry.get('thumbSrc')):
            continue
        entry['tags'] = normalize_tags(entry.get('tags'))
        final_images.append(entry)

    sort_images_by_entry_added(final_images)

    return final_images


def process_source_images(used_ids: set[str]) -> tuple[list[dict[str, str]], int]:
    generated_entries: list[dict[str, str]] = []
    deleted_source_count = 0
    digest_to_id: dict[str, str] = {}
    processing_started_at = datetime.now(timezone.utc)

    source_files = sorted(
        [path for path in FULL_DIR.iterdir() if path.is_file() and path.suffix.lower() in SOURCE_IMAGE_EXTENSIONS],
        key=lambda path: path.name.lower(),
    )
    for file_index, source_file in enumerate(source_files):
        normalized = normalize_image(source_file)
        digest = image_digest(normalized)
        if digest in digest_to_id:
            image_id = digest_to_id[digest]
        else:
            image_id = make_unique_short_id(digest, used_ids)
            digest_to_id[digest] = image_id
            used_ids.add(image_id)

        full_target = FULL_DIR / f'{image_id}.webp'
        thumb_target = THUMB_DIR / f'{image_id}.webp'

        save_webp(normalized, full_target)

        thumb_bounds = pick_orientation_bounds(normalized, THUMB_BOUNDS_LANDSCAPE, THUMB_BOUNDS_PORTRAIT)
        thumb_image = fit_inside_bounds(normalized, thumb_bounds)
        save_webp(thumb_image, thumb_target)

        normalized.close()
        thumb_image.close()

        source_file.unlink()
        deleted_source_count += 1

        generated_entries.append(
            build_entry(image_id, format_utc_timestamp(processing_started_at + timedelta(seconds=file_index)))
        )
        print(f'Processed {source_file.name} -> {image_id}.webp')

    return generated_entries, deleted_source_count


def main(retranslate_tags: bool):
    if not FULL_DIR.exists():
        print(f'Missing directory: {FULL_DIR}')
        raise SystemExit(1)

    THUMB_DIR.mkdir(parents=True, exist_ok=True)

    gallery_payload = load_existing_gallery(GALLERY_JSON_PATH)
    base_images = gallery_payload.get('images', [])
    if not isinstance(base_images, list):
        base_images = []
    existing_tag_translations = normalize_tag_translations(gallery_payload.get(TAG_TRANSLATIONS_FIELD))

    migrated_base_images, used_ids, remapped_entry_count = migrate_base_entries_to_short_ids(base_images)

    generated_entries, deleted_source_count = process_source_images(used_ids)
    merged_images = merge_with_base(migrated_base_images, generated_entries)
    (
        tag_translations,
        missing_translation_count,
        llm_generated_translation_count,
        fallback_generated_translation_count,
    ) = build_tag_translations(merged_images, existing_tag_translations, retranslate_tags)

    output_payload = {
        'version': gallery_payload.get('version', 1),
        'images': merged_images,
        TAG_TRANSLATIONS_FIELD: tag_translations,
    }
    write_gallery(GALLERY_JSON_PATH, output_payload)

    print(f'Updated gallery manifest: {GALLERY_JSON_PATH}')
    print(f'Images in manifest: {len(merged_images)}')
    print(f'Existing IDs remapped: {remapped_entry_count}')
    print(f'Source image files removed: {deleted_source_count}')
    print(f'Missing tag translations found: {missing_translation_count}')
    print(f'New tag translations generated via LLM: {llm_generated_translation_count}')
    print(f'New tag translations generated via fallback: {fallback_generated_translation_count}')


if __name__ == '__main__':
    try:
        cli_args = parse_cli_args()
        main(retranslate_tags=cli_args.retranslate_tags)
    except Exception as exc:
        print(f'Gallery generation failed: {exc}')
        raise SystemExit(1)
