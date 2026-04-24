import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const EndOfBookMessage = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center',
        padding: 2,
      }}
    >
      <Typography variant="h4" gutterBottom>
        Congratulations (or not)! You've Reached the End of the Book 😭
      </Typography>
      <Typography variant="body1" gutterBottom>
        Thank you so much for reading! If you enjoyed the journey, please consider supporting my work and helping me
        create more stories.
      </Typography>
      <Typography variant="body1">
        You can support me and get exclusive content on my{' '}
        <button className="bg-[#872341] hover:bg-[#6e1f33] text-white font-bold py-2 px-4 mx-2 rounded-md transition-all duration-300 ease-in-out transform hover:scale-105">
          <a
            href="https://www.patreon.com/BenisBoy16"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline text-xl"
          >
            Support me on Patreon
          </a>
        </button>
      </Typography>
      <Typography variant="body1" gutterBottom>
        Or check out if I have added some other books yet.
      </Typography>
      <Button variant="contained" color="primary" onClick={() => navigate('/')}>
        Go to Home Page
      </Button>
    </Box>
  );
};

export default EndOfBookMessage;
