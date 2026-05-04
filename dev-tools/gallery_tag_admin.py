import json
import re
import tempfile
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
GALLERY_JSON_PATH = ROOT / 'public' / 'assets' / 'gallery' / 'gallery.json'
DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 8765
TAG_VALUE_PATTERN = re.compile(r'^[a-z0-9][a-z0-9_-]*$')
ALLOWED_PREFIXES = ('c:', 's:', 'a:')


def normalize_single_tag(raw_tag):
    if not isinstance(raw_tag, str):
        return ''

    tag = raw_tag.strip().lower()
    if not tag:
        return ''

    value_to_validate = tag
    if tag.startswith(ALLOWED_PREFIXES):
        value_to_validate = tag[2:]

    if not value_to_validate or not TAG_VALUE_PATTERN.fullmatch(value_to_validate):
        return ''

    return tag


def normalize_tags(raw_tags):
    if not isinstance(raw_tags, list):
        return []

    normalized = []
    seen = set()

    for raw_tag in raw_tags:
        tag = normalize_single_tag(raw_tag)
        if not tag:
            continue

        if tag in seen:
            continue

        seen.add(tag)
        normalized.append(tag)

    return normalized


def normalize_tag_translations(raw_translations):
    if not isinstance(raw_translations, dict):
        return {}

    normalized = {}
    for raw_tag, raw_label in raw_translations.items():
        tag = normalize_single_tag(raw_tag)
        if not tag:
            continue

        if not isinstance(raw_label, str):
            continue

        label = raw_label.strip()
        if not label:
            continue

        normalized[tag] = label

    return {key: normalized[key] for key in sorted(normalized)}


def normalize_gallery_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError('gallery.json must be an object')

    version = payload.get('version')
    if not isinstance(version, int):
        version = 1

    raw_images = payload.get('images')
    if not isinstance(raw_images, list):
        raw_images = []

    normalized_tag_translations = normalize_tag_translations(payload.get('tagTranslations'))

    normalized_images = []
    for item in raw_images:
        if not isinstance(item, dict):
            continue

        image_id = item.get('id')
        thumb_src = item.get('thumbSrc')
        full_src = item.get('fullSrc')
        entry_added_at = item.get('entryAddedAt')

        if not isinstance(image_id, str) or not image_id:
            continue
        if not isinstance(thumb_src, str) or not thumb_src:
            continue
        if not isinstance(full_src, str) or not full_src:
            continue
        if not isinstance(entry_added_at, str) or not entry_added_at:
            continue

        normalized_images.append(
            {
                'id': image_id,
                'thumbSrc': thumb_src,
                'fullSrc': full_src,
                'entryAddedAt': entry_added_at,
                'tags': normalize_tags(item.get('tags', [])),
            }
        )

    return {
        'version': version,
        'images': normalized_images,
        'tagTranslations': normalized_tag_translations,
    }


def read_gallery_payload():
    if not GALLERY_JSON_PATH.exists():
        raise FileNotFoundError(f'Missing gallery manifest: {GALLERY_JSON_PATH}')

    with GALLERY_JSON_PATH.open('r', encoding='utf-8') as f:
        payload = json.load(f)

    return normalize_gallery_payload(payload)


def write_gallery_payload(payload):
    normalized_payload = normalize_gallery_payload(payload)

    GALLERY_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', delete=False, dir=GALLERY_JSON_PATH.parent) as tmp:
        json.dump(normalized_payload, tmp, indent=2, ensure_ascii=False)
        tmp.write('\n')
        tmp_path = Path(tmp.name)

    tmp_path.replace(GALLERY_JSON_PATH)


def read_static_file(path):
    if path == '/':
        return build_admin_html().encode('utf-8'), 'text/html; charset=utf-8'
    return None, None


