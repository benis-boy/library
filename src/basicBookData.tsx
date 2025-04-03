import basicBookData from './basicBookData.json';
import { SourceType } from './constants';

export type BasicBookData = {
  id: SourceType;
  title: string;
  assetId: string;
  assetIdBack?: string;
  wordCountData: string;
  lastUpdate: string;
  isReady: boolean;
};

export default basicBookData as BasicBookData[];
