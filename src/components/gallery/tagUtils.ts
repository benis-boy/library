export type GalleryTagGroup = 'artist' | 'source' | 'character' | 'other';

export type GalleryTagOption = {
  tag: string;
  label: string;
  group: GalleryTagGroup;
};

const TAG_VALUE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const TAG_GROUP_ORDER: Record<GalleryTagGroup, number> = {
  artist: 0,
  source: 1,
  character: 2,
  other: 3,
};
const SINGLE_SELECT_GROUPS = new Set<GalleryTagGroup>(['artist', 'source']);

export const GALLERY_TAG_GROUP_TITLES: Record<GalleryTagGroup, string> = {
  artist: 'Artists',
  source: 'Sources',
  character: 'Characters',
  other: 'General',
};

const humanizeSlug = (value: string) => {
  const words = value
    .split(/[_-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return value;
  }

  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
};

export const normalizeGalleryTag = (rawTag: string | null | undefined): string | null => {
  if (!rawTag) {
    return null;
  }

  const tag = rawTag.trim().toLowerCase();
  if (!tag) {
    return null;
  }

  let valueToValidate = tag;
  if (tag.startsWith('a:') || tag.startsWith('s:') || tag.startsWith('c:')) {
    valueToValidate = tag.slice(2);
  }

  if (!valueToValidate || !TAG_VALUE_PATTERN.test(valueToValidate)) {
    return null;
  }

  return tag;
};

export const getGalleryTagGroup = (tag: string): GalleryTagGroup => {
  if (tag.startsWith('a:')) {
    return 'artist';
  }
  if (tag.startsWith('s:')) {
    return 'source';
  }
  if (tag.startsWith('c:')) {
    return 'character';
  }
  return 'other';
};

export const getGalleryTagLabel = (tag: string, translations: Record<string, string>) => {
  const existing = translations[tag]?.trim();
  if (existing) {
    return existing;
  }

  if (tag.startsWith('a:') || tag.startsWith('s:') || tag.startsWith('c:')) {
    return humanizeSlug(tag.slice(2));
  }

  return humanizeSlug(tag);
};

export const sortGalleryTagOptions = (tags: Iterable<string>, translations: Record<string, string>): GalleryTagOption[] => {
  const unique = new Set<string>();
  for (const rawTag of tags) {
    const tag = normalizeGalleryTag(rawTag);
    if (!tag) {
      continue;
    }
    unique.add(tag);
  }

  return Array.from(unique)
    .map((tag) => ({
      tag,
      group: getGalleryTagGroup(tag),
      label: getGalleryTagLabel(tag, translations),
    }))
    .sort((left, right) => {
      const groupDelta = TAG_GROUP_ORDER[left.group] - TAG_GROUP_ORDER[right.group];
      if (groupDelta !== 0) {
        return groupDelta;
      }

      const labelDelta = left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
      if (labelDelta !== 0) {
        return labelDelta;
      }

      return left.tag.localeCompare(right.tag);
    });
};

const sortTagsForQuery = (tags: string[]) => {
  return [...tags].sort((left, right) => {
    const leftGroup = TAG_GROUP_ORDER[getGalleryTagGroup(left)];
    const rightGroup = TAG_GROUP_ORDER[getGalleryTagGroup(right)];
    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }
    return left.localeCompare(right);
  });
};

const applySingleSelectGroupRules = (tags: string[]) => {
  const uniqueTags = new Set<string>();
  const selectedSingleGroups = new Set<GalleryTagGroup>();
  const result: string[] = [];

  for (const rawTag of tags) {
    const normalized = normalizeGalleryTag(rawTag);
    if (!normalized || uniqueTags.has(normalized)) {
      continue;
    }

    const group = getGalleryTagGroup(normalized);
    if (SINGLE_SELECT_GROUPS.has(group)) {
      if (selectedSingleGroups.has(group)) {
        continue;
      }
      selectedSingleGroups.add(group);
    }

    uniqueTags.add(normalized);
    result.push(normalized);
  }

  return result;
};

export const parseActiveGalleryTags = (searchParams: URLSearchParams): string[] => {
  const raw = searchParams.get('tags');
  if (!raw) {
    return [];
  }

  return sortTagsForQuery(applySingleSelectGroupRules(raw.split(',')));
};

export const buildGalleryTagQueryValue = (tags: string[]): string => {
  return sortTagsForQuery(applySingleSelectGroupRules(tags)).join(',');
};

export const toggleGalleryTagSelection = (activeTags: string[], rawTag: string) => {
  const normalizedTarget = normalizeGalleryTag(rawTag);
  if (!normalizedTarget) {
    return sortTagsForQuery(applySingleSelectGroupRules(activeTags));
  }

  const sanitizedActiveTags = applySingleSelectGroupRules(activeTags);
  if (sanitizedActiveTags.includes(normalizedTarget)) {
    return sortTagsForQuery(sanitizedActiveTags.filter((tag) => tag !== normalizedTarget));
  }

  const targetGroup = getGalleryTagGroup(normalizedTarget);
  const next = sanitizedActiveTags.filter((tag) => {
    if (!SINGLE_SELECT_GROUPS.has(targetGroup)) {
      return true;
    }

    return getGalleryTagGroup(tag) !== targetGroup;
  });

  next.push(normalizedTarget);
  return sortTagsForQuery(next);
};
