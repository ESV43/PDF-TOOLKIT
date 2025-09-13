import React, { useState, useEffect, useCallback } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';

type ImageFormat = 'jpeg' | 'png';

const PdfToImagesView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imageFormat, setImageFormat] = useState<ImageFormat>('jpeg');
  const [quality, setQuality] = useState(0.92); // For JPEG

  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const convertToImages = async () => {
    if (!file) {
      setError('No file selected.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { pdfjsLib, JSZip } = (window as any);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const zip = new JSZip();

      for (let i = 1; i <= numPages; i++) {
        setLoadingMessage(`Converting page ${i} of ${numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          const dataUrl = canvas.toDataURL(`image/${imageFormat}`, imageFormat === 'jpeg' ? quality : undefined);
          const imageData = dataUrl.split(',')[1];
          const fileName = `page_${String(i).padStart(4, '0')}.${imageFormat === 'jpeg' ? 'jpg' : 'png'}`;
          zip.file(fileName, imageData, { base64: true });
        }
        
        // Yield to the main thread to prevent UI freezing on large files
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      setLoadingMessage('Creating zip file...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace(/\.pdf$/i, '')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setFile(null);
    } catch (e) {
      console.error(e);
      setError('Failed to convert PDF. It may be corrupted or password-protected.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message={loadingMessage} />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to convert to images" />
      )}

      {!isLoading && file && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md space-y-6">
          <div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Selected File</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{file.name}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Image Format</label>
              <div className="flex gap-2">
                <button onClick={() => setImageFormat('jpeg')} className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${imageFormat === 'jpeg' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  JPG
                </button>
                <button onClick={() => setImageFormat('png')} className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${imageFormat === 'png' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  PNG
                </button>
              </div>
            </div>
            {imageFormat === 'jpeg' && (
              <div>
                <label htmlFor="quality" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  JPG Quality: {Math.round(quality * 100)}%
                </label>
                <input
                  type="range"
                  id="quality"
                  min="0.1"
                  max="1"
                  step="0.01"
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 mt-2"
                />
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setFile(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
              Choose Different PDF
            </button>
            <button onClick={convertToImages} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75">
              Convert to Images
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfToImagesView;
