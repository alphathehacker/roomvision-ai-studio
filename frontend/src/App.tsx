import { useCallback, useState } from 'react';
import { CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { TopNav } from './components/layout/TopNav';
import { Home } from './pages/Home';
import { Editor, type EditorSession } from './pages/Editor';
import { LibraryView } from './components/project-library/LibraryView';
import { HowItWorks } from './pages/HowItWorks';
import { Settings } from './pages/Settings';
import { CameraView } from './components/camera/CameraView';
import { ImageUploader } from './components/image-upload/ImageUploader';
import { loadImageBitmap, fitToMaxEdge } from './utils/image';
import { getProject } from './services/storage';
import { normalizeState } from './services/editorState';
import { uuid } from './utils/common';
import { cn } from './components/ui/utils';

export type Page = 'home' | 'editor' | 'library' | 'how' | 'settings';

interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'error';
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [session, setSession] = useState<EditorSession | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, kind: 'info' | 'error' = 'info') => {
    const id = uuid();
    setToasts((t) => [...t.slice(-2), { id, message, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const openPhoto = useCallback(
    async (blob: Blob, meta?: { projectId: string | null; projectName: string; initialState?: EditorSession['initialState'] }) => {
      setPhotoLoading(true);
      setPhotoError(null);
      try {
        const raw = await loadImageBitmap(blob);
        const bitmap = await fitToMaxEdge(raw); // only downscales; original blob kept immutably
        setSession({
          bitmap,
          blob,
          projectId: meta?.projectId ?? null,
          projectName: meta?.projectName ?? 'Untitled Room Design',
          initialState: meta?.initialState,
        });
        setPage('editor');
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : 'Could not open that photo.');
      } finally {
        setPhotoLoading(false);
      }
    },
    [],
  );

  const handleCameraCapture = useCallback(
    (blob: Blob) => {
      setCameraOpen(false);
      void openPhoto(blob);
    },
    [openPhoto],
  );

  const handleUploadSelect = useCallback(
    (blob: Blob) => {
      setUploaderOpen(false);
      void openPhoto(blob);
    },
    [openPhoto],
  );

  const handleReopen = useCallback(
    async (id: string) => {
      setPhotoLoading(true);
      setPhotoError(null);
      try {
        const project = await getProject(id);
        if (!project) throw new Error('Project not found.');
        await openPhoto(project.originalBlob, {
          projectId: project.id,
          projectName: project.name,
          initialState: normalizeState(project.editState),
        });
        pushToast(`Reopened "${project.name}".`);
      } catch (err) {
        pushToast(`Could not reopen design: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
        setPhotoLoading(false);
      }
    },
    [openPhoto, pushToast],
  );

  const navigate = useCallback(
    (p: Page) => {
      setPhotoError(null);
      if (p === 'editor' && !session) {
        setPage('home');
        return;
      }
      setPage(p);
    },
    [session],
  );

  return (
    <div className="min-h-full flex flex-col">
      <TopNav
        page={page}
        onNavigate={navigate}
        showMenuButton={page === 'editor'}
        onMenuClick={() => window.dispatchEvent(new Event('rv:open-menu'))}
      />

      <main className="flex-1 flex flex-col min-h-0">
        {page === 'home' && (
          <Home onOpenCamera={() => setCameraOpen(true)} onOpenUpload={() => setUploaderOpen(true)} />
        )}
        {page === 'editor' && session && (
          <Editor
            key={`${session.projectId ?? 'new'}-${session.blob.size}`}
            session={session}
            onExit={() => setPage('home')}
            onSaved={(projectId, name) =>
              setSession((s) => (s ? { ...s, projectId, projectName: name } : s))
            }
            onToast={pushToast}
          />
        )}
        {page === 'library' && (
          <LibraryView
            onReopen={(id) => void handleReopen(id)}
            onNewDesign={() => setPage('home')}
            onToast={pushToast}
          />
        )}
        {page === 'how' && <HowItWorks />}
        {page === 'settings' && <Settings onToast={pushToast} />}
      </main>

      <CameraView
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
        onUploadInstead={() => {
          setCameraOpen(false);
          setUploaderOpen(true);
        }}
      />
      <ImageUploader
        open={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onSelect={handleUploadSelect}
      />

      {/* photo decode/open progress + errors */}
      {photoLoading && (
        <div className="fixed inset-0 z-[70] bg-charcoal/50 flex items-center justify-center" role="status" aria-label="Opening photo">
          <div className="bg-cream rounded-3xl px-8 py-6 flex items-center gap-3 shadow-2xl">
            <Loader2 size={22} className="animate-spin text-moss" aria-hidden="true" />
            <p className="text-sm font-medium text-charcoal">Opening your photo…</p>
          </div>
        </div>
      )}
      {photoError && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70]" role="alert">
          <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 shadow-xl text-sm">
            <AlertCircle size={16} aria-hidden="true" />
            {photoError}
            <button type="button" onClick={() => setPhotoError(null)} aria-label="Dismiss error" className="ml-2 underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* global toasts */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] space-y-2 w-[min(92vw,28rem)]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'rv-fade-in flex items-start gap-2 rounded-2xl border px-4 py-3 shadow-xl text-sm',
              t.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-charcoal text-cream border-charcoal',
            )}
            role={t.kind === 'error' ? 'alert' : 'status'}
          >
            {t.kind === 'error' ? (
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              aria-label="Dismiss notification"
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
