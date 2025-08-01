import { useContext, useState } from 'react';
import basicBookData from '../../basicBookData';
import { LibraryContext } from '../../context/LibraryContext';
import { useBookSelection } from './abstracts';
import WtDRDescription from './WtDRDescription';
import { AmazonBuyButton } from '../general/AmazonButton';

const WtDRBookDashboardTile = ({ smallView }: { smallView: boolean }) => {
  const lContext = useContext(LibraryContext);
  const { setSelectedBook, libraryData } = lContext || { libraryData: {} };
  const bbd = basicBookData.find((bbd) => bbd.id === 'WtDR')!;
  const isSelected = libraryData.selectedBook === bbd.id;
  const { hasStartedReading, isLargeScreen, isSmallTile } = useBookSelection({ bbd, smallView });

  const [_isFlipped, setIsFlipped] = useState(false);
  const isFlipped = _isFlipped && !isSmallTile;

  return (
    <div
      key={bbd.id}
      className={`shadow-lg rounded-lg relative overflow-hidden transform transition-all 
        duration-300 hover:scale-105 hover:shadow-2xl flex flex-col ${isSelected ? 'border border-blue-500' : ''}
        ${isFlipped ? `${isLargeScreen ? 'w-auto' : 'max-w-72'} h-min` : 'w-72'}
        `}
      onClick={() => {
        setSelectedBook?.(bbd.id, false);
      }}
    >
      <button
        className={`absolute top-2 ${isLargeScreen ? 'left-2' : 'right-2'} p-1 rounded-full hover:bg-white/50 z-10 outline-1 outline-white/80`}
        onClick={(e) => {
          e.stopPropagation();
          setIsFlipped((old) => !old);
        }}
        aria-label="Flip card"
      >
        {isFlipped ? (
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF">
            <path d="M360-280q-33 0-56.5-23.5T280-360v-400q0-33 23.5-56.5T360-840h400q33 0 56.5 23.5T840-760v400q0 33-23.5 56.5T760-280H360Zm0-80h400v-400H360v400ZM200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm160 480v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 0v-80h80v80h-80Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF">
            <path d="M200-120q-33 0-56.5-23.5T120-200v-480h80v480h480v80H200Zm160-240v80q-33 0-56.5-23.5T280-360h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm80-160h-80q0-33 23.5-56.5T360-840v80Zm80 480v-80h80v80h-80Zm0-480v-80h80v80h-80Zm160 0v-80h80v80h-80Zm0 480v-80h80v80h-80Zm160-480v-80q33 0 56.5 23.5T840-760h-80Zm0 400h80q0 33-23.5 56.5T760-280v-80Zm0-80v-80h80v80h-80Zm0-160v-80h80v80h-80Z" />
          </svg>
        )}
      </button>
      <div className={`${isSmallTile || (isFlipped && isLargeScreen) ? '' : 'flex-col'} flex`}>
        <img
          src={isFlipped ? bbd.assetIdBack : bbd.assetId}
          alt={bbd.title}
          className={isSmallTile ? 'w-[6rem] h-[8rem]' : 'w-72 h-96'}
          loading="lazy"
        />
        <div className="p-2 text-center flex-grow flex flex-col">
          {!isFlipped ? <h2 className="font-bold my-2">{bbd.title}</h2> : <></>}
          {!isFlipped ? (
            <div className="flex flex-grow flex-col">
              <div className="flex flex-grow flex-row text-center">
                <p className={`${isSmallTile ? 'text-xs' : 'text-base'} flex-grow`}>{bbd.wordCountData}</p>
                <p className={`${isSmallTile ? 'text-xs' : 'text-base'} flex-grow`}>{bbd.lastUpdate}</p>
              </div>
              {!isSmallTile && bbd.isReady && (
                <div
                  className="flex flex-grow flex-col items-center justify-center"
                  onClick={!isLargeScreen ? (e) => e.stopPropagation() : undefined}
                >
                  <button
                    onClick={() => {
                      setSelectedBook?.(bbd.id, true);
                    }}
                    className="px-4 my-2 py-1 bg-[#872341] hover:scale-105 text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
                  >
                    {hasStartedReading ? 'Continue where you left off' : 'Start Reading'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <WtDRDescription />
              {!isFlipped ? (
                <></>
              ) : (
                <div className={`flex flex-grow px-4 pt-1 items-end ${isLargeScreen ? 'justify-end' : 'justify-center'}`}>
                  <AmazonBuyButton asin="3911949014" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WtDRBookDashboardTile;
