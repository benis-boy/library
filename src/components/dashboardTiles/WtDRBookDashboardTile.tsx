import WtDRDescription from './WtDRDescription';
import { AmazonBuyButton } from '../general/AmazonButton';
import { BookTileReadAction, BookTileStatsRow, FlipBookDashboardTile } from './abstracts';

const WtDRBookDashboardTile = ({ smallView }: { smallView: boolean }) => {
  return (
    <FlipBookDashboardTile
      bookId="WtDR"
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
      renderBack={({ isLargeScreen }) => (
        <div>
          <WtDRDescription />
          <div className={`flex flex-grow px-4 pt-1 items-end ${isLargeScreen ? 'justify-end' : 'justify-center'}`}>
            <AmazonBuyButton asin="3911949014" />
          </div>
        </div>
      )}
    />
  );
};

export default WtDRBookDashboardTile;
