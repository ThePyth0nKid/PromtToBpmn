import React, { useCallback, useMemo, useRef, useState } from 'react';
import PromptPanel from '../ui/PromptPanel';
import BpmnCanvas, { BpmnCanvasHandle } from '../ui/BpmnCanvas';
import { llmMode, textToProcessJson, type LlmDiag } from '../services/llm';
import { jsonToBpmnXml } from '../services/bpmn';
import { validateProcess } from '../services/validate';
import { downloadDataUrl, downloadText } from '../services/export';
import LogPanel from '../ui/LogPanel';
import DetailsPanel from '../ui/DetailsPanel';
import { RunEvent, startDemoRun } from '../services/runner';

export default function Home(): JSX.Element {
  const [prompt, setPrompt] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [xml, setXml] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runEvents, setRunEvents] = useState<RunEvent[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [diag, setDiag] = useState<LlmDiag | null>(null);
  const canvasRef = useRef<BpmnCanvasHandle>(null);
  const lastRunModelRef = useRef<any>(null);

  const hasErrors = errors.length > 0;

  const onGenerate = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    setRunEvents([]);
    setSelectedId(null);
    setDiag(null);
    canvasRef.current?.clearMarkers();
    canvasRef.current?.clearBadges();
    try {
      const json = await textToProcessJson(prompt, undefined, (d) => setDiag(d));
      lastRunModelRef.current = json;
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
    if (!xml) return;
    setLoading(true);
    setDiag(null);
    try {
      const json = await textToProcessJson(prompt, errors, (d) => setDiag(d));
      lastRunModelRef.current = json;
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
  }, [prompt, errors, xml]);

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

  const onExportRun = useCallback(() => {
    const data = JSON.stringify({ events: runEvents, diag }, null, 2);
    downloadText('run.json', data);
  }, [runEvents, diag]);

  const toggleTheme = useCallback(() => {
    const el = document.documentElement;
    el.classList.toggle('dark');
  }, []);

  const onStartDemo = useCallback(async () => {
    if (!lastRunModelRef.current) return;
    setRunEvents([]);
    setIsRunning(true);
    canvasRef.current?.clearMarkers();
    canvasRef.current?.clearBadges();

    const controller = startDemoRun(lastRunModelRef.current, (ev) => {
      setRunEvents((prev) => [...prev, ev]);
      if (ev.status === 'pending') canvasRef.current?.addMarker(ev.elementId, 'pending');
      if (ev.status === 'running') canvasRef.current?.addMarker(ev.elementId, 'running');
      if (ev.status === 'success') canvasRef.current?.addMarker(ev.elementId, 'success');
      if (ev.status === 'failure') canvasRef.current?.addMarker(ev.elementId, 'failure');
      const label = ev.status === 'running' ? '▶' : ev.status === 'success' ? '✓' : ev.status === 'failure' ? '✗' : '…';
      canvasRef.current?.addBadge(ev.elementId, label, ev.status);
    }, { baseDelayMs: 500, failureRate: 0.2 });

    setTimeout(() => setIsRunning(false), 12000);
    return () => controller.stop();
  }, []);

  const mode = llmMode();

  return (
    <div className="h-full">
      <header className="border-b border-border sticky top-0 z-10 bg-background">
        <div className="container flex items-center justify-between py-3">
          <h1 className="text-lg font-semibold">Prompt → BPMN</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">LLM: {mode.provider} {mode.usingMock ? '(mock)' : ''}</span>
            {diag && (
              <span className={`run-badge ${diag.ok ? 'success' : 'failure'}`} title={`status: ${diag.status ?? '-'} id: ${diag.requestId ?? '-'} time: ${diag.durationMs ?? '-'}ms`}>
                {diag.ok ? 'LLM OK' : 'LLM ERR'}
              </span>
            )}
            <button className="btn" onClick={toggleTheme} aria-label="Theme wechseln">Dark/Light</button>
            <button className="btn" onClick={onExportXml} disabled={!xml}>Export XML</button>
            <button className="btn" onClick={onExportSvg} disabled={!xml}>Export SVG</button>
            <button className="btn" onClick={onExportPng} disabled={!xml}>Export PNG</button>
            <button className="btn" onClick={onExportRun} disabled={runEvents.length === 0 && !diag}>Export Run JSON</button>
          </div>
        </div>
      </header>

      <main className="container grid h-[calc(100%-4rem)] gap-4 py-4 xl:grid-cols-[1fr_2fr_360px] md:grid-cols-2">
        <div className="card p-4 flex flex-col min-h-[400px]">
          <PromptPanel
            value={prompt}
            onChange={setPrompt}
            onGenerate={onGenerate}
            onImprove={onImprove}
            loading={loading}
            errors={errors}
          />
          {diag && (
            <div className="mt-3 text-xs space-y-1">
              <div className="text-muted">Diagnose:</div>
              <div>Provider: {diag.provider} {diag.url ? `(${diag.url})` : ''} {diag.model ? `model=${diag.model}` : ''}</div>
              <div>Status: {diag.ok ? 'OK' : 'ERROR'} {diag.status ?? ''} in {diag.durationMs ?? 0} ms</div>
              {diag.requestId && <div>Request-ID: {diag.requestId}</div>}
              {diag.error && <div className="text-red-600 dark:text-red-400">{diag.error}</div>}
              {diag.snippet && <pre className="p-2 bg-muted rounded text-xs overflow-auto">{diag.snippet}</pre>}
            </div>
          )}
          <div className="mt-4">
            <button className="btn btn-primary" onClick={onStartDemo} disabled={!xml || isRunning}>
              {isRunning ? 'Demo läuft…' : 'Demo-Lauf starten'}
            </button>
          </div>
          <div className="mt-4"><LogPanel events={runEvents} /></div>
        </div>
        <div className="card p-0 overflow-hidden min-h-[400px]">
          <BpmnCanvas ref={canvasRef} xml={xml} onElementClick={setSelectedId} />
        </div>
        <DetailsPanel openedId={selectedId} onClose={() => setSelectedId(null)} history={runEvents} />
      </main>
    </div>
  );
}
