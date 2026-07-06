import json
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATOR_PATH = ROOT / 'deployment' / 'generate_gallery_json.py'
ADMIN_PATH = ROOT / 'dev-tools' / 'gallery_tag_admin.py'


def read_new_image_ids(review_session_path: Path) -> list[str]:
    with review_session_path.open('r', encoding='utf-8') as f:
        payload = json.load(f)

    raw_ids = payload.get('newImageIds') if isinstance(payload, dict) else None
    if not isinstance(raw_ids, list):
        return []

    return [image_id for image_id in raw_ids if isinstance(image_id, str) and image_id.strip()]


def main():
    review_session_path = Path(tempfile.gettempdir()) / f'gallery-review-{uuid.uuid4().hex}.json'

    generator_args = [
        sys.executable,
        str(GENERATOR_PATH),
        '--review-session-output',
        str(review_session_path),
    ]
    print('Processing gallery source images...')
    subprocess.run(generator_args, cwd=ROOT, check=True)

    new_image_ids = read_new_image_ids(review_session_path)
    admin_args = [sys.executable, str(ADMIN_PATH)]
    if new_image_ids:
        print(f'Starting gallery admin in strict review mode for {len(new_image_ids)} new image(s).')
        admin_args.extend(['--review-session', str(review_session_path)])
    else:
        print('No newly generated gallery images found. Starting gallery admin normally.')

    subprocess.run(admin_args, cwd=ROOT, check=True)


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(exc.returncode)
