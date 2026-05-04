import os
from bs4 import BeautifulSoup


def find_unwrapped_text(filepath, root):
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()

    soup = BeautifulSoup(html, "html.parser")

    for element in soup.find_all(text=True):
        text = element.strip()
        if not text:
            continue

        parent = element.parent
        # Ignore script/style/metadata
        if parent.name in ("script", "style", "head", "title", "strong", "em"):
            continue

        if text == "html":
            continue

        # Text is valid only if parent is <p>
        if parent.name != "p":
            rel_path = os.path.relpath(filepath, root)
            print("---- Unwrapped text found ----")
            print("File:", rel_path)
            print("Text:", repr(text))
            print()


def main():
    root = os.path.dirname(os.path.abspath(__file__))

    for dirpath, _, filenames in os.walk(root):
        for filename in filenames:
            if filename.lower().endswith(".html") and not filename.lower().endswith(".webnovel.html"):
                find_unwrapped_text(os.path.join(dirpath, filename), root)


if __name__ == "__main__":
    main()
