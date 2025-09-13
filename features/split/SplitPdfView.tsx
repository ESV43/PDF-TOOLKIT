import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';

type SplitMode = 'range' | 'all';

const SplitPdfView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('range');
  const [range, setRange] = useState('');

  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const splitPdf = async () => {
    if (!file) {
      setError('No file selected.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { PDFDocument, JSZip } = (window as any);
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const totalPages = pdfDoc.getPageCount();

      if (splitMode === 'range') {
        setLoadingMessage('Extracting page range...');
        const pageIndices = parseRange(range, totalPages);
        if (pageIndices.length === 0) {
            throw new Error("Invalid or empty page range. Please provide valid pages to extract, e.g., '1-3, 5'.");
        }
        const newPdfDoc = await PDFDocument.create();
        const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach(page => newPdfDoc.addPage(page));
        const pdfBytes = await newPdfDoc.save();
        downloadFile(pdfBytes, `split_${file.name}`, 'application/pdf');

      } else { // split all
        setLoadingMessage('Splitting all pages...');
        const zip = new JSZip();
        for (let i = 0; i < totalPages; i++) {
          setLoadingMessage(`Processing page ${i + 1} of ${totalPages}...`);
          const newPdfDoc = await PDFDocument.create();
          const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
          newPdfDoc.addPage(copiedPage);
          const pdfBytes = await newPdfDoc.save();
          zip.file(`page_${i + 1}.pdf`, pdfBytes);
        }
        setLoadingMessage('Creating zip file...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadFile(zipBlob, `${file.name.replace(/\.pdf$/i, '')}_pages.zip`, 'application/zip');
      }
      
      setFile(null); // Reset after success

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to split PDF. It may be corrupted or password-protected.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const parseRange = (rangeStr: string, totalPages: number): number[] => {
    const indices = new Set<number>();
    const parts = rangeStr.split(',');
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(s => parseInt(s.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            if (i > 0 && i <= totalPages) indices.add(i - 1);
          }
        }
      } else {
        const pageNum = parseInt(part.trim());
        if (!isNaN(pageNum) && pageNum > 0 && pageNum <= totalPages) {
          indices.add(pageNum - 1);
        }
      }
    }
    return Array.from(indices).sort((a,b) => a - b);
  };

  const downloadFile = (data: Blob | Uint8Array, fileName: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message={loadingMessage} />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to split" />
      )}

      {!isLoading && file && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md space-y-6">
          <div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Selected File</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{file.name}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Split Mode</label>
            <div className="flex gap-2">
                <button onClick={() => setSplitMode('range')} className={`w-full text-left p-3 rounded-md transition-colors ${splitMode === 'range' ? 'bg-sky-100 dark:bg-sky-900/50 ring-2 ring-sky-500' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100'}`}>
                    <h4 className="font-semibold">Extract page range</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Create one new PDF from selected pages.</p>
                </button>
                <button onClick={() => setSplitMode('all')} className={`w-full text-left p-3 rounded-md transition-colors ${splitMode === 'all' ? 'bg-sky-100 dark:bg-sky-900/50 ring-2 ring-sky-500' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100'}`}>
                    <h4 className="font-semibold">Split all pages</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Create a separate PDF file for every page.</p>
                </button>
            </div>
          </div>

          {splitMode === 'range' && (
            <div>
              <label htmlFor="range" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Pages to extract</label>
              <input
                type="text"
                id="range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="e.g., 1-5, 8, 10-12"
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              />
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setFile(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
              Choose Different PDF
            </button>
            <button onClick={splitPdf} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75" disabled={splitMode === 'range' && !range}>
              Split PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SplitPdfView;
