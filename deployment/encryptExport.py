import os
import re
import shutil
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import base64
import sys

from encryption_rules import is_encrypted_file, parse_encrypted_md


book_id_to_secret_path = {
    "PSSJ": "secret.txt",
    "WtDR": "WtDR_secret.txt",
    "SoWB": "SoWB_secret.txt"
}

BBIMG_MARKER_LINE_PATTERN = re.compile(r'^\s*\[\[BBIMG:[0-9a-f]{8}\]\]\s*$', re.MULTILINE)
CHAPTER_IMAGE_TRIGGER_PATTERN = re.compile(r'<button class="chapter-image-trigger"[^>]*>.*?</button>', re.DOTALL)


def strip_gallery_markers_for_raw(file_path: str):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except OSError:
        return False

    cleaned = CHAPTER_IMAGE_TRIGGER_PATTERN.sub('', content)
    cleaned = BBIMG_MARKER_LINE_PATTERN.sub('', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)

    if cleaned == content:
        return False

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(cleaned)
    return True


def sanitize_raw_export_folder(raw_folder: str):
    updated_count = 0
    for root, _, files in os.walk(raw_folder):
        for file_name in files:
            if not file_name.endswith(('.html', '.txt', '.md')):
                continue

            file_path = os.path.join(root, file_name)
            if strip_gallery_markers_for_raw(file_path):
                updated_count += 1

    if updated_count > 0:
        print(f"Sanitized gallery markers for raw export files: {updated_count}")


def copy_folder(src_folder):
    dst_folder = f"{src_folder}_raw"
    # If the destination folder exists, delete it
    if os.path.exists(dst_folder):
        shutil.rmtree(dst_folder)
    # Copy the folder
    shutil.copytree(src_folder, dst_folder)
    sanitize_raw_export_folder(dst_folder)
    print(f"Copied folder to {dst_folder}")
    return dst_folder


def encrypt_file(file_path, password):
    # Generate a key from the password
    salt = b'salt_'  # You can change the salt if needed
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    key = kdf.derive(password.encode())

    # Encrypt the file
    with open(file_path, 'rb') as f:
        plaintext = f.read()

    # Padding the data to ensure it's the right size for AES
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(plaintext) + padder.finalize()

    iv = b'fixed_iv_123456_'
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv),
                    backend=default_backend())
    encryptor = cipher.encryptor()

    ciphertext = encryptor.update(padded_data) + encryptor.finalize()

    # Write the encrypted data back to the file
    with open(file_path, 'wb') as f:
        # Store the IV along with the ciphertext
        f.write(base64.b64encode(iv + ciphertext))
    print(f"Encrypted: {file_path}")

# Function to encrypt all files in a folder


def encrypt_folder(src_folder, password):
    print("encryption info", encrypted_folders, encrypted_files, exceptions)
    for root, _, files in os.walk(src_folder):
        for file in files:
            file_path = os.path.join(root, file)
            if is_encrypted_file(os.path.normpath(file_path), encrypted_folders, encrypted_files, exceptions):
                encrypt_file(file_path, password)
    print(f"All files in {src_folder} have been encrypted.")


def process_folder(src_folder, password):
    # Step 1: Copy folder to "<folder>_raw"
    copy_folder(src_folder)

    remove_non_html_files(src_folder)
    remove_empty_folders(src_folder)

    # Step 2: Encrypt files in the original folder
    encrypt_folder(src_folder, password)


def remove_empty_folders(folder_path):
    # Walk through the directory structure from the bottom up
    for root, dirs, files in os.walk(folder_path, topdown=False):
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            # Check if the directory is empty
            if not os.listdir(dir_path):
                os.rmdir(dir_path)  # Remove the empty folder


def remove_non_html_files(folder_path):
    for root, _, files in os.walk(folder_path):
        for file in files:
            if not file.endswith('.html') or file.endswith('.webnovel.html'):
                file_path = os.path.join(root, file)
                try:
                    os.remove(file_path)
                except OSError as e:
                    print(f"Error removing {file_path}: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python encryptExport.py <bookId> \"...pathTo_modifyExportResults\" \"...encrypted_files.md\"")
        exit()
    bookId = sys.argv[1]
    folder_path = sys.argv[2]
    if not os.path.exists(folder_path):
        print("Path does not exist", folder_path)
        exit()
    encryption_base_data = sys.argv[3]
    if not os.path.exists(encryption_base_data):
        print("File does not exist", encryption_base_data)
        exit()

    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), book_id_to_secret_path[bookId]), "r") as f:
        password = "\n".join(f.readlines()).strip()

    if password is None:
        print("password failed to be retrieved")
        exit()

    encrypted_folders, encrypted_files, exceptions = parse_encrypted_md(
        encryption_base_data)
    process_folder(folder_path, password)
