import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

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

  const renderOptions = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Selected File</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{file?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Image Format</label>
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-full">
            <button onClick={() => setImageFormat('jpeg')} className={`w-full px-4 py-2 text-sm font-medium rounded-full transition-colors ${imageFormat === 'jpeg' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
              JPG
            </button>
            <button onClick={() => setImageFormat('png')} className={`w-full px-4 py-2 text-sm font-medium rounded-full transition-colors ${imageFormat === 'png' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>
              PNG
            </button>
          </div>
        </div>
        {imageFormat === 'jpeg' && (
          <div>
            <label htmlFor="quality" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              JPG Quality: <span className="font-bold text-indigo-600 dark:text-indigo-400">{Math.round(quality * 100)}%</span>
            </label>
            <input
              type="range"
              id="quality"
              min="0.1"
              max="1"
              step="0.01"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 mt-3 accent-indigo-600"
            />
          </div>
        )}
      </div>
      
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button onClick={() => setFile(null)} variant="secondary">
          Cancel
        </Button>
        <Button onClick={convertToImages} variant="primary">
          Convert to Images
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <ToolHeader
        title="PDF to Images"
        description="Convert each page of a PDF into JPG or PNG images, downloaded as a ZIP file."
      />
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message={loadingMessage} />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to convert to images" />
      )}

      {!isLoading && file && renderOptions()}
    </div>
  );
};

export default PdfToImagesView;