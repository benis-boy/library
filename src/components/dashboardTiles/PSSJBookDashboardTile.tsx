import { useContext } from 'react';
import basicBookData from '../../basicBookData';
import { LibraryContext } from '../../context/LibraryContext';
import { useBookSelection } from './abstracts';

const PSSJBookDashboardTile = ({ smallView }: { smallView: boolean }) => {
  const lContext = useContext(LibraryContext);
  const { setSelectedBook, libraryData } = lContext || { libraryData: {} };
  const bbd = basicBookData.find((bbd) => bbd.id === 'PSSJ')!;
  const isSelected = libraryData.selectedBook === bbd.id;
  const { hasStartedReading, isLargeScreen, isSmallTile } = useBookSelection({ bbd, smallView });

  return (
    <div
      key={bbd.id}
      className={`shadow-lg rounded-lg overflow-hidden transform transition-all duration-300 w-72 hover:scale-105 hover:shadow-2xl flex ${isSelected ? 'border border-blue-500' : ''}`}
      onClick={() => {
        setSelectedBook?.(bbd.id, false);
      }}
    >
      <div className={`${isSmallTile ? '' : ' flex-col'} flex`}>
        <img
          src={bbd.assetId}
          alt={bbd.title}
          className={isSmallTile ? 'w-[6rem] h-[8rem]' : 'w-72 h-96'}
          loading="lazy"
        />
        <div className="p-2 text-center flex-grow flex flex-col">
          <h2 className="font-bold my-2">{bbd.title}</h2>
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
        </div>
      </div>
    </div>
  );
};

export default PSSJBookDashboardTile;
