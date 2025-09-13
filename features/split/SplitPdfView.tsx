import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

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
      const PDFLib = (window as any).PDFLib;
      const JSZip = (window as any).JSZip;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const totalPages = pdfDoc.getPageCount();

      if (splitMode === 'range') {
        setLoadingMessage('Extracting page range...');
        const pageIndices = parseRange(range, totalPages);
        if (pageIndices.length === 0) {
            throw new Error("Invalid or empty page range. Please provide valid pages to extract, e.g., '1-3, 5'.");
        }
        const newPdfDoc = await PDFLib.PDFDocument.create();
        const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach(page => newPdfDoc.addPage(page));
        const pdfBytes = await newPdfDoc.save();
        downloadFile(pdfBytes, `split_${file.name}`, 'application/pdf');

      } else { // split all
        setLoadingMessage('Splitting all pages...');
        const zip = new JSZip();
        for (let i = 0; i < totalPages; i++) {
          setLoadingMessage(`Processing page ${i + 1} of ${totalPages}...`);
          const newPdfDoc = await PDFLib.PDFDocument.create();
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

  const renderOptions = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Selected File</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{file?.name}</p>
      </div>
      
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Split Mode</legend>
        <div className="flex flex-col md:flex-row gap-4">
            <button onClick={() => setSplitMode('range')} className={`w-full text-left p-4 rounded-xl transition-colors ${splitMode === 'range' ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">Extract page range</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Create one new PDF from selected pages.</p>
            </button>
            <button onClick={() => setSplitMode('all')} className={`w-full text-left p-4 rounded-xl transition-colors ${splitMode === 'all' ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">Split all pages</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Create a separate PDF file for every page.</p>
            </button>
        </div>
      </fieldset>

      {splitMode === 'range' && (
        <div>
          <label htmlFor="range" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pages to extract</label>
          <input
            type="text"
            id="range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            placeholder="e.g., 1-5, 8, 10-12"
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button onClick={() => setFile(null)} variant="secondary">
          Cancel
        </Button>
        <Button onClick={splitPdf} variant="primary" disabled={splitMode === 'range' && !range}>
          Split PDF
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <ToolHeader 
        title="Split PDF"
        description="Extract a page range into a new PDF or split every page into its own file."
      />
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message={loadingMessage} />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to split" />
      )}

      {!isLoading && file && renderOptions()}
    </div>
  );
};

export default SplitPdfView;