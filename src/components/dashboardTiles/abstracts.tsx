import { useMediaQuery, useTheme } from '@mui/material';
import { useContext } from 'react';
import { BasicBookData } from '../../basicBookData';
import { LibraryContext, LibraryContextType } from '../../context/LibraryContext';

export const useBookSelection = ({ bbd, smallView }: { bbd: BasicBookData; smallView: boolean }) => {
  const lContext = useContext(LibraryContext);
  const { libraryData } = lContext || { libraryData: {} as LibraryContextType['libraryData'] };

  const hasStartedReading = localStorage.getItem(`${bbd.id}_SELECTED_CHAPTER`) || undefined;
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));
  const isSelected = libraryData.selectedBook === bbd.id;
  const isSmallTile = smallView && !isLargeScreen && !isSelected;

  return {
    hasStartedReading,
    isLargeScreen,
    isSmallTile,
  };
};
