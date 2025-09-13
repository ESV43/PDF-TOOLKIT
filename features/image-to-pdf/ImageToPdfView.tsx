import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';
import SuccessView from '../../components/SuccessView';
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

  if (isLoading) return <Spinner message="Creating PDF..." />;
  
  if (generatedPdfInfo) {
    return (
        <SuccessView
            title="PDF Created Successfully!"
            message="Your PDF is ready. You can now download it or send it directly to our compression tool to reduce its file size."
            onReset={() => setGeneratedPdfInfo(null)}
            resetText="Create another PDF"
        >
            <Button onClick={handleDownload} variant="primary">Download PDF</Button>
            <Button onClick={handleCompress} variant="secondary">Compress PDF</Button>
        </SuccessView>
    );
  }

  return (
    <div className="space-y-8 pb-24 md:pb-0">
       <ToolHeader
        title="Images to PDF"
        description="Convert JPG, PNG, and other images into a PDF file. Drag and drop to reorder."
      />

      {error && <Alert type="error" message={error} />}
      
      {images.length === 0 ? (
        <FileDropzone onFilesSelected={handleFilesSelected} accept="image/*" multiple={true} message="Select images to convert to PDF" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
            {images.map((img, index) => (
              <div 
                key={img.id}
                draggable
                onDragStart={(e) => handleDragStart(e, img.id)}
                onDragOver={(e) => handleDragOver(e, img.id)}
                onDragEnd={handleDragEnd}
                className={`relative group rounded-lg p-1.5 cursor-move bg-white dark:bg-gray-800 shadow-sm transition-all ${draggedItemId === img.id ? 'ring-2 ring-indigo-500 scale-105' : 'ring-1 ring-transparent'}`}
                >
                <img src={img.previewUrl} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-md" />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-colors flex items-center justify-center rounded-lg">
                  <button onClick={() => removeImage(img.id)} className="absolute top-1.5 right-1.5 h-7 w-7 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all hover:bg-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <span className="absolute bottom-1.5 left-1.5 bg-gray-900/60 text-white text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 md:static md:bg-transparent md:dark:bg-transparent md:p-0 md:border-none md:backdrop-blur-none flex justify-between items-center">
             <Button onClick={() => setImages([])} variant="secondary">
                Clear All
            </Button>
            <Button onClick={convertToPdf} disabled={images.length === 0} variant="primary">
              Convert to PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageToPdfView;