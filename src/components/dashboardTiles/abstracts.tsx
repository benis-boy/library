import { useMediaQuery, useTheme } from '@mui/material';
import { useContext, useState, type Dispatch, type MouseEvent, type ReactNode, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import basicBookData, { BasicBookData } from '../../basicBookData';
import { SourceType } from '../../constants';
import {
  getReaderRoute,
  getReaderRouteForChapter,
  getStoredChapterSelection,
  getStoredSelectedChapter,
  LibraryContext,
  LibraryContextType,
} from '../../context/LibraryContext';

const readButtonClassName =
  'px-4 my-2 py-1 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50';

const getBookData = (bookId: SourceType) => basicBookData.find((bbd) => bbd.id === bookId)!;

const useBookSelection = ({
  bookId,
  isSelected,
  smallView,
}: {
  bookId: SourceType;
  isSelected: boolean;
  smallView: boolean;
}) => {
  const hasStartedReading = getStoredSelectedChapter(bookId);
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('sm'));
  const isSmallTile = smallView && !isLargeScreen && !isSelected;

  return {
    hasStartedReading,
    isLargeScreen,
    isSmallTile,
  };
};

const useBookDashboardTile = ({ bookId, smallView }: { bookId: SourceType; smallView: boolean }) => {
  const navigate = useNavigate();
  const lContext = useContext(LibraryContext);
  const { setSelectedBook, libraryData } = lContext || { libraryData: {} as LibraryContextType['libraryData'] };
  const bbd = getBookData(bookId);
  const isSelected = libraryData.selectedBook === bbd.id;
  const { hasStartedReading, isLargeScreen, isSmallTile } = useBookSelection({ bookId, isSelected, smallView });

  const handleSelectTile = async () => {
    await setSelectedBook?.(bbd.id, false);
    navigate('/');
  };

  const handleStartReading = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const result = await setSelectedBook?.(bbd.id, true);
    if (!result) {
      return;
    }

    const storedChapter = getStoredChapterSelection(bbd.id);
    const targetRoute = storedChapter
      ? await getReaderRouteForChapter(bbd.id, storedChapter).catch(() => getReaderRoute(bbd.id, storedChapter))
      : getReaderRoute(bbd.id);
    navigate(targetRoute);
  };

  return {
    bbd,
    hasStartedReading,
    isLargeScreen,
    isSelected,
    isSmallTile,
    handleSelectTile,
    handleStartReading,
  };
};

export const BookTileStatsRow = ({ bbd, isSmallTile }: { bbd: BasicBookData; isSmallTile: boolean }) => {
  return (
    <div className="flex flex-grow flex-row text-center">
      <p className={`${isSmallTile ? 'text-xs' : 'text-base'} flex-grow`}>{bbd.wordCountData}</p>
      <p className={`${isSmallTile ? 'text-xs' : 'text-base'} flex-grow`}>{bbd.lastUpdate}</p>
    </div>
  );
};

export const BookTileReadAction = ({
  hasStartedReading,
  isLargeScreen,
  onClick,
}: {
  hasStartedReading: string | undefined;
  isLargeScreen: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => Promise<void>;
}) => {
  return (
    <div
      className="flex flex-grow flex-col items-center justify-center"
      onClick={!isLargeScreen ? (event) => event.stopPropagation() : undefined}
    >
      <button onClick={onClick} className={readButtonClassName}>
        {hasStartedReading ? 'Continue where you left off' : 'Start Reading'}
      </button>
    </div>
  );
};

type FlipBookDashboardTileRenderArgs = ReturnType<typeof useBookDashboardTile> & {
  isFlipped: boolean;
  setIsFlipped: Dispatch<SetStateAction<boolean>>;
};

