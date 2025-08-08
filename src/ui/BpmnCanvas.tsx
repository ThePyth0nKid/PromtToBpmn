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
};

type Props = {
  xml?: string;
};

const BpmnCanvas = forwardRef<BpmnCanvasHandle, Props>(({ xml }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modelerRef = useRef<Modeler | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    modelerRef.current = new Modeler({ container: containerRef.current });
    const modeler = modelerRef.current;
    return () => {
      modeler.destroy();
      modelerRef.current = null;
    };
  }, []);

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
  }));

  return <div ref={containerRef} className="bpmn-container" />;
});

export default BpmnCanvas;
