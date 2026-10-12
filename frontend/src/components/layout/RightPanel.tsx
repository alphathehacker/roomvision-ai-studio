import type { EditorState, NormPoint } from '../../types';
import type { CanvasMode } from '../room-editor/EditorCanvas';
import type { EditorCategory } from './LeftSidebar';
import { SurfacePanel } from '../surface-tools/SurfacePanel';
import { MaterialControls } from '../material-library/MaterialControls';
import { CeilingControls } from '../ceiling-designer/CeilingControls';
import { LightingPanel } from '../lighting-tools/LightingPanel';

interface RightPanelProps {
  category: EditorCategory;
  state: EditorState;
  selectedId: string | null;
  onSelectSurface: (id: string | null) => void;
  commit: (updater: (s: EditorState) => EditorState) => void;
  mode: CanvasMode;
  onModeChange: (m: CanvasMode) => void;
  selectedPoint: { surfaceId: string; index: number } | null;
  onSelectPoint: (p: { surfaceId: string; index: number } | null) => void;
  glowPlacing: boolean;
  onToggleGlowPlacement: () => void;
  originalBlob: Blob;
  onToast: (message: string, kind?: 'info' | 'error') => void;
}

/** Context panel for the active category, plus the always-available surface tools. */
export function RightPanel(props: RightPanelProps) {
  const { category } = props;
  return (
    <div className="space-y-6">
      <SurfacePanel
        state={props.state}
        selectedId={props.selectedId}
        onSelectSurface={props.onSelectSurface}
        commit={props.commit}
        mode={props.mode}
        onModeChange={props.onModeChange}
        selectedPoint={props.selectedPoint}
        originalBlob={props.originalBlob}
        onToast={props.onToast}
      />
      <hr className="border-line" />
      {category === 'walls' && (
        <MaterialControls
          category="wall"
          state={props.state}
          selectedId={props.selectedId}
          onSelectSurface={props.onSelectSurface}
          commit={props.commit}
          onToast={props.onToast}
        />
      )}
      {category === 'flooring' && (
        <MaterialControls
          category="floor"
          state={props.state}
          selectedId={props.selectedId}
          onSelectSurface={props.onSelectSurface}
          commit={props.commit}
          onToast={props.onToast}
        />
      )}
      {category === 'ceiling' && (
        <CeilingControls
          state={props.state}
          selectedId={props.selectedId}
          onSelectSurface={props.onSelectSurface}
          commit={props.commit}
          onToast={props.onToast}
        />
      )}
      {category === 'lighting' && (
        <LightingPanel
          state={props.state}
          commit={props.commit}
          glowPlacing={props.glowPlacing}
          onToggleGlowPlacement={props.onToggleGlowPlacement}
          onToast={props.onToast}
        />
      )}
    </div>
  );
}

export type { NormPoint };
