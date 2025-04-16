import json
import os
import re
import math
import html
from datetime import datetime
import sys
from bs4 import BeautifulSoup


chapter_title_mapping = {}
total_words = 0


def update_basic_book_data(json_file, bookId, new_word_count):
    # Round to nearest 1000 and format with dot as thousand separator
    new_word_count = round(new_word_count, -3)
    formatted_word_count = f"{new_word_count:,}".replace(",", ".") + " Words"

    # Load JSON
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Find and update the matching book entry
    updated = False
    for book in data:
        if book["id"] == bookId:
            old_word_count = int("".join(filter(str.isdigit, book["wordCountData"].split(
                " ")[-2]))) if "Words" in book["wordCountData"] else 0
            book["wordCountData"] = formatted_word_count

            # Update lastUpdate if word count increased by more than 10,000
            if new_word_count - old_word_count > 10000:
                book["lastUpdate"] = f"Last updated on {datetime.now().strftime('%d %b %Y')}"
            elif old_word_count == 0:
                book["lastUpdate"] = f"Added on {datetime.now().strftime('%d %b %Y')}"

            updated = True
            break

    if updated:
        # Save the updated JSON
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"Updated {bookId} to {formatted_word_count}")
    else:
        print(f"No matching book found for id: {bookId}")


def normalize_paths(paths):
    """Normalize a list of paths."""
    return [os.path.join(os.path.normpath(path)) for path in paths]


def parse_encrypted_md(encryption_base):
    """Parse the encrypted.md content and return normalized paths for encrypted folders, files, and exceptions."""
    encrypted_folders = []
    encrypted_files = []
    exceptions = {}

    with open(encryption_base, 'r') as f:
        lines = f.readlines()

    section = None
    current_folder = None

    for line in lines:
        line = line.strip()

        if line.startswith("## Encrypted Folders"):
            section = 'folders'
        elif line.startswith("## Encrypted Files"):
            section = 'files'
        elif line.startswith("## Exceptions"):
            section = 'exceptions'
        elif line.startswith("-"):
            # Process folder/file lines
            path = line[2:].strip()
            if section == 'folders':
                encrypted_folders.append(path)
            elif section == 'files':
                encrypted_files.append(path)
            elif section == 'exceptions' and current_folder:
                exceptions[current_folder].append(path)
        elif line.startswith("###"):
            current_folder = line[4:]
            exceptions[current_folder] = []

    # Normalize all paths after parsing
    encrypted_folders = normalize_paths(encrypted_folders)
    encrypted_files = normalize_paths(encrypted_files)

    # Normalize exception paths within their respective folders
    for folder in exceptions:
        exceptions[folder] = normalize_paths(exceptions[folder])

    return encrypted_folders, encrypted_files, exceptions


def is_encrypted_file(relative_path):
    """Check if a file should be encrypted based on the parsed and normalized data."""
    # Normalize the input path
    relative_path = os.path.normpath(relative_path)

    # Check if file is specifically in the encrypted files list (normalized comparison)
    if relative_path in encrypted_files:
        return True

    # Check if file is in any encrypted folder
    for folder in encrypted_folders:
        # If the relative path starts with the folder path (as a substring)
        if relative_path.startswith(folder):
            # Check if this file is in the exception list for this folder
            exception_list = exceptions.get(folder, [])
            if relative_path not in exception_list:
                return True

    # If not encrypted
    return False


def clean_markdown_file(file_path, output_file_path):
    # Read the file
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    # 1. Remove leading text until the first Volume (which starts with a single "#")
    # Match and keep the first "#" and everything after it
    match = re.search(r'#', content)
    if match:
        content = content[match.start():]

    # 2. Remove trailing text after the pattern "\n\n\n---\n\n#########"
    content = re.sub(r'\n\n\n---\n\n#########.*$',
                     '', content, flags=re.DOTALL)

    # Write the cleaned content back to the file (or to a new file if preferred)
    with open(output_file_path, 'w', encoding='utf-8') as file:
        file.write(content)