const FlipCardButtonIcon = ({ isFlipped }: { isFlipped: boolean }) => {
  if (isFlipped) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF">
        <path d="M360-280q-33 0-56.5-23.5T280-360v-400q0-33 23.5-56.5T360-840h400q33 0 56.5 23.5T840-760v400q0 33-23.5 56.5T760-280H360Zm0-80h400v-400H360v400ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm160 480v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Z" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF">
      <path d="M200-120q-33 0-56.5-23.5T120-200v-480h80v480h480v80H200Zm160-240v80q-33 0-56.5-23.5T280-360h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm80-160h-80q0-33 23.5-56.5T360-840v80Zm80 480v-80h80v80h-80Zm0-480v-80h80v80h-80Zm160 0v-80h80v80h-80Zm0 480v-80h80v80h-80Zm160-480v-80q33 0 56.5 23.5T840-760h-80Zm0 400h80q0 33-23.5 56.5T760-280v-80Zm0-80v-80h80v80h-80Zm0-160v-80h80v80h-80Z" />
    </svg>
  );
};

export const FlipBookDashboardTile = ({
  bookId,
  smallView,
  renderFront,
  renderBack,
}: {
  bookId: SourceType;
  smallView: boolean;
  renderFront: (args: FlipBookDashboardTileRenderArgs) => ReactNode;
  renderBack?: (args: FlipBookDashboardTileRenderArgs) => ReactNode;
}) => {
  const tile = useBookDashboardTile({ bookId, smallView });
  const { bbd, isLargeScreen, isSelected, isSmallTile, handleSelectTile } = tile;
  const [_isFlipped, setIsFlipped] = useState(false);
  const hasBackContent = !!renderBack;
  const isFlipped = hasBackContent && _isFlipped && !isSmallTile;
  const renderArgs: FlipBookDashboardTileRenderArgs = {
    ...tile,
    isFlipped,
    setIsFlipped,
  };

  return (
    <div
      key={bbd.id}
      className={`shadow-lg rounded-lg relative overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl flex flex-col ${isSelected ? 'border border-blue-500' : ''} ${isFlipped ? `${isLargeScreen ? 'w-auto' : 'max-w-72'} h-min` : 'w-72'}`}
      onClick={handleSelectTile}
    >
      {hasBackContent && (
        <button
          className={`absolute top-2 ${isLargeScreen ? 'left-2' : 'right-2'} p-1 rounded-full hover:bg-white/50 z-10 outline-1 outline-white/80`}
          onClick={(event) => {
            event.stopPropagation();
            setIsFlipped((old) => !old);
          }}
          aria-label="Flip card"
        >
          <FlipCardButtonIcon isFlipped={isFlipped} />
        </button>
      )}
      <div className={`${isSmallTile || (isFlipped && isLargeScreen) ? '' : 'flex-col'} flex`}>
        <img
          src={isFlipped ? bbd.assetIdBack ?? bbd.assetId : bbd.assetId}
          alt={bbd.title}
          className={isSmallTile ? 'w-[6rem] h-[8rem]' : 'w-72 h-96'}
          loading="lazy"
        />
        <div className="p-2 text-center flex-grow flex flex-col">
          {!isFlipped ? <h2 className="font-bold my-2">{bbd.title}</h2> : <></>}
          {!isFlipped ? renderFront(renderArgs) : renderBack?.(renderArgs)}
        </div>
      </div>
    </div>
  );
};

export const DefaultBookDashboardTile = ({ bookId, smallView }: { bookId: SourceType; smallView: boolean }) => {
  return (
    <FlipBookDashboardTile
      bookId={bookId}
      smallView={smallView}
      renderFront={({ bbd, hasStartedReading, isLargeScreen, isSmallTile, handleStartReading }) => (
        <div className="flex flex-grow flex-col">
          <BookTileStatsRow bbd={bbd} isSmallTile={isSmallTile} />
          {!isSmallTile && bbd.isReady && (
            <BookTileReadAction
              hasStartedReading={hasStartedReading}
              isLargeScreen={isLargeScreen}
              onClick={handleStartReading}
            />
          )}
        </div>
      )}
    />
  );
};
