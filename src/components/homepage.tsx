import GridViewIcon from '@mui/icons-material/GridView';
import SettingsIcon from '@mui/icons-material/Settings';
import ViewListIcon from '@mui/icons-material/ViewList';
import { IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useContext, useState } from 'react';
import { ConfigurationContext } from '../context/ConfigurationContext';
import { LibraryContext } from '../context/LibraryContext';
import PSSJBookDashboardTile from './dashboardTiles/PSSJBookDashboardTile';
import WtDRBookDashboardTile from './dashboardTiles/WtDRBookDashboardTile';

export const Homepage = () => {
  const { isDarkMode } = useContext(ConfigurationContext);
  const lContext = useContext(LibraryContext);
  const {
    otherPageInfo: { showOtherPage },
  } = lContext!;
  const [smallView, setSmallView] = useState<boolean>(true);
  // Define responsive styles
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));

  if (!lContext) return <Fragment />;

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
        <PSSJBookDashboardTile smallView={smallView} />
        <WtDRBookDashboardTile smallView={smallView} />
      </div>
      <div className="flex-grow min-h-10" />
    </div>
  );
};
