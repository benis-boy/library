import os
import shutil
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import base64
import sys


def normalize_paths(paths):
    """Normalize a list of paths."""
    return [os.path.join("book-data", os.path.normpath(path)) for path in paths]


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


def copy_folder(src_folder):
    dst_folder = f"{src_folder}_raw"
    # If the destination folder exists, delete it
    if os.path.exists(dst_folder):
        shutil.rmtree(dst_folder)
    # Copy the folder
    shutil.copytree(src_folder, dst_folder)
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
    print(encrypted_folders, encrypted_files, exceptions)
    for root, _, files in os.walk(src_folder):
        for file in files:
            file_path = os.path.join(root, file)
            if is_encrypted_file(file_path):
                encrypt_file(file_path, password)
    print(f"All files in {src_folder} have been encrypted.")

# Main function


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
            if not file.endswith('.html'):
                file_path = os.path.join(root, file)
                try:
                    os.remove(file_path)
                except OSError as e:
                    print(f"Error removing {file_path}: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python encryptExport.py \"...pathTo_modifyExportResults\" \"...encrypted_files.md\"")
        exit()
    folder_path = sys.argv[1]
    if not os.path.exists(folder_path):
        print("Path does not exist", folder_path)
        exit()
    encryption_base_data = sys.argv[2]
    if not os.path.exists(encryption_base_data):
        print("File does not exist", encryption_base_data)
        exit()

    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "secret.txt"), "r") as f:
        password = "\n".join(f.readlines()).strip()

    if password is None:
        print("password failed to be retrieved")
        exit()

    encrypted_folders, encrypted_files, exceptions = parse_encrypted_md(
        encryption_base_data)
    process_folder(folder_path, password)
