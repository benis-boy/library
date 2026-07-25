import React, { ReactNode, useEffect, useState } from 'react';
import { ConfigurationContext } from './ConfigurationContext';
import { Box } from '@mui/material';
import { APP_STORAGE_CLEARED_EVENT } from '../localStorageReset';
import {
  getStoredConfig,
  setStoredFontSize,
  setStoredIsDarkMode,
  setStoredSelectedFont,
  setStoredWhiteTone,
} from '../storage/appStorage';

export const ConfigurationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initialConfig = getStoredConfig();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(initialConfig.isDarkMode);
  const [selectedFont, setSelectedFont] = useState<string>(initialConfig.selectedFont);
  const [fontSize, setFontSize] = useState<number>(initialConfig.fontSize);
  const [whiteTone, setWhiteTone] = useState<string>(initialConfig.whiteTone);

  useEffect(() => {
    const handleAppStorageCleared = () => {
      const config = getStoredConfig();
      setIsDarkMode(config.isDarkMode);
      setSelectedFont(config.selectedFont);
      setFontSize(config.fontSize);
      setWhiteTone(config.whiteTone);
    };

    window.addEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    return () => {
      window.removeEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    };
  }, []);

  useEffect(() => {
    setStoredIsDarkMode(isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    setStoredSelectedFont(selectedFont);
  }, [selectedFont]);

  useEffect(() => {
    setStoredFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    setStoredWhiteTone(whiteTone);
  }, [whiteTone]);

  return (
    <ConfigurationContext.Provider
      value={{
        isDarkMode,
        setIsDarkMode,
        selectedFont,
        setSelectedFont,
        fontSize,
        setFontSize,
        whiteTone,
        setWhiteTone,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          backgroundColor: isDarkMode ? '#09122C' : 'white',
          color: isDarkMode ? 'white' : 'black',
        }}
      >
        {children}
      </Box>
    </ConfigurationContext.Provider>
  );
};
