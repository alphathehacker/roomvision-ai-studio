import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, SwitchCamera, X, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

interface CameraViewProps {
  open: boolean;
  onClose: () => void;
  /** Called with the captured photo blob; caller moves into the editor. */
  onCapture: (blob: Blob) => void;
  /** Offered as an alternative to camera capture. */
  onUploadInstead: () => void;
}

export function CameraView({ open, onClose, onCapture, onUploadInstead }: CameraViewProps) {
  const { status, error, facingMode, videoRef, start, stop, retry, switchFacing, capture } = useCamera();
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const capturedBlobRef = useRef<Blob | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Close + cleanup: stop tracks whenever the dialog closes or unmounts.
  useEffect(() => {
    if (!open) {
      stop();
      setCapturedUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      capturedBlobRef.current = null;
      setCaptureError(null);
    }
  }, [open, stop]);

  const handleClose = () => {
    stop();
    onClose();
  };

  const handleCapture = async () => {
    setCapturing(true);
    setCaptureError(null);
    try {
      const blob = await capture();
      capturedBlobRef.current = blob;
      setCapturedUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return URL.createObjectURL(blob);
      });
      // Stop the camera once the photo is taken (tracks released when leaving).
      stop();
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Capture failed. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    capturedBlobRef.current = null;
    void start();
  };

  const handleUsePhoto = () => {
    const blob = capturedBlobRef.current;
    if (!blob) return;
    stop();
    onCapture(blob);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Capture your room"
      description="The camera is used only to capture a photo of your room. Nothing is uploaded; the photo stays in your browser."
      className="sm:max-w-2xl"
    >
      <div className="relative rounded-2xl overflow-hidden bg-charcoal aspect-[4/3]">
        {status === 'idle' && !capturedUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-sand flex items-center justify-center">
              <Camera size={28} className="text-moss" aria-hidden="true" />
            </div>
            <p className="text-sm text-cream/80 max-w-sm">
              Point your camera at the room you want to redesign. The photo is processed locally in
              your browser.
            </p>
            <Button variant="primary" onClick={() => void start()} aria-label="Open camera">
              <Camera size={16} aria-hidden="true" /> Open Camera
            </Button>
          </div>
        )}

        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-cream">
            <Loader2 size={32} className="animate-spin" aria-hidden="true" />
            <p className="text-sm" role="status">Starting camera…</p>
          </div>
        )}

        {status === 'error' && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-900/40 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-300" aria-hidden="true" />
            </div>
            <h3 className="text-cream font-semibold">{error.title}</h3>
            <p className="text-sm text-cream/75 max-w-sm">{error.guidance}</p>
            <div className="flex gap-2 mt-1">
              <Button variant="primary" onClick={retry}>
                <RefreshCw size={16} aria-hidden="true" /> Retry
              </Button>
              <Button variant="secondary" onClick={onUploadInstead}>
                <Upload size={16} aria-hidden="true" /> Upload Room Photo
              </Button>
            </div>
          </div>
        )}

        {(status === 'live' || status === 'captured') && !capturedUrl && (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              aria-label="Live camera preview"
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                type="button"
                onClick={() => void switchFacing()}
                aria-label={`Switch to ${facingMode === 'user' ? 'rear' : 'front'} camera`}
                title={`Switch to ${facingMode === 'user' ? 'rear' : 'front'} camera`}
                className="w-10 h-10 rounded-full bg-charcoal/60 text-cream flex items-center justify-center hover:bg-charcoal/80"
              >
                <SwitchCamera size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close camera"
                className="w-10 h-10 rounded-full bg-charcoal/60 text-cream flex items-center justify-center hover:bg-charcoal/80"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {capturedUrl && (
          <img src={capturedUrl} alt="Captured room photo preview" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      {captureError && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {captureError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {status === 'live' && (
          <>
            <Button variant="primary" onClick={() => void handleCapture()} loading={capturing} aria-label="Capture photo">
              <Camera size={16} aria-hidden="true" /> Capture
            </Button>
            <Button variant="secondary" onClick={stop}>
              Close Camera
            </Button>
          </>
        )}
        {capturedUrl && (
          <>
            <Button variant="primary" onClick={handleUsePhoto}>
              Use This Photo
            </Button>
            <Button variant="secondary" onClick={handleRetake}>
              <RefreshCw size={16} aria-hidden="true" /> Retake
            </Button>
          </>
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onUploadInstead}>
            <Upload size={14} aria-hidden="true" /> Upload Room Photo instead
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