def separate_volumes(input_file_path, book_id):
    # Read the file with utf-8 encoding
    with open(input_file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    # Regex to split by volumes and keep the volume markers
    volume_pattern = re.compile(
        r'(?:^|\n)(# .+?)(?=\n# |\Z)', re.DOTALL | re.MULTILINE)
    volumes = volume_pattern.findall(content)

    # Create folders and write volume content
    for volume in volumes:
        # Extract folder name from the first line of the volume
        lines = volume.split('\n', 1)
        if len(lines) > 1:
            folder_name = lines[0].strip('# ').strip()
            volume_content = lines[1]
        else:
            folder_name = lines[0].strip('# ').strip()
            volume_content = ''
        volume_content = volume_content.rstrip('\n')

        # Create a folder for the volume
        folder_path = os.path.join(os.path.dirname(
            input_file_path), book_id, folder_name)
        os.makedirs(folder_path, exist_ok=True)

        # Write the volume content to a file in the respective folder
        volume_file_path = os.path.join(folder_path, f"{folder_name}.md")
        with open(volume_file_path, 'w', encoding='utf-8') as volume_file:
            volume_file.write(volume_content)


def count_words(text):
    return len(re.findall(r'\w+', text))


def split_md_to_txt(md_file, current_directory):
    # Read the file content
    with open(md_file, 'r', encoding='utf-8') as file:
        content = file.read()

    # Use a regex to find the section headers and split the content
    sections = re.split(r'(?=\n## )', content)

    # The first element in sections is the text before the first section header, which we can ignore
    for i in range(0, len(sections)):
        section = sections[i].strip()
        if not section:
            continue

        # Split the section into header and content
        header_end_index = section.find('\n')
        if header_end_index == -1:
            continue

        # Get the file name from the header
        original_chapter_name = section[:header_end_index].strip()
        # Get the section content
        section_content = section[header_end_index:].strip()

        # Ensure valid file name by removing or replacing invalid characters
        chapter_name = re.sub(r'[<>:"/\\|?*]', '', original_chapter_name)
        chapter_name = chapter_name.strip()[3:]

        # Create the output file name
        output_file_name = f'{str(math.ceil(i + 1)).zfill(2)}_{chapter_name}.txt'
        output_file_path = os.path.join(
            os.path.dirname(md_file), output_file_name)

        chapter_title_mapping[os.path.splitext(os.path.normpath(os.path.relpath(
            output_file_path, current_directory)))[0]] = f'{str(math.ceil(i + 1)).zfill(2)} {original_chapter_name.strip()[3:]}'

        # Write the section content to the output file
        with open(output_file_path, 'w', encoding='utf-8') as output_file:
            output_file.write(section_content)

        # Create a folder for scenes within the volume folder
        volume_folder = os.path.dirname(md_file)
        scenes_folder = os.path.join(volume_folder, 'scenes')
        os.makedirs(scenes_folder, exist_ok=True)
        scene_chapter_folder = f'{str(math.ceil(i + 1)).zfill(2)}_{chapter_name}'
        os.makedirs(os.path.join(scenes_folder,
                    scene_chapter_folder), exist_ok=True)

        # Split chapter into scenes using the delimiter
        scenes = re.split(r'\n\n\n---\n\n\n', section_content)

        for j, scene in enumerate(scenes):
            scene = scene.strip()
            if not scene:
                continue

            # Calculate word count for the scene
            word_count = count_words(scene)

            # Create the scene file name
            scene_file_name = f'{str(j + 1)}_Scene_{word_count}w.txt'
            scene_file_path = os.path.join(
                scenes_folder, scene_chapter_folder, scene_file_name)

            # Write the scene content to the output file
            with open(scene_file_path, 'w', encoding='utf-8') as output_file:
                output_file.write(scene)


def txt_to_html(file_path):
    # Read the content of the .txt file
    with open(file_path, 'r', encoding='utf-8') as file:
        text = file.read()

    # Escape HTML special characters
    text = html.escape(text)

    # Replace "---" with "<br />---<br />"
    text = text.replace('---', '<hr />')

    # Wrap text between "**" with <strong> tags
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)

    # Wrap text between "*" with <em> tags
    text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)

    # Add <p> tags around paragraphs
    lines = text.split('\n')
    wrapped_lines = []
    new_paragraph = True

    for line in lines:
        if new_paragraph and line.strip():
            wrapped_lines.append(f'<p>{line}</p>')
            new_paragraph = False
        elif line.strip() == '':
            new_paragraph = True
            wrapped_lines.append(line)
        else:
            wrapped_lines.append(line)

    return re.sub(r'\n{2,}', '\n', '\n'.join(wrapped_lines))


def count_words_in_html(html, location):
    soup = BeautifulSoup(html, 'html.parser')
    # Get visible text
    text = soup.get_text(separator=' ')
    pattern = re.compile(r"\b\w+(?:[-']\w+)*\b")
    words = pattern.findall(text)
    count = len(words)
    return count


