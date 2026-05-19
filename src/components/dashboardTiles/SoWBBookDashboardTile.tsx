import { DefaultBookDashboardTile } from './abstracts';

const SoWBBookDashboardTile = ({ smallView }: { smallView: boolean }) => {
  return <DefaultBookDashboardTile bookId="SoWB" smallView={smallView} />;
};

export default SoWBBookDashboardTile;
