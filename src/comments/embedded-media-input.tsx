import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [validatedUrl, setValidatedUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedUrl = normalizeImageUrl(url);
    setValidatedUrl(null);
    setError(null);

    if (!open || !normalizedUrl) {
      setChecking(false);
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
  }, [open, url]);

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
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <img src={imageInputUrl} alt="" className="h-5 w-5" aria-hidden="true" />
      </button>

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>Attach image</DialogTitle>
        <DialogContent className="space-y-4">
          <DialogContentText>Paste an image or GIF URL to attach it to your comment.</DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Image URL"
            value={url}
            disabled={disabled}
            error={Boolean(error)}
            helperText={error || (checking ? 'Checking image...' : ' ')}
            onChange={(event) => setUrl(event.target.value)}
          />
          {validatedUrl ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={validatedUrl}
                alt="Attachment preview"
                className="mx-auto max-h-72 max-w-full rounded-lg object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cancel</Button>
          <Button variant="contained" onClick={attach} disabled={!validatedUrl || checking}>
            Attach
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
