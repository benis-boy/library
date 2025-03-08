import { createContext } from 'react';

interface IConfigurationContext {
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedFont: string;
  setSelectedFont: React.Dispatch<React.SetStateAction<string>>;
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  whiteTone: string;
  setWhiteTone: React.Dispatch<React.SetStateAction<string>>;
}

export const ConfigurationContext = createContext<IConfigurationContext>({
  isDarkMode: false,
  setIsDarkMode: () => {},
  selectedFont: 'Arial',
  setSelectedFont: () => {},
  fontSize: 16,
  setFontSize: () => {},
  whiteTone: '#d',
  setWhiteTone: () => {},
});
