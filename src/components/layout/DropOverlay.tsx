import { useEffect, useState } from 'react';
import { bundleFromDropEvent } from '../../loaders/DropLoader';
import { useAssetStore } from '../../state/assetStore';
import { loadGltfAsset } from '../../loaders/GltfAssetLoader';
import { getActiveRenderer } from './viewportController';

export function DropOverlay() {
  const [active, setActive] = useState(false);
  const setAsset = useAssetStore((state) => state.setAsset);
  const setLoading = useAssetStore((state) => state.setLoading);
  const addIssue = useAssetStore((state) => state.addIssue);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      setActive(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
        setActive(false);
      }
    };
    const onDrop = async (event: DragEvent) => {
      event.preventDefault();
      setActive(false);
      const renderer = getActiveRenderer();
      if (!renderer) {
        addIssue({ id: 'renderer-not-ready', severity: 'error', code: 'RENDERER_NOT_READY', message: 'Renderer is not ready yet.' });
        return;
      }
      setLoading(true);
      try {
        const bundle = await bundleFromDropEvent(event);
        setAsset(await loadGltfAsset(bundle, renderer));
      } catch (error) {
        addIssue({
          id: `load-${Date.now()}`,
          severity: 'error',
          code: 'LOAD_FAILED',
          message: error instanceof Error ? error.message : String(error)
        });
        setLoading(false);
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    const dropListener = (event: DragEvent) => {
      void onDrop(event);
    };
    window.addEventListener('drop', dropListener);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', dropListener);
    };
  }, [addIssue, setAsset, setLoading]);

  return <div className={`drop-zone ${active ? 'active' : ''}`}>Drop GLB, glTF resource set, folder, or ZIP</div>;
}
