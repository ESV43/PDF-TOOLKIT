import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import PageThumbnail from '../../components/PageThumbnail';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

interface Page {
  id: number;
  originalIndex: number;
}

const OrganizePdfView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  
  const originalPdfDoc = useRef<any>(null); // pdf-lib doc for saving
  const pdfDocProxy = useRef<any>(null); // pdf.js doc for rendering

  const renderPdfPages = useCallback(async (pdfFile: File) => {
    setIsLoading(true);
    setLoadingMessage('Loading PDF...');
    setError(null);
    setPages([]);

    try {
      const { pdfjsLib, PDFLib } = (window as any);
      
      const arrayBuffer = await pdfFile.arrayBuffer();
      // Use separate ArrayBuffers for each library to avoid conflicts
      originalPdfDoc.current = await PDFLib.PDFDocument.load(arrayBuffer.slice(0));
      pdfDocProxy.current = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      const numPages = pdfDocProxy.current.numPages;
      const newPages: Page[] = [];

      for (let i = 1; i <= numPages; i++) {
        newPages.push({ id: i, originalIndex: i - 1 });
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

  if (isLoading) return <Spinner message={loadingMessage} />;

  if (!file) {
    return (
       <div className="space-y-8">
        <ToolHeader
            title="Rearrange Pages"
            description="Visually reorder, or delete pages from a PDF file. Drag and drop pages to change their order."
        />
         {error && <Alert type="error" message={error} />}
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to organize its pages" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      {error && <Alert type={error.startsWith('Warning:') ? 'info' : 'error'} message={error} />}
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
        {pages.map((page, index) => (
          <div 
            key={page.id}
            draggable
            onDragStart={(e) => handleDragStart(e, page.id)}
            onDragOver={(e) => handleDragOver(e, page.id)}
            onDragEnd={handleDragEnd}
            className={`relative group rounded-lg p-1.5 cursor-move bg-white dark:bg-gray-800 shadow-sm transition-all ${draggedItemId === page.id ? 'ring-2 ring-indigo-500 scale-105' : 'ring-1 ring-transparent'}`}
            >
            <PageThumbnail pdfDoc={pdfDocProxy.current} pageNumber={page.id}>
              {(dataUrl) => (
                <>
                  <img src={dataUrl} alt={`Page ${index + 1}`} className="w-full h-auto rounded-md shadow-inner" />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-colors flex items-center justify-center rounded-lg">
                    <button onClick={() => deletePage(page.id)} className="absolute top-1.5 right-1.5 h-7 w-7 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all hover:bg-red-700" aria-label="Delete page">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <span className="absolute bottom-1.5 left-1.5 bg-gray-900/60 text-white text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">{index + 1}</span>
                </>
              )}
            </PageThumbnail>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 md:static md:bg-transparent md:dark:bg-transparent md:p-0 md:border-none md:backdrop-blur-none flex justify-between items-center">
         <Button onClick={() => setFile(null)} variant="secondary">
            Choose Different PDF
        </Button>
        <Button onClick={savePdf} disabled={pages.length === 0} variant="primary">
          Save New PDF
        </Button>
      </div>
    </div>
  );
};

export default OrganizePdfView;