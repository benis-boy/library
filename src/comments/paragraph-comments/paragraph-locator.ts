// ==================== TYPES ====================

export interface Paragraph {
  content: string;
  // Add any other fields you need (e.g. html, id, metadata)
}

export interface ParagraphLocation {
  bookId: string;
  chapterId: string;
  paragraphIndex: number; // Y - updates when paragraph moves
  secondaryKey: string; // 8-char hash of paragraph content
  tertiaryKey: {
    prev: string; // 8-char hash of previous paragraph
    next: string; // 8-char hash of next paragraph
  };
}

// Optional: derived primary key string (bZcXpY style)
export function getPrimaryKey(loc: ParagraphLocation): string {
  return `b${loc.bookId}c${loc.chapterId}p${loc.paragraphIndex}`;
}

// ==================== HASH FUNCTION ====================

/**
 * Simple, deterministic 8-character hash (base-36).
 * Good enough for paragraph-level stability. Replace with a stronger hash if needed.
 */
export function computeShortHash(content: string): string {
  if (!content || content.length === 0) {
    return '00000000';
  }

  let hash = 2166136261; // FNV-1a offset basis (simplified)

  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit
  }

  // Convert to 8-char uppercase base-36 string
  return Math.abs(hash).toString(36).padStart(8, '0').slice(-8).toUpperCase();
}

// ==================== HELPERS ====================

function getSecondaryKey(paragraph: Paragraph): string {
  return computeShortHash(paragraph.content);
}

function getTertiaryKeys(paragraphs: Paragraph[], index: number): { prev: string; next: string } {
  const prevContent = index > 0 ? paragraphs[index - 1].content : '';
  const nextContent = index < paragraphs.length - 1 ? paragraphs[index + 1].content : '';

  return {
    prev: computeShortHash(prevContent),
    next: computeShortHash(nextContent),
  };
}

export function createParagraphLocation(bookId: string, chapterId: string, paragraphs: Paragraph[], paragraphIndex: number): ParagraphLocation {
  const paragraph = paragraphs[paragraphIndex];
  if (!paragraph) {
    throw new Error('Cannot create paragraph location for missing paragraph.');
  }

  return {
    bookId,
    chapterId,
    paragraphIndex,
    secondaryKey: getSecondaryKey(paragraph),
    tertiaryKey: getTertiaryKeys(paragraphs, paragraphIndex),
  };
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Finds the paragraph matching the given location.
 * Ignores content. Content is checked/healed during deployment.
 */
export function findParagraphProd(location: ParagraphLocation, paragraphs: Paragraph[]): Paragraph | null {
  if (!paragraphs || paragraphs.length === 0) {
    return null;
  }

  const origIndex = location.paragraphIndex;

  // --- 1. Try primary key (original position) ---
  if (origIndex >= 0 && origIndex < paragraphs.length) {
    const para = paragraphs[origIndex];
    const currSec = getSecondaryKey(para);
    const currTert = getTertiaryKeys(paragraphs, origIndex);

    if (
      currSec === location.secondaryKey &&
      currTert.prev === location.tertiaryKey.prev &&
      currTert.next === location.tertiaryKey.next
    ) {
      return para; // Perfect match — no changes needed
    }
  }

  return null;
}

/**
 * Finds the paragraph matching the given location.
 * Heals/updates the location object when a match is found via secondary or tertiary keys.
 * Returns the matching Paragraph or null if lost.
 */
export function findParagraphDev(location: ParagraphLocation, paragraphs: Paragraph[]): Paragraph | null {
  const primaryMatch = findParagraphProd(location, paragraphs);
  if (primaryMatch) return primaryMatch;

  const origIndex = location.paragraphIndex;
  // --- 2. Secondary key matches at primary position (but tertiary doesn't) ---
  if (origIndex >= 0 && origIndex < paragraphs.length) {
    const para = paragraphs[origIndex];
    const currSec = getSecondaryKey(para);

    if (currSec === location.secondaryKey) {
      const currTert = getTertiaryKeys(paragraphs, origIndex);

      // Update tertiary (healing)
      location.tertiaryKey.prev = currTert.prev;
      location.tertiaryKey.next = currTert.next;

      return para;
    }
  }

  // --- 3. Secondary failed at primary → scan ±10 paragraphs ---
  const windowStart = Math.max(0, origIndex - 10);
  const windowEnd = Math.min(paragraphs.length - 1, origIndex + 10);

  // 3.1 Look for secondary key match in window
  for (let i = windowStart; i <= windowEnd; i++) {
    if (i === origIndex) continue; // already checked

    const para = paragraphs[i];
    const currSec = getSecondaryKey(para);

    if (currSec === location.secondaryKey) {
      const currTert = getTertiaryKeys(paragraphs, i);

      // Update location (primary moves, tertiary updated)
      location.paragraphIndex = i;
      location.tertiaryKey.prev = currTert.prev;
      location.tertiaryKey.next = currTert.next;

      return para;
    }
  }

  // 3.2 No secondary match → scan for tertiary keys in same window
  for (let i = windowStart; i <= windowEnd; i++) {
    const currTert = getTertiaryKeys(paragraphs, i);
    const para = paragraphs[i];

    const fullMatch = currTert.prev === location.tertiaryKey.prev && currTert.next === location.tertiaryKey.next;

    const prevMatch = currTert.prev === location.tertiaryKey.prev;
    const nextMatch = currTert.next === location.tertiaryKey.next;

    if (fullMatch || prevMatch || nextMatch) {
      // Found via tertiary context (full or partial window)
      const newSec = getSecondaryKey(para);

      // Update location
      location.paragraphIndex = i;
      location.secondaryKey = newSec;
      location.tertiaryKey.prev = currTert.prev;
      location.tertiaryKey.next = currTert.next;

      return para;
    }
  }

  // --- Lost paragraph ---
  return null;
}
