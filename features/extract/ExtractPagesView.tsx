import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';

interface Page {
  id: number;
  originalIndex: number;
  dataUrl: string;
  isSelected: boolean;
}

const ExtractPagesView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const originalPdfDoc = useRef<any>(null);

  const renderPdfPages = useCallback(async (pdfFile: File) => {
    setIsLoading(true);
    setLoadingMessage('Loading PDF...');
    setError(null);

    try {
      const { pdfjsLib, PDFLib } = (window as any);
      
      const arrayBuffer = await pdfFile.arrayBuffer();
      originalPdfDoc.current = await PDFLib.PDFDocument.load(arrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const newPages: Page[] = [];

      for (let i = 1; i <= numPages; i++) {
        setLoadingMessage(`Rendering page ${i} of ${numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            newPages.push({ id: i, originalIndex: i - 1, dataUrl: canvas.toDataURL(), isSelected: false });
        }
      }
      setPages(newPages);
    } catch (e) {
      console.error(e);
      setError('Failed to load PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, []);

  useEffect(() => {
    if (file) {
      renderPdfPages(file);
    } else {
      setPages([]);
      originalPdfDoc.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const togglePageSelection = (id: number) => {
    setPages(pages.map(p => p.id === id ? { ...p, isSelected: !p.isSelected } : p));
  };
  
  const selectAll = () => setPages(pages.map(p => ({ ...p, isSelected: true })));
  const deselectAll = () => setPages(pages.map(p => ({ ...p, isSelected: false })));

  const savePdf = async () => {
    const selectedPages = pages.filter(p => p.isSelected);
    if (!originalPdfDoc.current || selectedPages.length === 0) {
      setError("Please select at least one page to extract.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage("Extracting pages and saving new PDF...");
    try {
      const { PDFDocument } = (window as any).PDFLib;
      const newPdfDoc = await PDFDocument.create();
      const pageIndicesToCopy = selectedPages.map(p => p.originalIndex);
      
      const copiedPages = await newPdfDoc.copyPages(originalPdfDoc.current, pageIndicesToCopy);
      copiedPages.forEach(page => newPdfDoc.addPage(page));
      
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extracted_${file?.name || 'document.pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setFile(null); // Reset after saving
    } catch (e) {
      console.error(e);
      setError("An error occurred while saving the PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = pages.filter(p => p.isSelected).length;

  return (
    <div className="max-w-6xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to extract pages from" />
      )}

      {isLoading && <Spinner message={loadingMessage} />}

      {!isLoading && file && (
        <div className="space-y-6">
          <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium">Select pages to extract ({selectedCount} / {pages.length})</h3>
            <div className="space-x-2">
                <button onClick={selectAll} className="px-3 py-1 text-sm font-medium text-sky-700 bg-sky-100 border border-transparent rounded-md hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-900">Select All</button>
                <button onClick={deselectAll} className="px-3 py-1 text-sm font-medium text-slate-700 bg-slate-100 border border-transparent rounded-md hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700">Deselect All</button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {pages.map((page, index) => (
              <div 
                key={page.id}
                onClick={() => togglePageSelection(page.id)}
                className={`relative group border-2 rounded-lg p-1 cursor-pointer bg-white dark:bg-slate-800 shadow-sm transition-all ${page.isSelected ? 'border-sky-500 scale-105' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                <img src={page.dataUrl} alt={`Page ${index + 1}`} className="w-full h-auto rounded-md" />
                <div className={`absolute inset-0 flex items-center justify-center transition-colors ${page.isSelected ? 'bg-sky-900/30' : 'bg-black/0 group-hover:bg-black/20'}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all scale-75 ${page.isSelected ? 'bg-sky-500 scale-100' : 'bg-slate-500/50 opacity-0 group-hover:opacity-100'}`}>
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </div>
                </div>
                <span className="absolute bottom-1 left-1 bg-slate-800 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
             <button onClick={() => setFile(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                Choose Different PDF
            </button>
            <button onClick={savePdf} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400" disabled={selectedCount === 0}>
              Extract {selectedCount} Pages
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractPagesView;