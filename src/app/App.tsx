import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SUPPORTED_EXTENSIONS } from '../inspection/ExtensionInspector';
import { Toolbar } from '../components/toolbar/Toolbar';
import { SceneTree } from '../components/scene-tree/SceneTree';
import { InspectorPanel } from '../components/inspector/InspectorPanel';
import { IssuesPanel } from '../components/issues/IssuesPanel';
import { PerformancePanel } from '../components/performance/PerformancePanel';
import { Viewport } from '../components/layout/Viewport';
import { DropOverlay } from '../components/layout/DropOverlay';

export function App() {
  const [aboutOpen, setAboutOpen] = useState(false);
  return (
    <div className="app">
      <Toolbar />
      <DropOverlay />
      <PanelGroup direction="vertical" className="workspace">
        <Panel defaultSize={76} minSize={45}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={22} minSize={14} maxSize={36}>
              <SceneTree />
            </Panel>
            <PanelResizeHandle className="resize-handle vertical" />
            <Panel minSize={30}>
              <Viewport />
            </Panel>
            <PanelResizeHandle className="resize-handle vertical" />
            <Panel defaultSize={28} minSize={18} maxSize={42}>
              <InspectorPanel />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="resize-handle horizontal" />
        <Panel defaultSize={24} minSize={12} maxSize={40}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={50}>
              <IssuesPanel />
            </Panel>
            <PanelResizeHandle className="resize-handle vertical" />
            <Panel defaultSize={50}>
              <PerformancePanel />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
      <footer className="app-footer">
        <span className="footer-oss">Open Source: Three.js, React, glTF-Validator, meshoptimizer, fflate, Pretendard</span>
        <span className="footer-meta">
          <span className="footer-product">glTF Inspector v0.2.2</span>
          <span className="footer-product">made by znkim</span>
          <button className="footer-link-button" onClick={() => setAboutOpen(true)}>about</button>
          <a href="https://github.com/znkim/gltf-inspector" target="_blank" rel="noreferrer">github</a>
        </span>
      </footer>
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </div>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={onClose}>
      <div className="about-modal-body" onClick={(event) => event.stopPropagation()}>
        <div className="about-modal-header">
          <div>
            <h2 id="about-title">glTF Inspector</h2>
            <p>Supported extension handling in the current viewer runtime.</p>
          </div>
          <button className="about-close" onClick={onClose} aria-label="Close">x</button>
        </div>
        <div className="extension-support-list">
          {SUPPORTED_EXTENSIONS.map((extension) => (
            <div key={extension.name} className="extension-support-row">
              <strong>{extension.name}</strong>
              <span className={`extension-status status-${extension.status}`}>{extension.status}</span>
              <span>{extension.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
