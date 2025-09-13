import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import { ToolType } from '../../types';

interface DraggableImage {
  id: number;
  file: File;
  previewUrl: string;
}

interface ImageToPdfViewProps {
  navigateToTool: (toolId: ToolType, file: File) => void;
}

const ImageToPdfView: React.FC<ImageToPdfViewProps> = ({ navigateToTool }) => {
  const [images, setImages] = useState<DraggableImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  const [generatedPdfInfo, setGeneratedPdfInfo] = useState<{ blob: Blob; fileName: string } | null>(null);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setError(null);
    setGeneratedPdfInfo(null);
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== selectedFiles.length) {
      setError('Only image files (JPG, PNG, etc.) are allowed.');
    }
    const newImages = imageFiles.map((file, index) => ({
      id: Date.now() + index,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages(f => [...f, ...newImages]);
  };
  
  const removeImage = (id: number) => {
    const imageToRemove = images.find(img => img.id === id);
    if(imageToRemove) {
      URL.revokeObjectURL(imageToRemove.previewUrl);
    }
    setImages(images.filter(img => img.id !== id));
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault();
    if (draggedItemId === null || draggedItemId === id) return;

    const draggedItemIndex = images.findIndex(img => img.id === draggedItemId);
    const targetItemIndex = images.findIndex(img => img.id === id);

    if (draggedItemIndex === -1 || targetItemIndex === -1) return;

    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedItemIndex, 1);
    newImages.splice(targetItemIndex, 0, draggedItem);
    setImages(newImages);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };
  
  const convertToPdf = async () => {
    if (images.length === 0) {
      setError('Please select at least one image.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { PDFDocument } = (window as any).PDFLib;
      const pdfDoc = await PDFDocument.create();

      for (const img of images) {
        const arrayBuffer = await img.file.arrayBuffer();
        let embeddedImage;
        if (img.file.type === 'image/jpeg' || img.file.type === 'image/jpg') {
            embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
        } else {
            embeddedImage = await pdfDoc.embedPng(arrayBuffer);
        }

        const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: embeddedImage.width,
          height: embeddedImage.height,
        });
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setGeneratedPdfInfo({ blob, fileName: 'converted-images.pdf' });
      
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
    } catch (e) {
      console.error(e);
      setError('An error occurred while converting the images.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedPdfInfo) return;
    const url = URL.createObjectURL(generatedPdfInfo.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedPdfInfo.fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleCompress = () => {
    if (!generatedPdfInfo) return;
    const file = new File([generatedPdfInfo.blob], generatedPdfInfo.fileName, { type: 'application/pdf' });
    navigateToTool('COMPRESS_PDF', file);
  };

  const renderSuccessView = () => (
    <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md max-w-lg mx-auto">
        <div className="mb-4 text-green-500 bg-green-100 dark:bg-green-900 rounded-full h-16 w-16 mx-auto flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">PDF Created Successfully!</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Your PDF is ready. You can now download it or send it directly to our compression tool to reduce its file size.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={handleDownload} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75">
                Download PDF
            </button>
            <button onClick={handleCompress} className="px-6 py-3 font-semibold text-sky-700 bg-sky-100 rounded-lg hover:bg-sky-200 dark:bg-slate-700 dark:text-sky-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75">
                Compress PDF
            </button>
        </div>
         <button onClick={() => setGeneratedPdfInfo(null)} className="mt-6 text-sm text-slate-500 hover:underline">Create another PDF</button>
    </div>
  );

  if (isLoading) return <Spinner message="Creating PDF..." />;
  if (generatedPdfInfo) return renderSuccessView();

  return (
    <div className="max-w-6xl mx-auto">
      {error && <Alert type="error" message={error} />}
      
      {images.length === 0 ? (
        <FileDropzone onFilesSelected={handleFilesSelected} accept="image/*" multiple={true} message="Select images to convert to PDF" />
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">Images to Convert (Drag to reorder)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {images.map((img, index) => (
                <div 
                  key={img.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, img.id)}
                  onDragOver={(e) => handleDragOver(e, img.id)}
                  onDragEnd={handleDragEnd}
                  className={`relative group border-2 rounded-lg p-1 cursor-move bg-white dark:bg-slate-800 shadow-sm transition-all ${draggedItemId === img.id ? 'border-sky-500 scale-105' : 'border-transparent'}`}
                  >
                  <img src={img.previewUrl} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-md" />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-colors flex items-center justify-center">
                    <button onClick={() => removeImage(img.id)} className="absolute top-1 right-1 h-6 w-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 bg-slate-800 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
             <button onClick={() => setImages([])} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                Clear All
            </button>
            <button onClick={convertToPdf} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400" disabled={images.length === 0}>
              Convert to PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageToPdfView;