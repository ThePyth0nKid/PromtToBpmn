export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(filename, url);
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
