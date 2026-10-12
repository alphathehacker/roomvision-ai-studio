import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input, Field } from '../ui/input';
import { saveProject } from '../../services/storage';
import { makeThumbnail } from '../../utils/image';
import type { EditorState } from '../../types';

interface SaveDialogProps {
  open: boolean;
  onClose: () => void;
  original: ImageBitmap;
  originalBlob: Blob;
  editState: EditorState;
  projectId: string | null;
  defaultName: string;
  onSaved: (id: string, name: string) => void;
  onError: (message: string) => void;
}

export function SaveDialog({
  open,
  onClose,
  original,
  originalBlob,
  editState,
  projectId,
  defaultName,
  onSaved,
  onError,
}: SaveDialogProps) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const thumbnailBlob = await makeThumbnail(original);
      const record = await saveProject({
        id: projectId ?? undefined,
        name: name.trim() || 'Untitled Room Design',
        originalBlob,
        editState: JSON.parse(JSON.stringify(editState)) as EditorState,
        thumbnailBlob,
      });
      onSaved(record.id, record.name);
      onClose();
    } catch (err) {
      onError(
        `Save failed: ${err instanceof Error ? err.message : 'unknown error'}. Your work is still in the editor.`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Save design" description="Saved locally in your browser (IndexedDB). Your photo never leaves this device.">
      <Field label="Design name" htmlFor="save-name">
        <Input
          id="save-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled Room Design"
          maxLength={80}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave();
          }}
        />
      </Field>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void handleSave()} loading={saving} disabled={saving}>
          {!saving && <Save size={16} aria-hidden="true" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {saving && (
        <p className="mt-3 text-xs text-charcoal-soft flex items-center gap-2" role="status">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Writing to local database…
        </p>
      )}
    </Dialog>
  );
}
