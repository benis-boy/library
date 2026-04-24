import os


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
