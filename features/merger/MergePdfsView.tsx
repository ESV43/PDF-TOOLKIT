
import React, { useState, useCallback } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';

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
    <div className="max-w-4xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {!isLoading && files.length === 0 && (
        <FileDropzone onFilesSelected={handleFilesSelected} accept="application/pdf" multiple={true} message="Select two or more PDFs to merge" />
      )}

      {isLoading && <Spinner message="Merging PDFs..." />}

      {!isLoading && files.length > 0 && (
        <div className="space-y-6">
          <div>
             <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">Files to Merge (Drag to reorder)</h3>
            <ul className="space-y-2">
              {files.map((f, index) => (
                <li
                  key={f.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, f.id)}
                  onDragOver={(e) => handleDragOver(e, f.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700 cursor-move transition-opacity ${draggedItemId === f.id ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div className="flex items-center">
                    <span className="font-bold text-slate-500 dark:text-slate-400 mr-3">{index + 1}</span>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{f.file.name}</p>
                  </div>
                  <button onClick={() => removeFile(f.id)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-800/50 text-red-500 dark:text-red-400">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
             <button onClick={() => setFiles([])} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                Clear All
            </button>
            <button onClick={mergePdfs} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400" disabled={files.length < 2}>
              Merge {files.length} PDFs
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MergePdfsView;
