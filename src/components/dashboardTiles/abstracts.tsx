import { useMediaQuery, useTheme } from '@mui/material';
import { useContext } from 'react';
import { BasicBookData } from '../../basicBookData';
import { SourceType } from '../../constants';
import { LibraryContext } from '../../context/LibraryContext';

export const useBookSelection = ({
  bbd,
  selected,
  smallView,
}: {
  bbd: BasicBookData;
  selected: SourceType | undefined;
  smallView: boolean;
}) => {
  const lContext = useContext(LibraryContext);
  const { setSelectedBook } = lContext || { libraryData: {} };

  const hasStartedReading = localStorage.getItem(`${bbd.id}_SELECTED_CHAPTER`) || undefined;
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));
  const isSelected = selected === bbd.id;
  const isSmallTile = smallView && !isLargeScreen && !isSelected;

  return {
    setSelectedBook,
    hasStartedReading,
    isLargeScreen,
    isSelected,
    isSmallTile,
  };
};
