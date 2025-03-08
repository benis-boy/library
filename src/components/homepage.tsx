import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import SettingsIcon from '@mui/icons-material/Settings';
import { IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useContext, useState } from 'react';
import { LibraryContext } from '../context/LibraryContext';
import { SourceType } from '../constants';
import { basicBookData } from '../basicBookData';
import BookDashboardTile from './BookDashboardTile';
import { ConfigurationContext } from '../context/ConfigurationContext';

export const Homepage = () => {
  const { isDarkMode } = useContext(ConfigurationContext);
  const lContext = useContext(LibraryContext);
  const {
    libraryData: { selectedBook },
    otherPageInfo: { showOtherPage },
  } = lContext!;
  const [smallView, setSmallView] = useState<boolean>(true);
  const [selected, setSelected] = useState<SourceType | undefined>(selectedBook);
  // Define responsive styles
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));
  //   const isPortrait = useMediaQuery('(orientation: portrait)');

  if (!lContext) return <Fragment />;

  if (isLargeScreen && selected) setSelected(undefined);

  // TODO write another script into the pipeline that does the word-counts

  return (
    <div className="p-5 font-sans flex flex-col min-h-full w-full">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-3xl mb-0 sm:mb-5 font-bold">BenisBoy's Library</h1>
        <IconButton onClick={() => showOtherPage('configuration')}>
          <SettingsIcon sx={{ color: isDarkMode ? '#fff' : 'inherit' }} />
        </IconButton>
        {!isLargeScreen && (
          <IconButton onClick={() => setSmallView((old) => !old)} color="primary" aria-label="toggle tile mode">
            {smallView ? (
              <ViewListIcon sx={{ color: isDarkMode ? '#fff' : 'inherit' }} />
            ) : (
              <GridViewIcon sx={{ color: isDarkMode ? '#fff' : 'inherit' }} />
            )}
          </IconButton>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        {basicBookData.map((bbd) => {
          return (
            <BookDashboardTile
              bbd={bbd}
              selected={selected}
              setSelected={setSelected}
              smallView={smallView}
              key={bbd.id}
            />
          );
        })}
      </div>
      <div className="flex-grow" />
    </div>
  );
};
