import { DialogProps } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

type AppDialogSlotPropsOptions = {
  isDarkMode: boolean;
  zIndex?: number;
  paperClassName?: string;
  paperAriaLabel?: string;
  paperSx?: SxProps<Theme>;
  backdropSx?: SxProps<Theme>;
};

const combineSx = (...styles: Array<SxProps<Theme> | undefined>): SxProps<Theme> | undefined => {
  const definedStyles = styles.filter((style): style is SxProps<Theme> => style !== undefined);
  if (definedStyles.length === 0) {
    return undefined;
  }

  if (definedStyles.length === 1) {
    return definedStyles[0];
  }

  return definedStyles as SxProps<Theme>;
};

export const getAppDialogSlotProps = ({
  isDarkMode,
  zIndex,
  paperClassName,
  paperAriaLabel,
  paperSx,
  backdropSx,
}: AppDialogSlotPropsOptions): DialogProps['slotProps'] => ({
  root: zIndex === undefined ? undefined : { sx: { zIndex } },
  paper: {
    className: paperClassName,
    'aria-label': paperAriaLabel,
    sx: combineSx(
      isDarkMode
        ? {
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            color: '#f1f5f9',
          }
        : undefined,
      paperSx
    ),
  } as NonNullable<DialogProps['slotProps']>['paper'],
  backdrop: {
    sx: combineSx(isDarkMode ? { backgroundColor: 'rgba(0, 0, 0, 0.7)' } : undefined, backdropSx),
  },
});
