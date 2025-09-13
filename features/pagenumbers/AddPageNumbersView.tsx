import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

type Position = 'header' | 'footer';
type Alignment = 'left' | 'center' | 'right';

const AddPageNumbersView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>('footer');
  const [alignment, setAlignment] = useState<Alignment>('center');
  const [startNumber, setStartNumber] = useState(1);
  const [pageRange, setPageRange] = useState('');

  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const addNumbers = async () => {
    if (!file) {
      setError('No file selected.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { PDFDocument, StandardFonts, rgb } = (window as any).PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      // Parse page range
      let pagesToNumber = Array.from({ length: totalPages }, (_, i) => i); // Default to all pages
      if (pageRange.trim() !== '') {
        pagesToNumber = [];
        const ranges = pageRange.split(',');
        for (const range of ranges) {
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(s => parseInt(s.trim()));
                 if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= end; i++) {
                        pagesToNumber.push(i - 1);
                    }
                }
            } else {
                const pageNum = parseInt(range.trim());
                if(!isNaN(pageNum)) {
                    pagesToNumber.push(pageNum - 1);
                }
            }
        }
        pagesToNumber = [...new Set(pagesToNumber)].filter(p => p >= 0 && p < totalPages).sort((a,b) => a-b);
      }

      for (let i = 0; i < pagesToNumber.length; i++) {
        const pageIndex = pagesToNumber[i];
        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        const pageNumber = startNumber + i;

        let x: number;
        const y = position === 'header' ? height - 40 : 40;
        const text = `${pageNumber}`;
        const textSize = 12;
        const textWidth = helveticaFont.widthOfTextAtSize(text, textSize);

        if (alignment === 'left') {
          x = 40;
        } else if (alignment === 'right') {
          x = width - 40 - textWidth;
        } else { // center
          x = (width - textWidth) / 2;
        }

        page.drawText(text, { x, y, size: textSize, font: helveticaFont, color: rgb(0, 0, 0) });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `numbered_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setFile(null);

    } catch (e) {
      console.error(e);
      setError('Failed to add page numbers. The file might be corrupted or password-protected.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderOptions = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Selected File</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{file?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Position</label>
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-full">
            {(['header', 'footer'] as Position[]).map(pos => (
                <button key={pos} onClick={() => setPosition(pos)} className={`capitalize w-full px-4 py-2 text-sm font-medium rounded-full transition-colors ${position === pos ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
                    {pos}
                </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Alignment</label>
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-full">
             {(['left', 'center', 'right'] as Alignment[]).map(align => (
                <button key={align} onClick={() => setAlignment(align)} className={`capitalize w-full px-4 py-2 text-sm font-medium rounded-full transition-colors ${alignment === align ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
                    {align}
                </button>
            ))}
          </div>
        </div>
        <div>
            <label htmlFor="startNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start numbering from</label>
            <input
                type="number"
                id="startNumber"
                value={startNumber}
                onChange={(e) => setStartNumber(parseInt(e.target.value, 10) || 1)}
                min="1"
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
        </div>
        <div>
            <label htmlFor="pageRange" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pages to number (optional)</label>
            <input
                type="text"
                id="pageRange"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="e.g., 1-5, 8, 10-12"
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
             <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave blank to number all pages.</p>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button onClick={() => setFile(null)} variant="secondary">
          Cancel
        </Button>
        <Button onClick={addNumbers} variant="primary">
          Add Page Numbers
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <ToolHeader 
        title="Add Page Numbers"
        description="Insert page numbers into your PDF at various positions and styles."
      />
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message="Adding page numbers..." />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to add page numbers" />
      )}

      {!isLoading && file && renderOptions()}
    </div>
  );
};

export default AddPageNumbersView;