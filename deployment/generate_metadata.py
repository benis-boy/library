import json
import os
import sys
from hashlib import sha256

from encryption_rules import is_encrypted_file, parse_encrypted_md


def load_manifest(manifest_path):
    with open(manifest_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_existing_metadata(path):
    if not os.path.exists(path):
        return None

    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_chapter_relative_path(chapter):
    relative_path = chapter.get('sourceChapter') or chapter.get('chapter')
    if not isinstance(relative_path, str) or not relative_path:
        return None

    return relative_path.replace('\\', '/')


def read_chapter_bytes(root_dir, book_id, chapter, raw_folder_name=None):
    relative_path = get_chapter_relative_path(chapter)
    if not relative_path:
        return None

    path_parts = relative_path.split('/')
    if raw_folder_name and path_parts and path_parts[0] == book_id:
        path_parts[0] = raw_folder_name

    file_path = os.path.join(root_dir, *path_parts)
    if not os.path.exists(file_path):
        return None

    with open(file_path, 'rb') as f:
        return f.read()


def build_chapter_signature(chapter, content_bytes):
    payload = {
        'chapterId': chapter.get('chapterId'),
        'chapter': chapter.get('chapter'),
        'title': chapter.get('title'),
        'isSecured': bool(chapter.get('isSecured', False)),
        'volume': chapter.get('volume') or '',
        'contentHash': sha256(content_bytes).hexdigest() if content_bytes is not None else None,
    }
    return sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()


def merge_previous_chapter_data(existing_metadata, existing_manifest):
    previous_by_id = {}

    if existing_manifest and isinstance(existing_manifest.get('chapters'), list):
        for chapter in existing_manifest['chapters']:
            chapter_id = chapter.get('chapterId')
            if isinstance(chapter_id, str) and chapter_id:
                previous_by_id[chapter_id] = dict(chapter)

    if existing_metadata and isinstance(existing_metadata.get('chapters'), list):
        for chapter in existing_metadata['chapters']:
            chapter_id = chapter.get('chapterId')
            if isinstance(chapter_id, str) and chapter_id:
                merged = previous_by_id.get(chapter_id, {}).copy()
                merged.update(chapter)
                previous_by_id[chapter_id] = merged

    return previous_by_id


def apply_content_versions(manifest, existing_metadata, existing_manifest, root_dir, book_id):
    previous_by_id = merge_previous_chapter_data(existing_metadata, existing_manifest)
    raw_folder_name = f'{book_id}_raw'

    for chapter in manifest.get('chapters', []):
        chapter_id = chapter.get('chapterId')
        if not isinstance(chapter_id, str) or not chapter_id:
            chapter['contentVersion'] = '1'
            continue

        previous = previous_by_id.get(chapter_id)
        if not previous:
            chapter['contentVersion'] = '1'
            continue

        previous_version = previous.get('contentVersion')
        try:
            previous_version_number = max(1, int(str(previous_version)))
        except (TypeError, ValueError):
            previous_version_number = 1

        previous_content_bytes = read_chapter_bytes(root_dir, book_id, previous, raw_folder_name)
        current_content_bytes = read_chapter_bytes(root_dir, book_id, chapter)
        if build_chapter_signature(previous, previous_content_bytes) == build_chapter_signature(chapter, current_content_bytes):
            chapter['contentVersion'] = str(previous_version_number)
        else:
            chapter['contentVersion'] = str(previous_version_number + 1)


def add_security(manifest, encrypted_folders, encrypted_files, exceptions):
    chapters = manifest.get('chapters', [])
    for chapter in chapters:
        source_chapter = chapter.get('sourceChapter')
        if not isinstance(source_chapter, str) or not source_chapter:
            chapter['isSecured'] = False
            continue

        chapter['isSecured'] = is_encrypted_file(
            source_chapter, encrypted_folders, encrypted_files, exceptions)


def to_output_payload(manifest):
    output_chapters = []
    for chapter in manifest.get('chapters', []):
        chapter_id = chapter.get('chapterId')
        chapter_path = chapter.get('chapter')
        if not chapter_id or not chapter_path:
            raise ValueError(f'Manifest chapter is missing required fields: {chapter}')

        entry = {
            'chapterId': chapter_id,
            'chapter': chapter_path,
            'contentVersion': str(chapter.get('contentVersion', '1')),
            'title': chapter.get('title'),
            'isSecured': bool(chapter.get('isSecured', False)),
        }
        volume = chapter.get('volume')
        if volume:
            entry['volume'] = volume
        output_chapters.append(entry)

    return {
        'bookId': manifest.get('bookId'),
        'chapters': output_chapters,
    }


def write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


if __name__ == '__main__':
    if len(sys.argv) < 5:
        print(
            'Usage: python generate_metadata.py <bookId> "..._chapters_manifest.json" "...encrypted_files.md" "..._chapters.json"'
        )
        raise SystemExit(1)

    book_id = sys.argv[1]
    manifest_path = sys.argv[2]
    encryption_base_data = sys.argv[3]
    output_path = sys.argv[4]

    if not os.path.exists(manifest_path):
        print('File does not exist', manifest_path)
        raise SystemExit(1)

    if not os.path.exists(encryption_base_data):
        print('File does not exist', encryption_base_data)
        raise SystemExit(1)

    manifest = load_manifest(manifest_path)
    if manifest.get('bookId') != book_id:
        print('Manifest bookId mismatch', manifest.get('bookId'), book_id)
        raise SystemExit(1)

    encrypted_folders, encrypted_files, exceptions = parse_encrypted_md(
        encryption_base_data)
    add_security(manifest, encrypted_folders, encrypted_files, exceptions)
    root_dir = os.path.dirname(output_path)
    existing_metadata_path = os.path.join(os.path.dirname(output_path), f'{book_id}_raw', f'{book_id}_chapters.json')
    existing_metadata = load_existing_metadata(existing_metadata_path)
    existing_manifest_path = os.path.join(os.path.dirname(output_path), f'{book_id}_raw', f'{book_id}_chapters_manifest.json')
    existing_manifest = load_existing_metadata(existing_manifest_path)
    apply_content_versions(manifest, existing_metadata, existing_manifest, root_dir, book_id)
    output_payload = to_output_payload(manifest)
    write_json(output_path, output_payload)

    print(f'Generated metadata: {output_path}')
    print(f'Chapters exported: {len(output_payload.get("chapters", []))}')
