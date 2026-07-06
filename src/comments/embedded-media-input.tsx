import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { ConfigurationContext } from '../context/ConfigurationContext';
import { COMMENT_MEDIA_URL_MAX_LENGTH } from './dataModel';
import imageInputUrl from './image-input.svg';

type EmbeddedMediaInputProps = {
  disabled?: boolean;
  onAttach: (imageUrl: string) => void;
};

const URL_CHECK_DEBOUNCE_MS = 500;

const normalizeImageUrl = (value: string) => value.trim();

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const probeImageLoad = (imageUrl: string) => {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = imageUrl;
  });
};

export const EmbeddedMediaInput = ({ disabled = false, onAttach }: EmbeddedMediaInputProps) => {
  const { isDarkMode } = useContext(ConfigurationContext);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [validatedUrl, setValidatedUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedUrl = normalizeImageUrl(url);
  const isUrlLimitVisible = normalizedUrl.length >= COMMENT_MEDIA_URL_MAX_LENGTH;
  const isUrlOverLimit = normalizedUrl.length > COMMENT_MEDIA_URL_MAX_LENGTH;

  useEffect(() => {
    setValidatedUrl(null);
    setError(null);

    if (!open || !normalizedUrl) {
      setChecking(false);
      return;
    }

    if (isUrlOverLimit) {
      setChecking(false);
      setError(`URL must be ${COMMENT_MEDIA_URL_MAX_LENGTH} characters or fewer.`);
      return;
    }

    if (!isValidHttpUrl(normalizedUrl)) {
      setChecking(false);
      setError('Enter a valid http(s) URL.');
      return;
    }

    let cancelled = false;
    setChecking(true);

    const timeoutId = window.setTimeout(() => {
      const validate = async () => {
        const canEmbedImage = await probeImageLoad(normalizedUrl);
        if (cancelled) {
          return;
        }

        if (canEmbedImage) {
          setValidatedUrl(normalizedUrl);
        } else {
          setError('Could not load image preview.');
        }

        if (!cancelled) {
          setChecking(false);
        }
      };

      void validate();
    }, URL_CHECK_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isUrlOverLimit, normalizedUrl, open]);

  const close = () => {
    setOpen(false);
    setUrl('');
    setValidatedUrl(null);
    setChecking(false);
    setError(null);
  };

  const attach = () => {
    if (!validatedUrl) {
      return;
    }

    onAttach(validatedUrl);
    close();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Attach image"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
        }`}
      >
        <img src={imageInputUrl} alt="" className={`h-5 w-5 ${isDarkMode ? 'invert' : ''}`} aria-hidden="true" />
      </button>

      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: isDarkMode
              ? {
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f1f5f9',
                }
              : undefined,
          },
          backdrop: {
            sx: isDarkMode ? { backgroundColor: 'rgba(0, 0, 0, 0.7)' } : undefined,
          },
        }}
      >
        <DialogTitle sx={isDarkMode ? { color: '#f1f5f9' } : undefined}>Attach image</DialogTitle>
        <DialogContent className="space-y-4" sx={isDarkMode ? { color: '#cbd5e1' } : undefined}>
          <DialogContentText sx={isDarkMode ? { color: '#cbd5e1' } : undefined}>
            Paste an image or GIF URL to attach it to your comment.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Image URL"
            value={url}
            disabled={disabled}
            error={Boolean(error)}
            helperText={error || (checking ? 'Checking image...' : isUrlLimitVisible ? `${normalizedUrl.length}/${COMMENT_MEDIA_URL_MAX_LENGTH} characters` : ' ')}
            onChange={(event) => setUrl(event.target.value)}
            InputLabelProps={{ className: isDarkMode ? 'text-slate-300' : undefined }}
            FormHelperTextProps={{ className: isDarkMode ? 'text-slate-400' : undefined }}
            InputProps={{
              className: isDarkMode ? 'text-slate-100' : undefined,
            }}
            sx={
              isDarkMode
                ? {
                    '& .MuiInputBase-root': { backgroundColor: '#0f172a', color: '#f1f5f9' },
                    '& .MuiInputBase-input': { color: '#f1f5f9' },
                    '& .MuiInputLabel-root': { color: '#cbd5e1' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#e2e8f0' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                    '& .MuiFormHelperText-root': { color: error ? '#fca5a5' : '#94a3b8' },
                  }
                : undefined
            }
          />
          {validatedUrl ? (
            <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
              <img
                src={validatedUrl}
                alt="Attachment preview"
                className="mx-auto max-h-72 max-w-full rounded-lg object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
        <DialogActions
          sx={
            isDarkMode
              ? {
                  backgroundColor: 'rgba(2, 6, 23, 0.4)',
                  borderTop: '1px solid #1e293b',
                }
              : undefined
          }
        >
          <Button onClick={close} sx={isDarkMode ? { color: '#cbd5e1', '&:hover': { backgroundColor: '#1e293b' } } : undefined}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={attach}
            disabled={!validatedUrl || checking || isUrlOverLimit}
            sx={
              isDarkMode
                ? {
                    backgroundColor: '#e2e8f0',
                    color: '#0f172a',
                    '&:hover': { backgroundColor: '#f8fafc' },
                    '&.Mui-disabled': { backgroundColor: '#334155', color: '#94a3b8' },
                  }
                : undefined
            }
          >
            Attach
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
