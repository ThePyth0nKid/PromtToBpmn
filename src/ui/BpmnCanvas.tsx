import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Modeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-codes.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

export type BpmnCanvasHandle = {
  importXml: (xml: string) => Promise<void>;
  exportXml: () => Promise<string>;
  exportSvg: () => Promise<string>;
  exportPng: () => Promise<string>;
  zoomToFit: () => Promise<void>;
  addMarker: (elementId: string, marker: 'pending' | 'running' | 'success' | 'failure') => void;
  clearMarkers: (elementId?: string) => void;
  addBadge: (elementId: string, text: string, status: 'pending'|'running'|'success'|'failure') => string;
  clearBadges: (elementId?: string) => void;
};

type Props = {
  xml?: string;
  onElementClick?: (elementId: string) => void;
  onReady?: () => void;
};

const BpmnCanvas = forwardRef<BpmnCanvasHandle, Props>(({ xml, onElementClick, onReady }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modelerRef = useRef<Modeler | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    modelerRef.current = new Modeler({ container: containerRef.current });
    const modeler = modelerRef.current;

    // element click selection
    const eventBus = modeler.get('eventBus') as any;
    eventBus.on('element.click', (e: any) => {
      const ele = e?.element;
      if (ele && ele.id && onElementClick) onElementClick(ele.id);
    });

    onReady?.();

    return () => {
      modeler.destroy();
      modelerRef.current = null;
    };
  }, [onElementClick, onReady]);

  useEffect(() => {
    (async () => {
      if (xml && modelerRef.current) {
        try {
          await modelerRef.current.importXML(xml);
          await (modelerRef.current.get('canvas') as any).zoom('fit-viewport');
        } catch (err) {
          // noop for now
        }
      }
    })();
  }, [xml]);

  useImperativeHandle(ref, () => ({
    importXml: async (xml: string) => {
      if (!modelerRef.current) return;
      await modelerRef.current.importXML(xml);
    },
    exportXml: async () => {
      if (!modelerRef.current) return '';
      const result = await modelerRef.current.saveXML({ format: true });
      const xml = (result as any)?.xml as string | undefined;
      return xml ?? '';
    },
    exportSvg: async () => {
      if (!modelerRef.current) return '';
      const result = await (modelerRef.current as any).saveSVG();
      const svg = (result as any)?.svg as string | undefined;
      return svg ?? '';
    },
    exportPng: async () => {
      if (!modelerRef.current) return '';
      const result = await (modelerRef.current as any).saveSVG();
      const svg = (result as any)?.svg as string | undefined;
      if (!svg) return '';
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const dataUrl: string = await new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('No canvas context'));
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = url;
      });
      URL.revokeObjectURL(url);
      return dataUrl;
    },
    zoomToFit: async () => {
      if (!modelerRef.current) return;
      (modelerRef.current.get('canvas') as any).zoom('fit-viewport');
    },
    addMarker: (elementId, marker) => {
      if (!modelerRef.current) return;
      const canvas = modelerRef.current.get('canvas') as any;
      canvas.addMarker(elementId, `marker-${marker}`);
    },
    clearMarkers: (elementId?: string) => {
      if (!modelerRef.current) return;
      const canvas = modelerRef.current.get('canvas') as any;
      const elementRegistry = modelerRef.current.get('elementRegistry') as any;
      const ids: string[] = elementId ? [elementId] : elementRegistry.getAll().map((e: any) => e.id);
      ids.forEach((id) => {
        ['pending', 'running', 'success', 'failure'].forEach((m) => canvas.removeMarker(id, `marker-${m}`));
      });
    },
    addBadge: (elementId, text, status) => {
      if (!modelerRef.current) return '';
      const overlays = modelerRef.current.get('overlays') as any;
      const html = document.createElement('div');
      html.className = `run-badge ${status}`;
      html.textContent = text;
      const id = overlays.add(elementId, {
        position: { top: -10, left: 0 },
        html,
      });
      return id;
    },
    clearBadges: (elementId?: string) => {
      if (!modelerRef.current) return;
      const overlays = modelerRef.current.get('overlays') as any;
      overlays.remove({ element: elementId });
    },
  }));

  return <div className="bpmn-host"><div ref={containerRef} className="bpmn-container" /></div>;
});

export default BpmnCanvas;
