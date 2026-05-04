import { SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GalleryTagFilter } from './GalleryTagFilter';
import { buildGalleryTagQueryValue, GalleryTagOption, parseActiveGalleryTags, toggleGalleryTagSelection } from './tagUtils';

type GalleryNavigatorProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  ref: React.RefObject<HTMLDivElement | null>;
  isHeaderVisible: boolean;
  tagOptions: GalleryTagOption[];
};

export const GalleryNavigator = ({
  open,
  setOpen,
  ref,
  isHeaderVisible,
  tagOptions,
}: GalleryNavigatorProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));

  const activeTags = useMemo(() => parseActiveGalleryTags(searchParams), [searchParams]);

  const updateTagQuery = (nextTags: string[]) => {
    const nextParams = new URLSearchParams(searchParams);
    const queryValue = buildGalleryTagQueryValue(nextTags);
    if (queryValue) {
      nextParams.set('tags', queryValue);
    } else {
      nextParams.delete('tags');
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleToggleTag = (rawTag: string) => {
    updateTagQuery(toggleGalleryTagSelection(activeTags, rawTag));
  };

  const handleClearFilters = () => {
    if (activeTags.length === 0) {
      return;
    }
    updateTagQuery([]);
  };

  return (
    <SwipeableDrawer
      ref={ref}
      sx={{
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        width: 260,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          width: 260,
          boxSizing: 'border-box',
          borderRight: '1px solid #e2e8f0',
        },
      }}
      variant={hasTouch || !isLargeScreen ? 'temporary' : 'persistent'}
      anchor="left"
      open={open}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      swipeAreaWidth={60}
    >
      <div className={`transition-all duration-300 ${isHeaderVisible ? 'pt-[60px] lg:pt-[50px] portrait:pt-[80px]' : ''} h-full p-3`}>
        <GalleryTagFilter
          tagOptions={tagOptions}
          activeTags={activeTags}
          onToggleTag={handleToggleTag}
          onClearFilters={handleClearFilters}
        />
      </div>
    </SwipeableDrawer>
  );
};
