import React, { useState, useCallback } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

interface DraggableFile {
  id: number;
  file: File;
}

const MergePdfsView: React.FC = () => {
  const [files, setFiles] = useState<DraggableFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setError(null);
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length !== selectedFiles.length) {
      setError('Only PDF files are allowed. Please select again.');
    }
    const newFiles = pdfFiles.map((file, index) => ({ id: Date.now() + index, file }));
    setFiles(f => [...f, ...newFiles]);
  };

  const removeFile = (id: number) => {
    setFiles(files.filter(f => f.id !== id));
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, id: number) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, id: number) => {
    e.preventDefault();
    if (draggedItemId === null || draggedItemId === id) return;

    const draggedItemIndex = files.findIndex(f => f.id === draggedItemId);
    const targetItemIndex = files.findIndex(f => f.id === id);

    if (draggedItemIndex === -1 || targetItemIndex === -1) return;

    const newFiles = [...files];
    const [draggedItem] = newFiles.splice(draggedItemIndex, 1);
    newFiles.splice(targetItemIndex, 0, draggedItem);
    setFiles(newFiles);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };


  const mergePdfs = async () => {
    if (files.length < 2) {
      setError('Please select at least two PDF files to merge.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { PDFDocument } = (window as any).PDFLib;
      const mergedPdf = await PDFDocument.create();

      for (const draggableFile of files) {
        const arrayBuffer = await draggableFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setFiles([]);

    } catch (e) {
      console.error(e);
      setError('An error occurred while merging the PDFs. The file might be corrupted or password-protected.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <ToolHeader
        title="Merge PDF"
        description="Combine multiple PDFs into a single, unified document. Drag and drop to reorder files."
      />

      {error && <Alert type="error" message={error} />}
      
      {isLoading && <Spinner message="Merging PDFs..." />}

      {!isLoading && files.length === 0 && (
        <FileDropzone onFilesSelected={handleFilesSelected} accept="application/pdf" multiple={true} message="Select two or more PDFs to merge" />
      )}

      {!isLoading && files.length > 0 && (
        <div className="space-y-6">
          <ul className="space-y-3">
            {files.map((f, index) => (
              <li
                key={f.id}
                draggable
                onDragStart={(e) => handleDragStart(e, f.id)}
                onDragOver={(e) => handleDragOver(e, f.id)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 cursor-move transition-opacity ${draggedItemId === f.id ? 'opacity-50 ring-2 ring-indigo-500' : 'opacity-100'}`}
              >
                <div className="flex items-center truncate">
                  <span className="font-bold text-gray-500 dark:text-gray-400 mr-4">{index + 1}</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{f.file.name}</p>
                </div>
                <button onClick={() => removeFile(f.id)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 ml-2">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </li>
            ))}
          </ul>
          
          <div className="md:hidden">
            <FileDropzone onFilesSelected={handleFilesSelected} accept="application/pdf" multiple={true} message="Add more PDF files" />
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 md:static md:bg-transparent md:dark:bg-transparent md:p-0 md:border-none md:backdrop-blur-none flex justify-between items-center">
             <Button onClick={() => setFiles([])} variant="secondary">
                Clear All
            </Button>
            <Button onClick={mergePdfs} disabled={files.length < 2} variant="primary">
              Merge {files.length} PDFs
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MergePdfsView;