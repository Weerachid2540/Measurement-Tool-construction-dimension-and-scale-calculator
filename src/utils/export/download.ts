import { saveAs } from 'file-saver';

export function downloadText(content: string, fileName: string, mimeType = 'text/plain'): void {
  saveAs(new Blob([content], { type: `${mimeType};charset=utf-8` }), fileName);
}

export function downloadJson(content: string, fileName: string): void {
  downloadText(content, fileName, 'application/json');
}
