import { useContext, useMemo } from 'react';
import { ConfigurationContext } from '../../context/ConfigurationContext';
import { GALLERY_TAG_GROUP_TITLES, GalleryTagGroup, GalleryTagOption } from './tagUtils';

type GalleryTagFilterProps = {
  tagOptions: GalleryTagOption[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
};

type GroupedTags = Record<GalleryTagGroup, GalleryTagOption[]>;

const GROUP_ORDER: GalleryTagGroup[] = ['artist', 'source', 'character', 'other'];

const makeGroupedTags = (tagOptions: GalleryTagOption[], activeTags: string[]): GroupedTags => {
  const activeSet = new Set(activeTags);
  const base: GroupedTags = {
    artist: [],
    source: [],
    character: [],
    other: [],
  };

  for (const option of tagOptions) {
    base[option.group].push(option);
  }

  for (const group of GROUP_ORDER) {
    base[group].sort((left, right) => {
      const leftActive = activeSet.has(left.tag) ? 1 : 0;
      const rightActive = activeSet.has(right.tag) ? 1 : 0;
      if (leftActive !== rightActive) {
        return rightActive - leftActive;
      }

      const labelDelta = left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
      if (labelDelta !== 0) {
        return labelDelta;
      }

      return left.tag.localeCompare(right.tag);
    });
  }

  return base;
};

export const GalleryTagFilter = ({ tagOptions, activeTags, onToggleTag, onClearFilters }: GalleryTagFilterProps) => {
  const { isDarkMode } = useContext(ConfigurationContext);
  const activeSet = useMemo(() => new Set(activeTags), [activeTags]);
  const groupedTags = useMemo(() => makeGroupedTags(tagOptions, activeTags), [activeTags, tagOptions]);

  return (
    <aside
      className={`w-full rounded-2xl border p-4 shadow-sm backdrop-blur-sm ${
        isDarkMode ? 'border-slate-700 bg-slate-900/90' : 'border-slate-200 bg-white/90'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Filter Artworks</h2>
        <button
          type="button"
          onClick={onClearFilters}
          disabled={activeTags.length === 0}
          className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
            isDarkMode
              ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
              : 'border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Clear
        </button>
      </div>

      <div className="flex flex-col gap-4 max-h-[calc(100vh-180px)] overflow-auto pr-1">
        {GROUP_ORDER.map((group) => {
          const tags = groupedTags[group];
          if (tags.length === 0) {
            return null;
          }

          const showSingleSelectHint = group === 'artist' || group === 'source';

          return (
            <section key={group}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className={`text-[11px] font-bold tracking-[0.18em] uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {GALLERY_TAG_GROUP_TITLES[group]}
                </h3>
                {showSingleSelectHint ? (
                  <span className={`text-[9px] font-semibold tracking-[0.08em] uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Max 1
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map(({ tag, label }) => {
                  const active = activeSet.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleTag(tag)}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 ${
                        active
                          ? 'border-[#872341] bg-[#872341] text-white shadow-sm scale-[1.02]'
                          : isDarkMode
                            ? 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
};
