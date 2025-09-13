import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';

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

  return (
    <div className="max-w-4xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message="Adding page numbers..." />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to add page numbers" />
      )}

      {!isLoading && file && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md space-y-6">
          <div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Selected File</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{file.name}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Position</label>
              <div className="flex gap-2">
                {(['footer', 'header'] as Position[]).map(pos => (
                    <button key={pos} onClick={() => setPosition(pos)} className={`capitalize w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${position === pos ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                        {pos}
                    </button>
                ))}
              </div>
            </div>
            {/* Alignment */}
             <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Alignment</label>
              <div className="flex gap-2">
                 {(['left', 'center', 'right'] as Alignment[]).map(align => (
                    <button key={align} onClick={() => setAlignment(align)} className={`capitalize w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${alignment === align ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                        {align}
                    </button>
                ))}
              </div>
            </div>
             {/* Start Number */}
            <div>
                <label htmlFor="startNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Start numbering from</label>
                <input
                    type="number"
                    id="startNumber"
                    value={startNumber}
                    onChange={(e) => setStartNumber(parseInt(e.target.value, 10) || 1)}
                    min="1"
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
            </div>
            {/* Page Range */}
            <div>
                <label htmlFor="pageRange" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Pages to number (optional)</label>
                <input
                    type="text"
                    id="pageRange"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                    placeholder="e.g., 1-5, 8, 10-12"
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
                 <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave blank to number all pages.</p>
            </div>
          </div>


          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setFile(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
              Choose Different PDF
            </button>
            <button onClick={addNumbers} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75">
              Add Page Numbers
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddPageNumbersView;
