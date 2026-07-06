const paragraphCommentButtonHitArea = document.createElement('div');
paragraphCommentButtonHitArea.className = 'paragraph-comment-button-hit-area';

const paragraphCommentButton = document.createElement('button');
paragraphCommentButton.type = 'button';
paragraphCommentButton.className = 'paragraph-comment-button';
paragraphCommentButton.setAttribute('aria-label', 'Add paragraph comment');
paragraphCommentButton.textContent = 'Comment';
paragraphCommentButtonHitArea.appendChild(paragraphCommentButton);
document.body.appendChild(paragraphCommentButtonHitArea);

let paragraphCommentTimer = null;
let activeParagraph = null;

function getParagraphFromEvent(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest('p[data-paragraph-index]');
}

function hideParagraphCommentButton() {
  if (paragraphCommentTimer !== null) {
    window.clearTimeout(paragraphCommentTimer);
    paragraphCommentTimer = null;
  }

  if (activeParagraph) {
    activeParagraph.classList.remove('paragraph-comment-target');
  }

  activeParagraph = null;
  paragraphCommentButtonHitArea.classList.remove('is-visible');
}

function showParagraphCommentButton(paragraph) {
  activeParagraph = paragraph;
  activeParagraph.classList.add('paragraph-comment-target');

  const paragraphRect = paragraph.getBoundingClientRect();
  paragraphCommentButtonHitArea.classList.add('is-visible');
  const hitAreaWidth = paragraphCommentButtonHitArea.offsetWidth || 260;
  const centeredLeft = paragraphRect.left + paragraphRect.width / 2 - hitAreaWidth / 2 + window.scrollX;
  const maxLeft = Math.max(8, document.documentElement.clientWidth - hitAreaWidth - 8 + window.scrollX);
  const left = Math.min(Math.max(8 + window.scrollX, centeredLeft), maxLeft);
  const top = Math.max(8, paragraphRect.top - 52 + window.scrollY);

  paragraphCommentButtonHitArea.style.left = left + 'px';
  paragraphCommentButtonHitArea.style.top = top + 'px';
}

function scheduleParagraphCommentButton(paragraph) {
  if (activeParagraph === paragraph && paragraphCommentButtonHitArea.classList.contains('is-visible')) {
    return;
  }

  hideParagraphCommentButton();
  activeParagraph = paragraph;
  paragraphCommentTimer = window.setTimeout(function () {
    paragraphCommentTimer = null;
    showParagraphCommentButton(paragraph);
  }, 1000);
}

Array.from(document.querySelectorAll('p')).forEach(function (paragraph, index) {
  paragraph.setAttribute('data-paragraph-index', String(index));
});

function renderParagraphCommentCounts(countsByParagraphIndex) {
  Array.from(document.querySelectorAll('.paragraph-comment-count')).forEach(function (marker) {
    marker.remove();
  });

  if (!countsByParagraphIndex || typeof countsByParagraphIndex !== 'object') {
    return;
  }

  for (const [paragraphIndex, rawCount] of Object.entries(countsByParagraphIndex)) {
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count <= 0) {
      continue;
    }

    const paragraph = document.querySelector('p[data-paragraph-index="' + paragraphIndex + '"]');
    if (!paragraph) {
      continue;
    }

    const marker = document.createElement('i');
    marker.className = 'paragraph-comment-count';
    marker.textContent = String(count);
    marker.tabIndex = 0;
    marker.setAttribute('role', 'button');
    marker.setAttribute('data-paragraph-comment-index', paragraphIndex);
    marker.setAttribute('aria-label', count === 1 ? '1 paragraph comment' : count + ' paragraph comments');
    paragraph.appendChild(marker);
  }
}

function requestParagraphComments(paragraphIndex) {
  const numericParagraphIndex = Number(paragraphIndex);
  if (!Number.isFinite(numericParagraphIndex)) {
    return;
  }

  window.parent.postMessage({ type: 'paragraph-comment-requested', paragraphIndex: numericParagraphIndex }, '*');
}

window.addEventListener('message', function (event) {
  if (event.data?.type !== 'paragraph-comment-counts-updated') {
    return;
  }

  renderParagraphCommentCounts(event.data.countsByParagraphIndex);
});

document.addEventListener('pointerover', function (event) {
  if (event.pointerType === 'touch') {
    return;
  }

  const paragraph = getParagraphFromEvent(event);
  if (!paragraph) {
    return;
  }

  scheduleParagraphCommentButton(paragraph);
});

document.addEventListener('pointerdown', function (event) {
  if (event.pointerType !== 'touch') {
    return;
  }

  const paragraph = getParagraphFromEvent(event);
  if (!paragraph) {
    return;
  }

  scheduleParagraphCommentButton(paragraph);
});

document.addEventListener('pointerout', function (event) {
  const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
  if (
    !activeParagraph ||
    relatedTarget === paragraphCommentButtonHitArea ||
    paragraphCommentButtonHitArea.contains(relatedTarget)
  ) {
    return;
  }

  if (activeParagraph.contains(relatedTarget)) {
    return;
  }

  hideParagraphCommentButton();
});

document.addEventListener('pointerup', function (event) {
  if (event.pointerType === 'touch' && paragraphCommentTimer !== null) {
    hideParagraphCommentButton();
  }
});

document.addEventListener('scroll', hideParagraphCommentButton, { passive: true });

paragraphCommentButton.addEventListener('pointerdown', function (event) {
  event.stopPropagation();
});

paragraphCommentButtonHitArea.addEventListener('pointerover', function (event) {
  event.stopPropagation();
});

paragraphCommentButton.addEventListener('click', function (event) {
  event.preventDefault();
  event.stopPropagation();

  if (!activeParagraph) {
    return;
  }

  const paragraphIndex = Number(activeParagraph.getAttribute('data-paragraph-index'));
  requestParagraphComments(paragraphIndex);
});

document.addEventListener('click', function (event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const paragraphCommentCount = target.closest('.paragraph-comment-count');
  if (paragraphCommentCount) {
    event.preventDefault();
    requestParagraphComments(paragraphCommentCount.getAttribute('data-paragraph-comment-index'));
    return;
  }

  const trigger = target.closest('.chapter-image-trigger');
  if (!trigger) {
    return;
  }

  event.preventDefault();
  const imageId = trigger.getAttribute('data-image-id');
  if (!imageId) {
    return;
  }

  window.parent.postMessage({ type: 'chapter-image-clicked', imageId: imageId }, '*');
});

document.addEventListener('keydown', function (event) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const paragraphCommentCount = target.closest('.paragraph-comment-count');
  if (!paragraphCommentCount) {
    return;
  }

  event.preventDefault();
  requestParagraphComments(paragraphCommentCount.getAttribute('data-paragraph-comment-index'));
});
