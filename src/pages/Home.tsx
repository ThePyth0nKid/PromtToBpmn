import React, { useCallback, useMemo, useRef, useState } from 'react';
import PromptPanel from '../ui/PromptPanel';
import BpmnCanvas, { BpmnCanvasHandle } from '../ui/BpmnCanvas';
import { textToProcessJson } from '../services/llm';
import { jsonToBpmnXml } from '../services/bpmn';
import { validateProcess } from '../services/validate';
import { downloadDataUrl, downloadText } from '../services/export';

export default function Home(): JSX.Element {
  const [prompt, setPrompt] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [xml, setXml] = useState<string>('');
  const canvasRef = useRef<BpmnCanvasHandle>(null);

  const hasErrors = errors.length > 0;

  const onGenerate = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      const json = await textToProcessJson(prompt);
      const validation = validateProcess(json);
      if (validation.length > 0) {
        setErrors(validation);
        return;
      }
      const bpmnXml = jsonToBpmnXml(json);
      setXml(bpmnXml);
      await canvasRef.current?.importXml(bpmnXml);
      await canvasRef.current?.zoomToFit();
    } catch (e: any) {
      setErrors([e?.message ?? 'Unbekannter Fehler beim Generieren']);
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const onImprove = useCallback(async () => {
    if (!hasErrors && !xml) return;
    setLoading(true);
    try {
      const json = await textToProcessJson(prompt, errors);
      const validation = validateProcess(json);
      if (validation.length > 0) {
        setErrors(validation);
        return;
      }
      const bpmnXml = jsonToBpmnXml(json);
      setXml(bpmnXml);
      await canvasRef.current?.importXml(bpmnXml);
      await canvasRef.current?.zoomToFit();
    } catch (e: any) {
      setErrors([e?.message ?? 'Unbekannter Fehler beim Verbessern']);
    } finally {
      setLoading(false);
    }
  }, [prompt, errors, hasErrors, xml]);

  const onExportXml = useCallback(async () => {
    const currentXml = await canvasRef.current?.exportXml();
    if (!currentXml) return;
    downloadText('diagram.bpmn', currentXml);
  }, []);

  const onExportSvg = useCallback(async () => {
    const svg = await canvasRef.current?.exportSvg();
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    downloadDataUrl('diagram.svg', url);
    URL.revokeObjectURL(url);
  }, []);

  const onExportPng = useCallback(async () => {
    const dataUrl = await canvasRef.current?.exportPng();
    if (!dataUrl) return;
    downloadDataUrl('diagram.png', dataUrl);
  }, []);

  const toggleTheme = useCallback(() => {
    const el = document.documentElement;
    el.classList.toggle('dark');
  }, []);

  return (
    <div className="h-full">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between py-3">
          <h1 className="text-lg font-semibold">Prompt → BPMN</h1>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={toggleTheme} aria-label="Theme wechseln">
              Dark/Light
            </button>
            <button className="btn" onClick={onExportXml} disabled={!xml}>
              Export XML
            </button>
            <button className="btn" onClick={onExportSvg} disabled={!xml}>
              Export SVG
            </button>
            <button className="btn" onClick={onExportPng} disabled={!xml}>
              Export PNG
            </button>
          </div>
        </div>
      </header>

      <main className="container grid h-[calc(100%-4rem)] gap-4 py-4 md:grid-cols-2">
        <div className="card p-4 flex flex-col">
          <PromptPanel
            value={prompt}
            onChange={setPrompt}
            onGenerate={onGenerate}
            onImprove={onImprove}
            loading={loading}
            errors={errors}
          />
        </div>
        <div className="card p-0 overflow-hidden">
          <BpmnCanvas ref={canvasRef} xml={xml} />
        </div>
      </main>
    </div>
  );
}
