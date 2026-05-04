import html
import json
import math
import os
import re
import sys


chapter_title_mapping: dict[str, str] = {}
IMAGE_MARKER_PATTERN = re.compile(r'\[\[BBIMG:([0-9a-f]{8})\]\]')


def build_chapter_image_trigger(image_id: str):
    safe_id = html.escape(image_id, quote=True)
    thumb_src = f'assets/gallery/thumb/{safe_id}.webp'
    return (
        f'<button class="chapter-image-trigger" data-image-id="{safe_id}" type="button" '
        f'aria-label="Open image {safe_id}">'
        f'<img src="{thumb_src}" alt="Artwork preview {safe_id}" loading="lazy" decoding="async" fetchpriority="low" />'
        f'</button>'
    )


def clean_markdown_file(file_path: str, output_file_path: str):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    match = re.search(r'#', content)
    if match:
        content = content[match.start():]

    content = re.split(r'\n*---\n*#########', content, 0, flags=re.DOTALL)[0]

    with open(output_file_path, 'w', encoding='utf-8') as file:
        file.write(content)


def separate_volumes(input_file_path: str, book_id: str):
    with open(input_file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    volume_pattern = re.compile(r'(?:^|\n)(# .+?)(?=\n# |\Z)', re.DOTALL | re.MULTILINE)
    volumes = volume_pattern.findall(content)

    for volume in volumes:
        lines = volume.split('\n', 1)
        if len(lines) > 1:
            folder_name = lines[0].strip('# ').strip()
            volume_content = lines[1]
        else:
            folder_name = lines[0].strip('# ').strip()
            volume_content = ''

        volume_content = volume_content.rstrip('\n')

        folder_path = os.path.join(os.path.dirname(input_file_path), book_id, folder_name)
        os.makedirs(folder_path, exist_ok=True)

        volume_file_path = os.path.join(folder_path, f"{folder_name}.md")
        with open(volume_file_path, 'w', encoding='utf-8') as volume_file:
            volume_file.write(volume_content)


def count_words(text: str):
    return len(re.findall(r'\w+', text))


def split_md_to_txt(md_file: str, current_directory: str):
    with open(md_file, 'r', encoding='utf-8') as file:
        content = file.read()

    sections = re.split(r'(?=\n## )', content)

    for i in range(0, len(sections)):
        section = sections[i].strip()
        if not section:
            continue

        header_end_index = section.find('\n')
        if header_end_index == -1:
            continue

        original_chapter_name = section[:header_end_index].strip()
        section_content = section[header_end_index:].strip()

        chapter_name = re.sub(r'[<>:"/\\|?*]', '', original_chapter_name)
        chapter_name = chapter_name.strip()[3:]

        output_file_name = f'{str(math.ceil(i + 1)).zfill(2)}_{chapter_name}.txt'
        output_file_path = os.path.join(os.path.dirname(md_file), output_file_name)

        chapter_key = os.path.splitext(os.path.normpath(os.path.relpath(output_file_path, current_directory)))[0]
        chapter_title_mapping[chapter_key] = f'{str(math.ceil(i + 1)).zfill(2)} {original_chapter_name.strip()[3:]}'

        with open(output_file_path, 'w', encoding='utf-8') as output_file:
            output_file.write(section_content)

        volume_folder = os.path.dirname(md_file)
        scenes_folder = os.path.join(volume_folder, 'scenes')
        os.makedirs(scenes_folder, exist_ok=True)
        scene_chapter_folder = f'{str(math.ceil(i + 1)).zfill(2)}_{chapter_name}'
        os.makedirs(os.path.join(scenes_folder, scene_chapter_folder), exist_ok=True)

        scenes = re.split(r'\n\n\n\n\n---\n\n\n\n\n', section_content)
        for j, scene in enumerate(scenes):
            scene = scene.strip()
            if not scene:
                continue

            word_count = count_words(scene)
            scene_file_name = f'{str(j + 1)}_Scene_{word_count}w.txt'
            scene_file_path = os.path.join(scenes_folder, scene_chapter_folder, scene_file_name)

            with open(scene_file_path, 'w', encoding='utf-8') as output_file:
                output_file.write(scene)


def txt_to_html(file_path: str, handle_hr: bool = True):
    with open(file_path, 'r', encoding='utf-8') as file:
        text = file.read()

    text = text.replace('\xa0', ' ')
    text = html.escape(text)
    text = text.replace('\xb0', '&deg;')

    def process_code_block(match: re.Match[str]):
        content = match.group(1).strip()
        cleaned_content = content.replace('\n', '<br />')
        return f'<p class="code-block">{cleaned_content}</p>'

    text = re.sub(r':code:(.*?):/code:', process_code_block, text, flags=re.DOTALL)

    if handle_hr:
        text = text.replace('---', '<hr />')

    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
    text = re.sub(r'(?<!_)_(?!_)(.*?)_(?!_)', r'<em>\1</em>', text)

    lines = text.split('\n')
    wrapped_lines: list[str] = []
    new_paragraph = True

    for line in lines:
        stripped = line.strip()
        marker_match = IMAGE_MARKER_PATTERN.fullmatch(stripped)
        if marker_match:
            wrapped_lines.append(build_chapter_image_trigger(marker_match.group(1)))
            new_paragraph = True
            continue

        if new_paragraph and stripped:
            if stripped == '<hr />':
                wrapped_lines.append(stripped)
                continue

            if not stripped.startswith('<p class="code-block">'):
                wrapped_lines.append(f'<p>{stripped}</p>')
            else:
                wrapped_lines.append(stripped)
            new_paragraph = False
        elif stripped == '':
            new_paragraph = True
            wrapped_lines.append(line)
        else:
            wrapped_lines.append(line)

    return re.sub(r'\n{2,}', '\n', '\n'.join(wrapped_lines))


def process_book(book_path: str, current_directory: str):
    print('Processing book', book_path)
    for folder_name in sorted(os.listdir(book_path)):
        folder_path = os.path.join(book_path, folder_name)
        print('Processing volume', folder_path)

        if not os.path.isdir(folder_path):
            continue

        expected_file_name = f'{folder_name}.md'
        expected_file_path = os.path.join(folder_path, expected_file_name)
        if os.path.isfile(expected_file_path):
            print('splitting', expected_file_path)
            split_md_to_txt(expected_file_path, current_directory)

        for filename in sorted(os.listdir(folder_path)):
            if not filename.endswith('.txt'):
                continue

            file_path = os.path.join(folder_path, filename)
            processed_content = txt_to_html(file_path)

            html_filename = filename.rsplit('.', 1)[0] + '.html'
            html_file_path = os.path.join(folder_path, html_filename)
            with open(html_file_path, 'w', encoding='utf-8') as file:
                file.write(
                    f'<!DOCTYPE html><html lang="en">\n<head><meta charset="UTF-8"><title>{filename.rsplit(".", 1)[0]}</title></head>\n{processed_content}\n</html >'
                )

            processed_webnovel = txt_to_html(file_path, False)
            webnovel_filename = filename.rsplit('.', 1)[0] + '.webnovel.html'
            webnovel_file_path = os.path.join(folder_path, webnovel_filename)
            with open(webnovel_file_path, 'w', encoding='utf-8') as file:
                file.write(
                    f'<!DOCTYPE html><html lang="en">\n<head><meta charset="UTF-8"><title>{filename.rsplit(".", 1)[0]}</title></head>\n{processed_webnovel}\n</html >'
                )


def _get_volume_sort_key(item: tuple[str, list[tuple[str, str]]]):
    match = re.search(r'\d+', item[0])
    return int(match.group()) if match else 0


def _to_runtime_chapter_path(path: str):
    return path.replace('\\', '/').replace('#', '_')


def build_chapter_manifest(directory: str, book_id: str):
    html_files: list[str] = []

    for root, _, files in os.walk(directory):
        rel_root = os.path.relpath(root, directory)
        if not (rel_root == book_id or rel_root.startswith(f'{book_id}{os.sep}')):
            continue

        for file_name in files:
            if file_name.endswith('.html') and not file_name.endswith('.webnovel.html'):
                html_files.append(os.path.normpath(os.path.relpath(os.path.join(root, file_name), directory)))

    html_files.sort()

    volume_dict: dict[str, list[tuple[str, str]]] = {}
    for file_path in html_files:
        book_and_volume, chapter_name = os.path.split(file_path)
        _, volume_name = os.path.split(book_and_volume)
        chapter_name = chapter_name.replace('.html', '')

        if volume_name not in volume_dict:
            volume_dict[volume_name] = []
        volume_dict[volume_name].append((chapter_name, file_path))

    sorted_volumes = sorted(volume_dict.items(), key=_get_volume_sort_key)

    chapters: list[dict[str, str]] = []
    for volume_name, chapter_rows in sorted_volumes:
        for chapter_name, file_path in chapter_rows:
            normalized_file = os.path.normpath(file_path)
            chapter_key = os.path.splitext(normalized_file)[0]
            display_title = chapter_title_mapping.get(chapter_key, chapter_name.replace('_', ' ', 1))

            source_chapter = normalized_file.replace('\\', '/')
            chapters.append(
                {
                    'sourceChapter': source_chapter,
                    'chapter': _to_runtime_chapter_path(source_chapter),
                    'title': display_title,
                    'volume': volume_name,
                }
            )

    return {
        'bookId': book_id,
        'chapters': chapters,
    }


def write_json(path: str, data: object):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python create_htmls.py <bookId> "..._export.md" ["..._chapters_manifest.json"]')
        raise SystemExit(1)

    book_id = sys.argv[1]
    export_md_file = sys.argv[2]

    if not os.path.exists(export_md_file):
        print('File does not exist', export_md_file)
        raise SystemExit(1)

    current_dir = os.path.dirname(os.path.join(os.getcwd(), export_md_file))
    print('working in:', current_dir)

    trimmed = '.trimmed.'.join(export_md_file.split('.'))
    clean_markdown_file(export_md_file, trimmed)
    separate_volumes(trimmed, book_id)

    process_book(os.path.join(current_dir, book_id), current_dir)

    manifest = build_chapter_manifest(current_dir, book_id)
    manifest_path = sys.argv[3] if len(sys.argv) >= 4 else os.path.join(current_dir, f'{book_id}_chapters_manifest.json')
    write_json(manifest_path, manifest)

    print(f'Generated chapter manifest: {manifest_path}')
    print(f'Chapters discovered: {len(manifest.get("chapters", []))}')