def build_admin_html():
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gallery Tag Admin</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4efe6;
      --card: #fffdf8;
      --ink: #2f2419;
      --muted: #7d6654;
      --line: #d9ccb8;
      --accent: #9f4f2f;
      --accent-soft: #f0d5c6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at 10% 0%, #fbf5eb 0%, var(--bg) 55%, #efe3d4 100%);
    }
    .wrap {
      max-width: 1460px;
      margin: 0 auto;
      padding: 20px;
    }
    .top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      letter-spacing: 0.02em;
    }
    .btn {
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--ink);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 0.95rem;
      cursor: pointer;
      min-height: 44px;
    }
    .btn.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: #fff;
      font-weight: 700;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .muted {
      color: var(--muted);
      font-size: 0.92rem;
    }
    .status {
      min-height: 1.2rem;
      margin: 0;
      color: var(--muted);
    }
    .status.ok { color: #2c6a38; }
    .status.err { color: #9b2d2d; }
    .workspace {
      display: grid;
      grid-template-columns: 290px minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }
    .bulk-panel {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      display: grid;
      gap: 10px;
      position: sticky;
      top: 12px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.05);
    }
    .bulk-title {
      margin: 0;
      font-size: 1.08rem;
    }
    .bulk-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .bulk-row .tag-input {
      min-width: 170px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 14px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 3px 10px rgba(0,0,0,0.05);
    }
    .card.selected {
      border-color: var(--accent);
      box-shadow: 0 5px 14px rgba(159,79,47,0.24);
    }
    .preview {
      width: 100%;
      aspect-ratio: 4 / 5;
      object-fit: cover;
      background: #e8dccd;
      border-bottom: 1px solid var(--line);
    }
    .content {
      padding: 10px;
      display: grid;
      gap: 8px;
    }
    .id {
      font-family: Consolas, "Courier New", monospace;
      font-size: 0.82rem;
      color: var(--muted);
      word-break: break-all;
    }
    .select-row {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      color: var(--muted);
      width: fit-content;
      cursor: pointer;
      user-select: none;
    }
    .select-row input {
      width: 18px;
      height: 18px;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag {
      border: 1px solid var(--line);
      background: #f8f2e9;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 0.82rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .tag button {
      border: 0;
      background: transparent;
      color: #7f3f2c;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      min-width: 18px;
      min-height: 18px;
    }
    .tag-input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .tag-input {
      flex: 1;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 10px;
      padding: 10px;
      min-height: 44px;
      font-size: 0.92rem;
    }
    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .suggestion {
      border: 1px dashed #c8b39a;
      background: var(--accent-soft);
      color: #5d2b16;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 0.78rem;
      cursor: pointer;
      min-height: 30px;
    }
    @media (max-width: 980px) {
      .workspace {
        grid-template-columns: 1fr;
      }
      .bulk-panel {
        position: static;
      }
    }
    @media (max-width: 600px) {
      .wrap { padding: 12px; }
      .cards { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <h1>Gallery Tag Admin</h1>
        <div class="muted">Local tool only - edits public/assets/gallery/gallery.json</div>
      </div>
      <button id="saveBtn" class="btn primary">Save tags</button>
    </div>
    <p id="status" class="status"></p>
    <div class="workspace">
      <aside class="bulk-panel">
        <h2 class="bulk-title">Bulk Edit</h2>
        <div class="muted">Selected images: <strong id="selectedCount">0</strong></div>
        <div class="bulk-row">
          <button id="selectAllBtn" class="btn" type="button">Select all</button>
          <button id="clearSelectionBtn" class="btn" type="button">Clear selection</button>
        </div>
        <div class="bulk-row">
          <input id="bulkTagInput" class="tag-input" placeholder="Add tag to selected" />
          <button id="bulkAddBtn" class="btn" type="button">Add to selected</button>
        </div>
        <div id="bulkSuggestions" class="suggestions"></div>
        <div class="muted">Common tags across selected</div>
        <div id="commonTags" class="tag-list"></div>
      </aside>
      <div id="cards" class="cards"></div>
    </div>
  </div>

  <script>
    const state = {
      payload: null,
      changed: false,
      allTagSuggestions: [],
      selectedIds: []
    };

    const cardsEl = document.getElementById('cards');
    const statusEl = document.getElementById('status');
    const saveBtn = document.getElementById('saveBtn');
    const selectedCountEl = document.getElementById('selectedCount');
    const commonTagsEl = document.getElementById('commonTags');
    const bulkTagInputEl = document.getElementById('bulkTagInput');
    const bulkAddBtn = document.getElementById('bulkAddBtn');
    const bulkSuggestionsEl = document.getElementById('bulkSuggestions');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');

    function setStatus(message, cls = '') {
      statusEl.textContent = message || '';
      statusEl.className = 'status' + (cls ? ' ' + cls : '');
    }

    function normalizeTag(tag) {
      if (typeof tag !== 'string') return '';
      const out = tag.trim().toLowerCase();
      if (!out) return '';

      const value = out.startsWith('c:') || out.startsWith('s:') || out.startsWith('a:') ? out.slice(2) : out;
      if (!value) return '';
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) return '';
      return out;
    }

    function normalizeTagTranslations(rawTranslations) {
      if (!rawTranslations || typeof rawTranslations !== 'object' || Array.isArray(rawTranslations)) {
        return {};
      }

      const normalized = {};
      for (const [rawTag, rawLabel] of Object.entries(rawTranslations)) {
        const tag = normalizeTag(rawTag);
        if (!tag) continue;
        if (typeof rawLabel !== 'string') continue;

        const label = rawLabel.trim();
        if (!label) continue;
        normalized[tag] = label;
      }

      return Object.fromEntries(Object.entries(normalized).sort((a, b) => a[0].localeCompare(b[0])));
    }

    function uniqTags(tags) {
      const seen = new Set();
      const out = [];
      for (const t of tags || []) {
        const n = normalizeTag(t);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        out.push(n);
      }
      return out;
    }

    function collectSuggestions(images) {
      const all = [];
      for (const img of images) {
        for (const tag of img.tags || []) all.push(tag);
      }
      return uniqTags(all).sort();
    }

    function markChanged() {
      state.changed = true;
      saveBtn.textContent = 'Save tags *';
    }

    function clearChanged() {
      state.changed = false;
      saveBtn.textContent = 'Save tags';
    }

    function selectedIdSet() {
      return new Set(state.selectedIds || []);
    }

    function selectedImages() {
      if (!state.payload) return [];
      const idSet = selectedIdSet();
      return (state.payload.images || []).filter((img) => idSet.has(img.id));
    }

    function commonTagsForImages(images) {
      if (!images.length) return [];
      const counts = new Map();
      for (const image of images) {
        for (const tag of uniqTags(image.tags || [])) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
      const out = [];
      for (const [tag, count] of counts.entries()) {
        if (count === images.length) out.push(tag);
      }
      return out.sort();
    }

    function toggleSelected(imageId) {
      const idSet = selectedIdSet();
      if (idSet.has(imageId)) idSet.delete(imageId);
      else idSet.add(imageId);
      state.selectedIds = Array.from(idSet);
    }

    function selectAllImages() {
      if (!state.payload) return;
      state.selectedIds = (state.payload.images || []).map((img) => img.id);
      render();
    }

    function clearSelection() {
      state.selectedIds = [];
      render();
    }

    function addTagToSelected(rawTag) {
      const tag = normalizeTag(rawTag);
      if (!tag) return false;

      const images = selectedImages();
      if (!images.length) return false;

      let changedAny = false;
      for (const image of images) {
        const before = uniqTags(image.tags || []);
        const after = uniqTags([...before, tag]);
        if (after.length !== before.length) {
          image.tags = after;
          changedAny = true;
        }
      }

      if (changedAny) markChanged();
      return true;
    }

    function removeCommonTagFromSelected(tag) {
      const images = selectedImages();
      if (!images.length) return;

      let changedAny = false;
      for (const image of images) {
        const nextTags = (image.tags || []).filter((t) => t !== tag);
        if (nextTags.length !== (image.tags || []).length) {
          image.tags = nextTags;
          changedAny = true;
        }
      }

      if (changedAny) {
        markChanged();
        render();
      }
    }

    function addTagToImage(image, rawTag) {
      const tag = normalizeTag(rawTag);
      if (!tag) return false;
      image.tags = uniqTags([...(image.tags || []), tag]);
      markChanged();
      return true;
    }

    function removeTagFromImage(image, tag) {
      image.tags = (image.tags || []).filter((x) => x !== tag);
      markChanged();
    }

    function render() {
      if (!state.payload) return;

      state.allTagSuggestions = collectSuggestions(state.payload.images);
      cardsEl.innerHTML = '';

      const selectedSet = selectedIdSet();
      state.selectedIds = (state.payload.images || []).map((img) => img.id).filter((id) => selectedSet.has(id));

      const selected = selectedImages();
      const commonTags = commonTagsForImages(selected);
      selectedCountEl.textContent = String(selected.length);

      commonTagsEl.innerHTML = '';
      if (!commonTags.length) {
        const empty = document.createElement('span');
        empty.className = 'muted';
        empty.textContent = selected.length ? 'No common tags' : 'Select images to see common tags';
        commonTagsEl.appendChild(empty);
      }

      for (const tag of commonTags) {
        const pill = document.createElement('span');
        pill.className = 'tag';

        const label = document.createElement('span');
        label.textContent = tag;

        const del = document.createElement('button');
        del.type = 'button';
        del.title = 'Remove from selected';
        del.textContent = '×';
        del.addEventListener('click', () => {
          removeCommonTagFromSelected(tag);
        });

        pill.appendChild(label);
        pill.appendChild(del);
        commonTagsEl.appendChild(pill);
      }

      bulkSuggestionsEl.innerHTML = '';
      for (const suggestion of state.allTagSuggestions) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'suggestion';
        chip.textContent = suggestion;
        chip.disabled = selected.length === 0;
        chip.addEventListener('click', () => {
          const ok = addTagToSelected(suggestion);
          if (!ok) {
            setStatus('Select at least one image first.', 'err');
            return;
          }
          setStatus('');
          render();
        });
        bulkSuggestionsEl.appendChild(chip);
      }

      bulkAddBtn.disabled = selected.length === 0;
      bulkTagInputEl.disabled = selected.length === 0;
      selectAllBtn.disabled = (state.payload.images || []).length === 0;
      clearSelectionBtn.disabled = selected.length === 0;

      for (const image of state.payload.images) {
        image.tags = uniqTags(image.tags || []);

        const card = document.createElement('article');
        card.className = 'card';
        if (selectedSet.has(image.id)) card.classList.add('selected');

        const preview = document.createElement('img');
        preview.className = 'preview';
        preview.loading = 'lazy';
        preview.decoding = 'async';
        preview.alt = image.id;
        preview.src = '/' + image.thumbSrc;

        const content = document.createElement('div');
        content.className = 'content';

        const idRow = document.createElement('div');
        idRow.className = 'id';
        idRow.textContent = image.id + '  ·  ' + image.entryAddedAt;

        const selectRow = document.createElement('label');
        selectRow.className = 'select-row';

        const selectCheckbox = document.createElement('input');
        selectCheckbox.type = 'checkbox';
        selectCheckbox.checked = selectedSet.has(image.id);
        selectCheckbox.addEventListener('change', () => {
          toggleSelected(image.id);
          render();
        });

        const selectText = document.createElement('span');
        selectText.textContent = 'Select for bulk edit';
        selectRow.appendChild(selectCheckbox);
        selectRow.appendChild(selectText);

        const tagList = document.createElement('div');
        tagList.className = 'tag-list';

        if (!image.tags.length) {
          const empty = document.createElement('span');
          empty.className = 'muted';
          empty.textContent = 'No tags yet';
          tagList.appendChild(empty);
        }

        for (const tag of image.tags) {
          const pill = document.createElement('span');
          pill.className = 'tag';

          const label = document.createElement('span');
          label.textContent = tag;

          const del = document.createElement('button');
          del.type = 'button';
          del.title = 'Remove tag';
          del.textContent = '×';
          del.addEventListener('click', () => {
            removeTagFromImage(image, tag);
            render();
          });

          pill.appendChild(label);
          pill.appendChild(del);
          tagList.appendChild(pill);
        }

        const inputRow = document.createElement('div');
        inputRow.className = 'tag-input-row';

        const input = document.createElement('input');
        input.className = 'tag-input';
        input.placeholder = 'Add tag (c:hero, s:pssj, a:artist, mood)';

        const addBtn = document.createElement('button');
        addBtn.className = 'btn';
        addBtn.type = 'button';
        addBtn.textContent = 'Add';

        const submitAdd = () => {
          const ok = addTagToImage(image, input.value);
          if (!ok) {
            setStatus('Invalid tag. Use lowercase letters/numbers plus _ or -, with optional c: / s: / a: prefix.', 'err');
            return;
          }
          input.value = '';
          setStatus('');
          render();
        };

        addBtn.addEventListener('click', submitAdd);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') submitAdd();
        });

        inputRow.appendChild(input);
        inputRow.appendChild(addBtn);

        const suggestions = document.createElement('div');
        suggestions.className = 'suggestions';

        for (const suggestion of state.allTagSuggestions) {
          if ((image.tags || []).includes(suggestion)) continue;

          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'suggestion';
          chip.textContent = suggestion;
          chip.addEventListener('click', () => {
            addTagToImage(image, suggestion);
            render();
          });
          suggestions.appendChild(chip);
        }

        content.appendChild(idRow);
        content.appendChild(selectRow);
        content.appendChild(tagList);
        content.appendChild(inputRow);
        content.appendChild(suggestions);

        card.appendChild(preview);
        card.appendChild(content);
        cardsEl.appendChild(card);
      }
    }

    async function loadData() {
      const res = await fetch('/api/gallery');
      if (!res.ok) {
        throw new Error('Failed to load gallery data');
      }
      state.payload = await res.json();
      state.payload.tagTranslations = normalizeTagTranslations(state.payload.tagTranslations);
      for (const img of state.payload.images || []) {
        img.tags = uniqTags(img.tags || []);
      }
      clearChanged();
      setStatus('Loaded ' + (state.payload.images || []).length + ' images.');
      render();
    }

    async function saveData() {
      if (!state.payload) return;
      const payload = {
        version: Number.isInteger(state.payload.version) ? state.payload.version : 1,
        tagTranslations: normalizeTagTranslations(state.payload.tagTranslations),
        images: (state.payload.images || []).map((img) => ({
          id: img.id,
          thumbSrc: img.thumbSrc,
          fullSrc: img.fullSrc,
          entryAddedAt: img.entryAddedAt,
          tags: uniqTags(img.tags || [])
        }))
      };

      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Failed to save gallery data');
      }

      state.payload = await res.json();
      clearChanged();
      setStatus('Saved gallery tags.', 'ok');
      render();
    }

    saveBtn.addEventListener('click', async () => {
      try {
        setStatus('Saving...');
        saveBtn.disabled = true;
        await saveData();
      } catch (err) {
        setStatus(String(err && err.message ? err.message : err), 'err');
      } finally {
        saveBtn.disabled = false;
      }
    });

    bulkAddBtn.addEventListener('click', () => {
      const ok = addTagToSelected(bulkTagInputEl.value);
      if (!ok) {
        setStatus('Invalid tag or no images selected.', 'err');
        return;
      }
      bulkTagInputEl.value = '';
      setStatus('');
      render();
    });

    bulkTagInputEl.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const ok = addTagToSelected(bulkTagInputEl.value);
      if (!ok) {
        setStatus('Invalid tag or no images selected.', 'err');
        return;
      }
      bulkTagInputEl.value = '';
      setStatus('');
      render();
    });

    selectAllBtn.addEventListener('click', () => {
      selectAllImages();
    });

    clearSelectionBtn.addEventListener('click', () => {
      clearSelection();
    });

    (async () => {
      try {
        await loadData();
      } catch (err) {
        setStatus(String(err && err.message ? err.message : err), 'err');
      }
    })();
  </script>