def update_index_html(directory, book_id):
    # Prepare to collect HTML files
    html_files = []

    # Walk through directory and subdirectories
    for root, dirs, files in os.walk(directory):
        if "\\" + book_id + "\\" in root:
            for file in files:
                if file.endswith('.html'):
                    # Store relative path of HTML files
                    html_files.append(os.path.relpath(
                        os.path.join(root, file), directory))

    global total_words
    total_words = 0
    for file_path in html_files:
        with open((os.path.join(directory, file_path)), 'r', encoding='utf-8') as f:
            print(file_path)
            content = f.read()
            total_words += count_words_in_html(content, file_path)

    # Create new content for the links section
    new_content = []
    volume_dict = {}

    for file in html_files:
        # Extract Volume Name and Chapter Name
        book_and_volume, chapter_name = os.path.split(file)
        book_name, volume_name = os.path.split(book_and_volume)
        chapter_name = chapter_name.replace('.html', '')

        if volume_name not in volume_dict:
            volume_dict[volume_name] = []
        volume_dict[volume_name].append((chapter_name, file))

    new_ul_content = []
    for volume_name, chapters in volume_dict.items():
        new_ul_content.append(f'        <li>{volume_name}\n            <ul>')
        for chapter_name, file_path in chapters:
            # Normalize path separators
            normalized_file = os.path.normpath(file_path)
            display_title = chapter_title_mapping.get(
                os.path.splitext(normalized_file)[0], chapter_name.replace("_", " "))
            # Escape special characters in the file path
            escaped_file = normalized_file.replace(
                "\\", "\\\\").replace("'", "\\'")

            if is_encrypted_file(file_path):
                new_ul_content.append(
                    f'                <li style="display: flex; justify-content: space-between; align-items: center;"><a href="#" onclick="loadContent(\'{escaped_file}\', true); return false;" style="flex-grow: 1;">{display_title}</a><span>$</span></li>')
            else:
                new_ul_content.append(
                    f'                <li><a href="#" onclick="loadContent(\'{escaped_file}\'); return false;">{display_title}</a></li>')
        new_ul_content.append('            </ul>\n        </li>')

    new_ul_content_str = '\n'.join(new_ul_content)

    # Write the updated content back to index.html
    with open(os.path.join(directory, book_id + "_navigation.html"), 'w', encoding='utf-8') as f:
        f.write(new_ul_content_str)

    print(f'Updated the links to load content dynamically in {directory}')


def process_book(book_path, current_directory):
    print("Processing book", book_path)
    for folder_name in os.listdir(book_path):
        folder_path = os.path.join(book_path, folder_name)
        print("Processing volume", folder_path)

        # Check if the path is a directory
        if os.path.isdir(folder_path):
            # Iterate over files in the folder
            expected_file_name = f"{folder_name}.md"
            expected_file_path = os.path.join(folder_path, expected_file_name)

            # Check if the file exists
            if os.path.isfile(expected_file_path):
                # Call split_md_to_txt with the exact file path
                print("splitting", expected_file_path)
                split_md_to_txt(expected_file_path, current_directory)

            for filename in os.listdir(folder_path):
                # Check if the file ends with ".txt"
                if filename.endswith('.txt'):
                    file_path = os.path.join(folder_path, filename)

                    # Process the content
                    processed_content = txt_to_html(file_path)

                    # Write the processed content to a .html file
                    html_filename = filename.rsplit('.', 1)[0] + '.html'
                    html_file_path = os.path.join(folder_path, html_filename)
                    with open(html_file_path, 'w', encoding='utf-8') as file:
                        file.write("<!DOCTYPE html>\n<head><title>" + filename.rsplit(
                            '.', 1)[0] + "</title></head>" + processed_content)


if __name__ == '__main__':  # Get the current directory
    # Check if the script has been called with a file name argument
    if len(sys.argv) < 5:
        print("Usage: python modifyExport.py <bookId> \"..._export.md\" \"...encrypted_files.md\" \"...basicBookData.json\"")
        exit()
    bookId = sys.argv[1]
    exportMdFile = sys.argv[2]
    if not os.path.exists(exportMdFile):
        print("File does not exist", exportMdFile)
        exit()
    encryption_base_data = sys.argv[3]
    if not os.path.exists(encryption_base_data):
        print("File does not exist", encryption_base_data)
        exit()
    basic_book_data = sys.argv[4]
    if not os.path.exists(basic_book_data):
        print("File does not exist", basic_book_data)
        exit()

    encrypted_folders, encrypted_files, exceptions = parse_encrypted_md(
        encryption_base_data)
    current_dir = os.path.dirname(os.path.join(os.getcwd(), exportMdFile))

    print("working in:", current_dir)

    # Split the .md file into .txt files
    trimmed = ".trimmed.".join(exportMdFile.split("."))
    clean_markdown_file(exportMdFile, trimmed)
    separate_volumes(trimmed, bookId)

    process_book(os.path.join(current_dir, bookId), current_dir)

    update_index_html(current_dir, bookId)

    update_basic_book_data(basic_book_data, bookId, total_words)
