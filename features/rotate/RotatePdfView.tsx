import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import { degrees } from 'pdf-lib';
import PageThumbnail from '../../components/PageThumbnail';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

interface Page {
  id: number;
  originalIndex: number;
  rotation: number;
}

const RotatePdfView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const originalPdfDoc = useRef<any>(null);
  const pdfDocProxy = useRef<any>(null);

  const renderPdfPages = useCallback(async (pdfFile: File) => {
    setIsLoading(true);
    setLoadingMessage('Loading PDF...');
    setError(null);
    setPages([]);

    try {
      const { pdfjsLib, PDFLib } = (window as any);
      const arrayBuffer = await pdfFile.arrayBuffer();
      originalPdfDoc.current = await PDFLib.PDFDocument.load(arrayBuffer.slice(0));
      pdfDocProxy.current = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      const numPages = pdfDocProxy.current.numPages;
      const newPages: Page[] = [];

      for (let i = 1; i <= numPages; i++) {
        newPages.push({ id: i, originalIndex: i - 1, rotation: 0 });
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
      pdfDocProxy.current = null;
    }
  }, [file, renderPdfPages]);

  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
       if (pdfFile.size > 25 * 1024 * 1024) { // 25MB warning
        setError("Warning: You've selected a large file. Page rendering may be slow or unstable.");
      }
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const rotatePage = (id: number, angle: number) => {
    setPages(pages.map(p => p.id === id ? { ...p, rotation: (p.rotation + angle + 360) % 360 } : p));
  };
  
  const rotateAll = (angle: number) => {
     setPages(pages.map(p => ({ ...p, rotation: (p.rotation + angle + 360) % 360 })));
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
      const pdfPages = pdfDoc.getPages();
      pages.forEach(p => {
        if (p.rotation !== 0) {
          const page = pdfPages[p.originalIndex];
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees(currentRotation + p.rotation));
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

  if (isLoading) return <Spinner message={loadingMessage} />;

  if (!file) {
    return (
      <div className="space-y-8">
        <ToolHeader 
          title="Rotate PDF Pages"
          description="Rotate all or selected pages in your PDF document permanently."
        />
        {error && <Alert type={error.startsWith('Warning:') ? 'info' : 'error'} message={error} />}
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to rotate its pages" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      {error && <Alert type={error.startsWith('Warning:') ? 'info' : 'error'} message={error} />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm">
          <h3 className="text-base font-semibold">Rotate all pages:</h3>
          <div className="space-x-2 flex-shrink-0">
              <Button onClick={() => rotateAll(90)} variant="secondary" className="!px-3 !py-1.5 !text-xs">Rotate Right ↻</Button>
              <Button onClick={() => rotateAll(270)} variant="secondary" className="!px-3 !py-1.5 !text-xs">Rotate Left ↺</Button>
          </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
        {pages.map((page, index) => (
          <div key={page.id} className="relative group bg-white dark:bg-gray-800 rounded-lg shadow-sm p-1.5">
            <div style={{ transform: `rotate(${page.rotation}deg)` }} className="transition-transform duration-300 rounded-md overflow-hidden">
                <PageThumbnail pdfDoc={pdfDocProxy.current} pageNumber={page.id}>
                    {(dataUrl) => (
                       <img src={dataUrl} alt={`Page ${index + 1}`} className="w-full h-auto" />
                    )}
                </PageThumbnail>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-end p-2 gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/30 rounded-lg">
                <button onClick={() => rotatePage(page.id, 90)} className="h-9 w-9 bg-gray-900/60 text-white rounded-full flex items-center justify-center hover:bg-gray-900/80 backdrop-blur-sm" aria-label="Rotate right">↻</button>
                <button onClick={() => rotatePage(page.id, 270)} className="h-9 w-9 bg-gray-900/60 text-white rounded-full flex items-center justify-center hover:bg-gray-900/80 backdrop-blur-sm" aria-label="Rotate left">↺</button>
            </div>
            <span className="absolute bottom-1.5 left-1.5 bg-gray-900/60 text-white text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">{index + 1}</span>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 md:static md:bg-transparent md:dark:bg-transparent md:p-0 md:border-none md:backdrop-blur-none flex justify-between items-center">
         <Button onClick={() => setFile(null)} variant="secondary">
            Choose Different PDF
        </Button>
        <Button onClick={savePdf} disabled={!hasRotations} variant="primary">
          Save Rotated PDF
        </Button>
      </div>
    </div>
  );
};

export default RotatePdfView;