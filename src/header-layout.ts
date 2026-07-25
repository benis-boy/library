export const HEADER_HEIGHTS = {
  portrait: 80,
  default: 60,
  largeScreen: 50,
} as const;

export const HEADER_VISIBLE_SCROLLER_CLASSES =
  'max-h-[calc(100vh-60px)] lg:max-h-[calc(100vh-50px)] portrait:max-h-[calc(100vh-80px)] min-h-[calc(100vh-60px)] lg:min-h-[calc(100vh-50px)] portrait:min-h-[calc(100vh-80px)]';

export const HEADER_VISIBLE_TOP_PADDING_CLASSES = 'pt-[60px] lg:pt-[50px] portrait:pt-[80px]';

export const getHeaderHeight = ({ isPortrait, isLargeScreen }: { isPortrait: boolean; isLargeScreen: boolean }) => {
  if (isPortrait) {
    return HEADER_HEIGHTS.portrait;
  }

  if (isLargeScreen) {
    return HEADER_HEIGHTS.largeScreen;
  }

  return HEADER_HEIGHTS.default;
};

export const getHeaderHeightPx = (options: { isPortrait: boolean; isLargeScreen: boolean }) => `${getHeaderHeight(options)}px`;
