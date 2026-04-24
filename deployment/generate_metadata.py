import json
import os
import sys
from datetime import datetime, timezone

from encryption_rules import is_encrypted_file, parse_encrypted_md


def load_manifest(manifest_path):
    with open(manifest_path, 'r', encoding='utf-8') as f:
        return json.load(f)


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
        entry = {
            'chapter': chapter.get('chapter'),
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
    output_payload = to_output_payload(manifest)
    write_json(output_path, output_payload)

    print(f'Generated metadata: {output_path}')
    print(f'Chapters exported: {len(output_payload.get("chapters", []))}')
