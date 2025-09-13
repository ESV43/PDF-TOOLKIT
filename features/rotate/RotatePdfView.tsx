import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import { degrees } from 'pdf-lib';

interface Page {
  id: number;
  originalIndex: number;
  dataUrl: string;
  rotation: number;
}

const RotatePdfView: React.FC = () => {
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
          newPages.push({ id: i, originalIndex: i - 1, dataUrl: canvas.toDataURL(), rotation: 0 });
        }
      }
      setPages(newPages);
    } catch (e) {
      console.error(e);
      setError('Failed to load PDF. It may be corrupted or password-protected.');
      setFile(null);
    } finally {
      setIsLoading(false);
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

  const rotatePage = (id: number, angle: number) => {
    setPages(pages.map(p => p.id === id ? { ...p, rotation: (p.rotation + angle) % 360 } : p));
  };
  
  const rotateAll = (angle: number) => {
     setPages(pages.map(p => ({ ...p, rotation: (p.rotation + angle) % 360 })));
  }

  const savePdf = async () => {
    if (!originalPdfDoc.current) {
      setError("PDF not loaded.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage("Applying rotations and saving PDF...");
    try {
      const pdfDoc = originalPdfDoc.current;
      pages.forEach(p => {
        if (p.rotation !== 0) {
          const page = pdfDoc.getPage(p.originalIndex);
          page.setRotation(degrees(p.rotation));
        }
      });
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rotated_${file?.name || 'document.pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setFile(null);
    } catch (e) {
      console.error(e);
      setError("An error occurred while saving the PDF.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const hasRotations = pages.some(p => p.rotation !== 0);

  return (
    <div className="max-w-6xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to rotate its pages" />
      )}

      {isLoading && <Spinner message={loadingMessage} />}

      {!isLoading && file && (
        <div className="space-y-6">
            <div className="flex justify-center items-center p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm gap-4">
                <h3 className="text-lg font-medium">Rotate all pages:</h3>
                <div className="space-x-2">
                    <button onClick={() => rotateAll(90)} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-transparent rounded-md hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700">Rotate Right ↻</button>
                    <button onClick={() => rotateAll(270)} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-transparent rounded-md hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700">Rotate Left ↺</button>
                </div>
            </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {pages.map((page, index) => (
              <div key={page.id} className="relative group bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1">
                <img src={page.dataUrl} alt={`Page ${index + 1}`} className="w-full h-auto rounded-md transition-transform" style={{ transform: `rotate(${page.rotation}deg)` }}/>
                <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => rotatePage(page.id, 270)} className="h-7 w-7 bg-slate-800/60 text-white rounded-full flex items-center justify-center hover:bg-slate-900/80">↺</button>
                    <button onClick={() => rotatePage(page.id, 90)} className="h-7 w-7 bg-slate-800/60 text-white rounded-full flex items-center justify-center hover:bg-slate-900/80">↻</button>
                </div>
                <span className="absolute bottom-1 left-1 bg-slate-800 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
             <button onClick={() => setFile(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                Choose Different PDF
            </button>
            <button onClick={savePdf} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400" disabled={!hasRotations}>
              Save Rotated PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotatePdfView;
