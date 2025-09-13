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
  isSelected: boolean;
}

const ExtractPagesView: React.FC = () => {
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
        newPages.push({ id: i, originalIndex: i - 1, isSelected: false });
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

  if (isLoading) return <Spinner message={loadingMessage} />;

  if (!file) {
    return (
       <div className="space-y-8">
        <ToolHeader
            title="Extract Pages"
            description="Create a new PDF containing only your selected pages from an existing document."
        />
        {error && <Alert type="error" message={error} />}
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to extract pages from" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      {error && <Alert type={error.startsWith('Warning:') ? 'info' : 'error'} message={error} />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm">
        <h3 className="text-base font-semibold">Select pages to extract ({selectedCount} / {pages.length})</h3>
        <div className="space-x-2 flex-shrink-0">
            <Button onClick={selectAll} variant="secondary" className="!px-3 !py-1.5 !text-xs">Select All</Button>
            <Button onClick={deselectAll} variant="secondary" className="!px-3 !py-1.5 !text-xs">Deselect All</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
        {pages.map((page, index) => (
          <div 
            key={page.id}
            onClick={() => togglePageSelection(page.id)}
            className={`relative group rounded-lg p-1.5 cursor-pointer bg-white dark:bg-gray-800 shadow-sm transition-all ${page.isSelected ? 'ring-2 ring-indigo-500 scale-105' : 'ring-1 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600'}`}
            >
            <PageThumbnail pdfDoc={pdfDocProxy.current} pageNumber={page.id}>
                {(dataUrl) => (
                    <>
                        <img src={dataUrl} alt={`Page ${index + 1}`} className="w-full h-auto rounded-md shadow-inner" />
                         <div className={`absolute inset-0 flex items-center justify-center transition-colors rounded-lg ${page.isSelected ? 'bg-indigo-900/40' : 'bg-black/0 group-hover:bg-black/30'}`}>
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ring-2 ring-white/50 transition-all transform-gpu ${page.isSelected ? 'bg-indigo-500 scale-100' : 'bg-gray-500/50 scale-75 opacity-0 group-hover:opacity-100'}`}>
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
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
        <Button onClick={savePdf} disabled={selectedCount === 0} variant="primary">
          Extract {selectedCount} Pages
        </Button>
      </div>
    </div>
  );
};

export default ExtractPagesView;