</body>
</html>
"""


class GalleryAdminHandler(BaseHTTPRequestHandler):
    def _json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _text(self, payload, status=HTTPStatus.OK):
        body = payload.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/gallery':
            try:
                payload = read_gallery_payload()
            except Exception as exc:
                self._text(f'Failed to read gallery.json: {exc}', status=HTTPStatus.INTERNAL_SERVER_ERROR)
                return

            self._json(payload)
            return

        body, content_type = read_static_file(path)
        if body is not None:
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path.startswith('/assets/'):
            file_path = ROOT / 'public' / path.lstrip('/')
            if file_path.exists() and file_path.is_file():
                content = file_path.read_bytes()
                content_type = 'application/octet-stream'
                if file_path.suffix.lower() == '.webp':
                    content_type = 'image/webp'
                elif file_path.suffix.lower() == '.png':
                    content_type = 'image/png'

                self.send_response(HTTPStatus.OK)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        self._text('Not found', status=HTTPStatus.NOT_FOUND)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/api/gallery':
            self._text('Not found', status=HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self._text('Invalid Content-Length', status=HTTPStatus.BAD_REQUEST)
            return

        try:
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode('utf-8'))
            write_gallery_payload(payload)
            latest = read_gallery_payload()
            self._json(latest)
        except json.JSONDecodeError:
            self._text('Invalid JSON payload', status=HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self._text(f'Failed to save gallery.json: {exc}', status=HTTPStatus.BAD_REQUEST)

    def log_message(self, format, *args):
        return


def main():
    server = ThreadingHTTPServer((DEFAULT_HOST, DEFAULT_PORT), GalleryAdminHandler)
    print(f'Gallery tag admin running at http://{DEFAULT_HOST}:{DEFAULT_PORT}')
    print('Press Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
