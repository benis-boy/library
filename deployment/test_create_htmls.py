import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


GENERATOR = Path(__file__).with_name('create_htmls.py')


class SourceVolumeOrderingTests(unittest.TestCase):
    def run_generator(self, markdown: str) -> dict:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            export_path = temp_path / 'Fixture_export.md'
            manifest_path = temp_path / 'Fixture_chapters_manifest.json'
            export_path.write_text(markdown, encoding='utf-8')

            subprocess.run(
                [
                    sys.executable,
                    str(GENERATOR),
                    'Fixture',
                    str(export_path),
                    str(manifest_path),
                ],
                cwd=temp_dir,
                check=True,
                capture_output=True,
                text=True,
            )

            return json.loads(manifest_path.read_text(encoding='utf-8'))

    def test_equal_volume_numbers_follow_source_order(self):
        manifest = self.run_generator(
            '# V11 - Intermission\n'
            '## Intermission opening\n'
            'First volume body.\n'
            '# V11 - Destiny Deoxys\n'
            '## Destiny arrival\n'
            'Second volume body.\n'
        )

        chapters = manifest['chapters']
        self.assertEqual(
            [chapter['volume'] for chapter in chapters],
            ['V11 - Intermission', 'V11 - Destiny Deoxys'],
        )
        expected_paths = [
            'Fixture/V11 - Intermission/01_Intermission opening.html',
            'Fixture/V11 - Destiny Deoxys/01_Destiny arrival.html',
        ]
        self.assertEqual([chapter['chapter'] for chapter in chapters], expected_paths)
        self.assertEqual(
            [chapter['chapterId'] for chapter in chapters],
            [hashlib.sha1(path.encode('utf-8')).hexdigest()[:8] for path in expected_paths],
        )

    def test_numeric_volume_order_is_preserved(self):
        manifest = self.run_generator(
            '# V10 - Later volume\n'
            '## Later chapter\n'
            'Later body.\n'
            '# V2 - Earlier volume\n'
            '## Earlier chapter\n'
            'Earlier body.\n'
        )

        self.assertEqual(
            [chapter['volume'] for chapter in manifest['chapters']],
            ['V2 - Earlier volume', 'V10 - Later volume'],
        )

    def test_missing_source_order_is_deterministic(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            book_path = temp_path / 'Fixture'
            volumes = {
                'V11 - Zulu': 'Zulu chapter',
                'V11 - Alpha': 'Alpha chapter',
            }
            for volume, title in volumes.items():
                volume_path = book_path / volume
                volume_path.mkdir(parents=True)
                (volume_path / f'01_{title}.html').write_text(
                    '<p>Fixture chapter.</p>', encoding='utf-8'
                )

            first = create_manifest(temp_path, 'Fixture')
            second = create_manifest(temp_path, 'Fixture')

        self.assertEqual(first, second)
        self.assertEqual(
            [chapter['volume'] for chapter in first['chapters']],
            ['V11 - Alpha', 'V11 - Zulu'],
        )


def create_manifest(directory: Path, book_id: str) -> dict:
    # Import the generator by file path so this test needs only Python's standard library.
    import importlib.util

    spec = importlib.util.spec_from_file_location('create_htmls', GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError('Unable to load chapter generator')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.build_chapter_manifest(os.fspath(directory), book_id)


if __name__ == '__main__':
    unittest.main()
