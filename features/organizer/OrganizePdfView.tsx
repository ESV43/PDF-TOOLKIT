
import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';

interface Page {
  id: number;
  originalIndex: number;
  dataUrl: string;
}

const OrganizePdfView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  
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
            newPages.push({ id: i, originalIndex: i - 1, dataUrl: canvas.toDataURL() });
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
  
  const deletePage = (id: number) => {
    setPages(pages.filter(p => p.id !== id));
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault();
    if (draggedItemId === null || draggedItemId === id) return;

    const draggedItemIndex = pages.findIndex(p => p.id === draggedItemId);
    const targetItemIndex = pages.findIndex(p => p.id === id);

    if (draggedItemIndex === -1 || targetItemIndex === -1) return;

    const newPages = [...pages];
    const [draggedItem] = newPages.splice(draggedItemIndex, 1);
    newPages.splice(targetItemIndex, 0, draggedItem);
    setPages(newPages);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  const savePdf = async () => {
    if (!originalPdfDoc.current || pages.length === 0) {
      setError("No pages to save.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage("Saving new PDF...");
    try {
      const { PDFDocument } = (window as any).PDFLib;
      const newPdfDoc = await PDFDocument.create();
      const pageIndicesToCopy = pages.map(p => p.originalIndex);
      
      const copiedPages = await newPdfDoc.copyPages(originalPdfDoc.current, pageIndicesToCopy);
      copiedPages.forEach(page => newPdfDoc.addPage(page));
      
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organized_${file?.name || 'document.pdf'}`;
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

  return (
    <div className="max-w-6xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to organize its pages" />
      )}

      {isLoading && <Spinner message={loadingMessage} />}

      {!isLoading && file && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {pages.map((page, index) => (
              <div 
                key={page.id}
                draggable
                onDragStart={(e) => handleDragStart(e, page.id)}
                onDragOver={(e) => handleDragOver(e, page.id)}
                onDragEnd={handleDragEnd}
                className={`relative group border-2 rounded-lg p-1 cursor-move bg-white dark:bg-slate-800 shadow-sm transition-all ${draggedItemId === page.id ? 'border-sky-500 scale-105' : 'border-transparent'}`}
                >
                <img src={page.dataUrl} alt={`Page ${index + 1}`} className="w-full h-auto rounded-md" />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-colors flex items-center justify-center">
                  <button onClick={() => deletePage(page.id)} className="absolute top-1 right-1 h-6 w-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <span className="absolute bottom-1 left-1 bg-slate-800 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
             <button onClick={() => setFile(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                Choose Different PDF
            </button>
            <button onClick={savePdf} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400" disabled={pages.length === 0}>
              Save New PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizePdfView;
