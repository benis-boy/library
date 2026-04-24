import json
import os
import re
import sys


def load_metadata(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _get_volume_sort_key(item):
    match = re.search(r'\d+', item[0])
    return int(match.group()) if match else 0


def build_navigation_html(chapters):
    volume_dict = {}
    for chapter in chapters:
        volume = chapter.get('volume') or 'Volume'
        if volume not in volume_dict:
            volume_dict[volume] = []
        volume_dict[volume].append(chapter)

    sorted_volumes = sorted(volume_dict.items(), key=_get_volume_sort_key)

    lines = []
    for volume, entries in sorted_volumes:
        has_valid_entry = any(entry.get('chapter') and entry.get('title') for entry in entries)
        if not has_valid_entry:
            continue

        lines.append(f'        <li>{volume}\n            <ul>')
        for entry in entries:
            chapter = entry.get('chapter')
            title = entry.get('title')
            is_secured = bool(entry.get('isSecured'))

            if not chapter or not title:
                continue

            chapter_for_navigation = chapter.replace('/', '\\')
            escaped_file = chapter_for_navigation.replace('\\', '\\\\').replace("'", "\\'")

            if is_secured:
                lines.append(
                    "                <li style=\"display: flex; justify-content: space-between; align-items: center;\"><a href=\"#\" onclick=\"loadContent('"
                    + escaped_file
                    + "', true); return false;\" style=\"flex-grow: 1; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;\"><span>"
                    + title
                    + '</span><span>$</span></a></li>'
                )
            else:
                lines.append(
                    "                <li><a href=\"#\" onclick=\"loadContent('" + escaped_file + "'); return false;\">" + title + '</a></li>'
                )
        lines.append('            </ul>\n        </li>')

    return '\n'.join(lines)


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print('Usage: python update_navigation.py <bookId> "..._chapters.json" "..._navigation.html"')
        raise SystemExit(1)

    book_id = sys.argv[1]
    metadata_path = sys.argv[2]
    output_path = sys.argv[3]

    if not os.path.exists(metadata_path):
        print('File does not exist', metadata_path)
        raise SystemExit(1)

    data = load_metadata(metadata_path)
    if data.get('bookId') != book_id:
        print('Metadata bookId mismatch', data.get('bookId'), book_id)
        raise SystemExit(1)

    chapters = data.get('chapters', [])
    html_content = build_navigation_html(chapters)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f'Updated navigation html: {output_path}')
    print(f'Navigation chapters: {len(chapters)}')
