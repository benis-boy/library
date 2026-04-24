import json
import os
import re
import sys
from datetime import datetime

from bs4 import BeautifulSoup


def count_words_in_html(html):
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text(separator=' ')
    pattern = re.compile(r"\b\w+(?:[-']\w+)*\b")
    words = pattern.findall(text)
    return len(words)


def collect_total_words(book_root):
    total_words = 0
    for root, _, files in os.walk(book_root):
        for file_name in files:
            if file_name.endswith('.html') and not file_name.endswith('.webnovel.html'):
                file_path = os.path.join(root, file_name)
                with open(file_path, 'r', encoding='utf-8') as f:
                    total_words += count_words_in_html(f.read())
    return total_words


def update_basic_book_data(json_file, book_id, new_word_count):
    new_word_count = round(new_word_count, -3)
    formatted_word_count = f"{new_word_count:,}".replace(',', '.') + ' Words'

    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    updated = False
    for book in data:
        if book.get('id') != book_id:
            continue

        word_data = book.get('wordCountData', '')
        old_word_count = int(''.join(filter(str.isdigit, word_data.split(' ')[-2]))) if 'Words' in word_data else 0

        book['wordCountData'] = formatted_word_count

        if new_word_count - old_word_count > 10000:
            book['lastUpdate'] = f"Last updated on {datetime.now().strftime('%d %b %Y')}"
        elif old_word_count == 0:
            book['lastUpdate'] = f"Added on {datetime.now().strftime('%d %b %Y')}"

        updated = True
        break

    if not updated:
        print(f'No matching book found for id: {book_id}')
        raise SystemExit(1)

    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    print(f'Updated {book_id} to {formatted_word_count}')


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print('Usage: python update_wordcount.py <bookId> "...book_root" "...basicBookData.json"')
        raise SystemExit(1)

    book_id = sys.argv[1]
    book_root = sys.argv[2]
    basic_book_data = sys.argv[3]

    if not os.path.exists(book_root):
        print('Path does not exist', book_root)
        raise SystemExit(1)

    if not os.path.exists(basic_book_data):
        print('File does not exist', basic_book_data)
        raise SystemExit(1)

    total_words = collect_total_words(book_root)
    update_basic_book_data(basic_book_data, book_id, total_words)
