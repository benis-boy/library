import React, { ReactNode, useEffect, useState } from 'react';
import { ConfigurationContext } from './ConfigurationContext';
import { Box } from '@mui/material';
import { APP_STORAGE_CLEARED_EVENT } from '../localStorageReset';

const DEFAULT_IS_DARK_MODE = false;
const DEFAULT_SELECTED_FONT = 'Lexend';
const DEFAULT_FONT_SIZE = 17;
const DEFAULT_WHITE_TONE = '#d';

export const ConfigurationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('config_isDarkMode');
    return stored ? JSON.parse(stored) : DEFAULT_IS_DARK_MODE;
  });

  const [selectedFont, setSelectedFont] = useState<string>(() => {
    const stored = localStorage.getItem('config_selectedFont');
    return stored || DEFAULT_SELECTED_FONT;
  });

  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem('config_fontSize');
    return stored ? JSON.parse(stored) : DEFAULT_FONT_SIZE;
  });

  const [whiteTone, setWhiteTone] = useState<string>(() => {
    const stored = localStorage.getItem('config_whiteTone');
    return stored || DEFAULT_WHITE_TONE;
  });

  useEffect(() => {
    const handleAppStorageCleared = () => {
      setIsDarkMode(DEFAULT_IS_DARK_MODE);
      setSelectedFont(DEFAULT_SELECTED_FONT);
      setFontSize(DEFAULT_FONT_SIZE);
      setWhiteTone(DEFAULT_WHITE_TONE);
    };

    window.addEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    return () => {
      window.removeEventListener(APP_STORAGE_CLEARED_EVENT, handleAppStorageCleared);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('config_isDarkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('config_selectedFont', selectedFont);
  }, [selectedFont]);

  useEffect(() => {
    localStorage.setItem('config_fontSize', JSON.stringify(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('config_whiteTone', whiteTone);
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
