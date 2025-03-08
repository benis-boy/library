import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Switch,
  Typography,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select/SelectInput';
import { useContext } from 'react';
import { ConfigurationContext } from '../context/ConfigurationContext';

export const ConfigurationView = () => {
  const { isDarkMode, setIsDarkMode, selectedFont, setSelectedFont, fontSize, setFontSize, whiteTone, setWhiteTone } =
    useContext(ConfigurationContext);

  const handleFontChange = (event: SelectChangeEvent<string>) => {
    setSelectedFont(event.target.value as string);
  };

  const handleFontSizeChange = (_: Event, value: number | number[]) => {
    setFontSize(value as number);
  };

  const handleWhiteToneChange = (_: Event, newValue: number | number[]) => {
    const hexValue = newValue.toString(16);
    setWhiteTone(`#${hexValue.repeat(6)}`); // Update the whiteTone string
  };

  const handleClearLocalFiles = () => {
    try {
      localStorage.clear();
      console.info('Local storage cleared successfully!');
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  };

  console.log(whiteTone);

  const style = { fontSize, marginBottom: '16px', fontFamily: selectedFont, color: isDarkMode ? whiteTone : 'black' };

  return (
    <Box display={'flex'} flexGrow={1} p={2}>
      {/* Controls: dark/light, font selector, and font size slider */}
      <Box alignItems="center" mb={2}>
        <div className="flex">
          <FormControlLabel
            labelPlacement="bottom"
            control={<Switch checked={isDarkMode} onChange={() => setIsDarkMode((prev) => !prev)} />}
            label="Dark Mode"
          />
          <div className="flex flex-grow flex-col gap-4">
            <FormControl
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { color: isDarkMode ? 'white' : 'black' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: isDarkMode ? 'white' : 'black' },
                  '&:hover fieldset': { borderColor: isDarkMode ? 'white' : 'black' },
                  '&.Mui-focused fieldset': { borderColor: isDarkMode ? 'white' : 'black' },
                },
                '& .MuiSvgIcon-root': { color: isDarkMode ? 'white' : 'black' },
                '& .MuiSelect-select': { color: isDarkMode ? 'white' : 'black' },
              }}
            >
              <InputLabel>Font</InputLabel>
              <Select value={selectedFont} label="Font" onChange={handleFontChange}>
                <MenuItem value="Arial">Arial</MenuItem>
                <MenuItem value="Lexend">Lexend</MenuItem>
                <MenuItem value="Georgia">Georgia</MenuItem>
                <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                <MenuItem value="Courier New">Courier New</MenuItem>
              </Select>
            </FormControl>
            <Box ml={2} height={100} display="flex" flexDirection="column" alignItems="center">
              <Slider
                orientation="horizontal"
                value={fontSize}
                onChange={handleFontSizeChange}
                aria-labelledby="font-size-slider"
                min={10}
                max={24}
              />
              <Typography variant="caption">Font Size</Typography>
            </Box>
            {isDarkMode ? (
              <Box
                ml={2}
                height={100}
                display="flex"
                flexDirection="column"
                alignItems="center"
                sx={{
                  border: 'thin',
                  borderColor: 'white',
                }}
              >
                <Slider
                  orientation="horizontal"
                  value={parseInt(whiteTone.replace('#', '').charAt(0), 16)}
                  onChange={handleWhiteToneChange}
                  aria-labelledby="white-tone-slider"
                  min={8} // Corresponds to #8
                  max={15} // Corresponds to #f
                  step={1}
                  valueLabelDisplay="auto"
                  getAriaValueText={(value) => `#${value.toString(16).repeat(3)}`} // Generates hex codes dynamically
                />
                <Typography variant="caption">Dark Mode Font Color Intensity</Typography>
              </Box>
            ) : (
              <></>
            )}
          </div>
        </div>

        <Box mb={2}>
          <Button variant="contained" color="error" onClick={handleClearLocalFiles}>
            Clear Local Files (Debug)
          </Button>
        </Box>

        <Box sx={{ flexDirection: 'column' }} display="flex">
          <Typography style={style}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla iaculis risus ac semper porta. Proin sit amet
            pulvinar magna. Curabitur a justo ac leo sollicitudin venenatis.
          </Typography>
          <Typography style={style}>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem
            aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem
            aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
          </Typography>
          <Typography style={style}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla iaculis risus ac semper porta. Proin sit amet
            pulvinar magna. Curabitur a justo ac leo sollicitudin venenatis.
          </Typography>
          <Typography style={style}>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem
            aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem
            aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
          </Typography>
          <Typography style={style}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla iaculis risus ac semper porta. Proin sit amet
            pulvinar magna. Curabitur a justo ac leo sollicitudin venenatis.
          </Typography>
          <Typography style={style}>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem
            aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem
            aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
