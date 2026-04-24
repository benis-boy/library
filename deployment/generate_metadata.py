import json
import os
import sys
from datetime import datetime, timezone


def normalize_paths(paths):
    return [
        os.path.join('book-data', os.path.normpath(path)) if not path.startswith('book-data') else os.path.normpath(path)
        for path in paths
    ]


def parse_encrypted_md(encryption_base):
    encrypted_folders = []
    encrypted_files = []
    exceptions = {}

    with open(encryption_base, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    section = None
    current_folder = None

    for line in lines:
        line = line.strip()

        if line.startswith('## Encrypted Folders'):
            section = 'folders'
        elif line.startswith('## Encrypted Files'):
            section = 'files'
        elif line.startswith('## Exceptions'):
            section = 'exceptions'
        elif line.startswith('-'):
            path = line[2:].strip()
            if section == 'folders':
                encrypted_folders.append(path)
            elif section == 'files':
                encrypted_files.append(path)
            elif section == 'exceptions' and current_folder:
                [norm_folder] = normalize_paths([current_folder])
                exceptions[norm_folder].append(path)
        elif line.startswith('###'):
            current_folder = line[4:]
            [norm_folder] = normalize_paths([current_folder])
            exceptions[norm_folder] = []

    encrypted_folders = normalize_paths(encrypted_folders)
    encrypted_files = normalize_paths(encrypted_files)

    for folder in exceptions:
        exceptions[folder] = normalize_paths(exceptions[folder])

    return encrypted_folders, encrypted_files, exceptions


def is_encrypted_file(relative_path, encrypted_folders, encrypted_files, exceptions):
    [relative_path] = normalize_paths([relative_path])

    if relative_path in encrypted_files:
        return True

    for folder in encrypted_folders:
        [norm_folder] = normalize_paths([folder])
        if relative_path.startswith(norm_folder):
            exception_list = exceptions.get(folder, [])
            if relative_path not in exception_list:
                return True

    return False


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

        chapter['isSecured'] = is_encrypted_file(source_chapter, encrypted_folders, encrypted_files, exceptions)


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
        'generatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
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

    encrypted_folders, encrypted_files, exceptions = parse_encrypted_md(encryption_base_data)
    add_security(manifest, encrypted_folders, encrypted_files, exceptions)
    output_payload = to_output_payload(manifest)
    write_json(output_path, output_payload)

    print(f'Generated metadata: {output_path}')
    print(f'Chapters exported: {len(output_payload.get("chapters", []))}')
