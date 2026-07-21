import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Toolbar } from '../components/toolbar/Toolbar';
import { SceneTree } from '../components/scene-tree/SceneTree';
import { InspectorPanel } from '../components/inspector/InspectorPanel';
import { IssuesPanel } from '../components/issues/IssuesPanel';
import { PerformancePanel } from '../components/performance/PerformancePanel';
import { Viewport } from '../components/layout/Viewport';
import { DropOverlay } from '../components/layout/DropOverlay';

export function App() {
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
        <span className="footer-product">glTF Inspector v0.1.0</span>
        <span className="footer-product">made by znkim</span>
        <a href="https://github.com/znkim/gltf-inspector" target="_blank" rel="noreferrer">github</a>
      </footer>
    </div>
  );
}
