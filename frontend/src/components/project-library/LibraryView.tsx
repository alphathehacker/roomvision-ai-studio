import { useEffect, useState } from 'react';
import { FolderOpen, Pencil, Trash2, Plus, Loader2, ImageOff } from 'lucide-react';
import { listProjects, deleteProject, renameProject, type ProjectMeta } from '../../services/storage';
import { Button } from '../ui/button';
import { Dialog, ConfirmDialog } from '../ui/dialog';
import { Input, Field } from '../ui/input';
import { formatBytes } from '../../utils/common';

interface LibraryViewProps {
  onReopen: (id: string) => void;
  onNewDesign: () => void;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}

export function LibraryView({ onReopen, onNewDesign, onToast }: LibraryViewProps) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [renameTarget, setRenameTarget] = useState<ProjectMeta | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProjectMeta | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
      const urls: Record<string, string> = {};
      for (const p of list) urls[p.id] = URL.createObjectURL(p.thumbnailBlob);
      setThumbUrls((prev) => {
        for (const u of Object.values(prev)) URL.revokeObjectURL(u);
        return urls;
      });
    } catch (err) {
      onToast(`Could not load saved designs: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    return () => {
      setThumbUrls((prev) => {
        for (const u of Object.values(prev)) URL.revokeObjectURL(u);
        return {};
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReopen = async (id: string) => {
    setOpeningId(id);
    try {
      onReopen(id);
    } finally {
      setOpeningId(null);
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      await renameProject(renameTarget.id, renameValue);
      setRenameTarget(null);
      await refresh();
      onToast('Design renamed.');
    } catch (err) {
      onToast(`Rename failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
      onToast(`Deleted "${deleteTarget.name}".`);
    } catch (err) {
      onToast(`Delete failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">My Designs</h1>
          <p className="text-sm text-charcoal-soft mt-1">Saved locally in your browser — nothing leaves this device.</p>
        </div>
        <Button variant="primary" onClick={onNewDesign}>
          <Plus size={16} aria-hidden="true" /> New Design
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-charcoal-soft" role="status">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Loading saved designs…
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl border border-line bg-sand/60 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white border border-line flex items-center justify-center mx-auto mb-4">
            <ImageOff size={28} className="text-charcoal-soft" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-charcoal">No saved designs yet — create your first design.</h2>
          <p className="text-sm text-charcoal-soft mt-2 max-w-md mx-auto">
            Capture or upload a room photo, paint the walls, lay new flooring and preview lighting —
            then save it here to continue later.
          </p>
          <Button variant="primary" className="mt-5" onClick={onNewDesign}>
            <Plus size={16} aria-hidden="true" /> Start a design
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-line bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                type="button"
                onClick={() => void handleReopen(p.id)}
                className="block w-full text-left"
                aria-label={`Reopen design ${p.name}`}
              >
                <div className="aspect-[4/3] bg-sand overflow-hidden">
                  {thumbUrls[p.id] ? (
                    <img src={thumbUrls[p.id]} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-charcoal-soft text-xs">
                      no preview
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm text-charcoal truncate">{p.name}</p>
                  <p className="text-xs text-charcoal-soft mt-0.5">
                    {new Date(p.updatedAt).toLocaleDateString()} · {formatBytes(p.thumbnailBlob.size)}
                  </p>
                </div>
              </button>
              <div className="flex gap-1 px-3 pb-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => void handleReopen(p.id)}
                  disabled={openingId === p.id}
                  aria-label={`Reopen ${p.name}`}
                >
                  {openingId === p.id ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <FolderOpen size={14} aria-hidden="true" />
                  )}
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRenameTarget(p);
                    setRenameValue(p.name);
                  }}
                  aria-label={`Rename ${p.name}`}
                >
                  <Pencil size={14} aria-hidden="true" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`}>
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename design"
      >
        <Field label="Design name" htmlFor="rename-input">
          <Input
            id="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRename();
            }}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setRenameTarget(null)}>Cancel</Button>
          <Button variant="primary" onClick={() => void handleRename()}>Rename</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete design?"
        message={`Delete '${deleteTarget?.name ?? ''}'? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
