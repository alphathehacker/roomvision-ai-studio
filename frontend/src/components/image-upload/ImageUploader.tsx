import { useCallback, useRef, useState } from 'react';
import { UploadCloud, ImagePlus, X, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { formatBytes } from '../../utils/common';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

interface ImageUploaderProps {
  open: boolean;
  onClose: () => void;
  onSelect: (blob: Blob) => void;
}

function validateFile(file: File): string | null {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXT.includes(ext)) {
    return 'Unsupported file type. Please choose a JPEG, PNG, or WebP image.';
  }
  if (file.size > MAX_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Image is too large (${mb} MB). Please choose an image under 15 MB.`;
  }
  return null;
}

export function ImageUploader({ open, onClose, onSelect }: ImageUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setError(null);
    setDecoding(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const takeFile = useCallback(
    (f: File) => {
      const problem = validateFile(f);
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      setFile(f);
      setPreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return URL.createObjectURL(f);
      });
    },
    [],
  );

  const handleUsePhoto = () => {
    if (!file) return;
    setDecoding(true);
    // Decode once here so failures surface before the editor opens.
    createImageBitmap(file)
      .then((bmp) => {
        bmp.close();
        onSelect(file);
        reset();
      })
      .catch(() => {
        setDecoding(false);
        setError('That image could not be decoded. Please try a different file.');
      });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Upload a room photo"
      description="Your photo is processed locally in your browser and never uploaded anywhere."
      className="sm:max-w-2xl"
    >
      {!previewUrl ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop an image here or press Enter to browse files"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) takeFile(f);
          }}
          className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-moss bg-moss/10' : 'border-line bg-sand/50 hover:border-moss/60'
          }`}
        >
          <UploadCloud size={40} className="mx-auto text-moss mb-3" aria-hidden="true" />
          <p className="font-medium text-charcoal">Drag & drop your room photo here</p>
          <p className="text-sm text-charcoal-soft mt-1">or click to browse — JPEG, PNG or WebP, up to 15 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXT.join(',')}
            className="sr-only"
            aria-label="Choose a room photo file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) takeFile(f);
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <div>
          <div className="rounded-2xl overflow-hidden bg-charcoal max-h-[50vh] flex items-center justify-center">
            <img src={previewUrl} alt="Selected room photo preview" className="max-h-[50vh] w-auto object-contain" />
          </div>
          {file && (
            <p className="text-xs text-charcoal-soft mt-2" aria-live="polite">
              {file.name} · {formatBytes(file.size)}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="primary" onClick={handleUsePhoto} loading={decoding} disabled={!file}>
              <Check size={16} aria-hidden="true" /> Use This Photo
            </Button>
            <Button variant="secondary" onClick={reset}>
              <ImagePlus size={16} aria-hidden="true" /> Choose Different
            </Button>
            <Button variant="ghost" onClick={handleClose}>
              <X size={16} aria-hidden="true" /> Remove
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
          {decoding ? <Loader2 size={14} className="inline animate-spin mr-1" aria-hidden="true" /> : null}
          {error}
        </p>
      )}
    </Dialog>
  );
}
