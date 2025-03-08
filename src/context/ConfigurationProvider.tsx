import React, { ReactNode, useEffect, useState } from 'react';
import { ConfigurationContext } from './ConfigurationContext';
import { Box } from '@mui/material';

export const ConfigurationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('config_isDarkMode');
    return stored ? JSON.parse(stored) : false;
  });

  const [selectedFont, setSelectedFont] = useState<string>(() => {
    const stored = localStorage.getItem('config_selectedFont');
    return stored || 'Lexend';
  });

  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem('config_fontSize');
    return stored ? JSON.parse(stored) : 17;
  });

  const [whiteTone, setWhiteTone] = useState<string>(() => {
    const stored = localStorage.getItem('config_whiteTone');
    return stored || '#d';
  });

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
