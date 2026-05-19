import { DefaultBookDashboardTile } from './abstracts';

const PSSJBookDashboardTile = ({ smallView }: { smallView: boolean }) => {
  return <DefaultBookDashboardTile bookId="PSSJ" smallView={smallView} />;
};

export default PSSJBookDashboardTile;
