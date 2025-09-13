import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';
import { degrees, rgb, StandardFonts } from 'pdf-lib';

type WatermarkType = 'text' | 'image';
type Position = 'topLeft' | 'topCenter' | 'topRight' | 'midLeft' | 'midCenter' | 'midRight' | 'botLeft' | 'botCenter' | 'botRight';

const AddWatermarkView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Watermark state
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.3);
  const [position, setPosition] = useState<Position>('midCenter');
  const [rotation, setRotation] = useState(-45);
  const [fontSize, setFontSize] = useState(72);
  const [color, setColor] = useState("#ff0000");


  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const handleImageSelected = (selectedFiles: File[]) => {
      const imgFile = selectedFiles.find(f => f.type.startsWith('image/'));
      if (imgFile) {
          setImageFile(imgFile);
          const reader = new FileReader();
          reader.onloadend = () => {
              setImagePreview(reader.result as string);
          };
          reader.readAsDataURL(imgFile);
      } else {
          setError("Please select a valid image file (PNG, JPG).");
      }
  }

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    } : { r: 0, g: 0, b: 0 };
  }

  const addWatermark = async () => {
    if (!file) {
      setError('No PDF file selected.');
      return;
    }
    if(watermarkType === 'text' && !text) {
      setError('Watermark text cannot be empty.');
      return;
    }
    if(watermarkType === 'image' && !imageFile) {
      setError('No watermark image selected.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { PDFDocument } = (window as any).PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let watermarkElement: any = null;
      let wmDims = { width: 0, height: 0 };

      if (watermarkType === 'text') {
        wmDims = helveticaBold.sizeAtHeight(fontSize);
        wmDims.width = helveticaBold.widthOfTextAtSize(text, fontSize);
      } else if (imageFile) {
        const imgBytes = await imageFile.arrayBuffer();
        if(imageFile.type.includes('png')) {
            watermarkElement = await pdfDoc.embedPng(imgBytes);
        } else {
            watermarkElement = await pdfDoc.embedJpg(imgBytes);
        }
        wmDims = watermarkElement.scale(0.5); // Default scale
      }

      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();
        
        let x, y;
        const margin = 50;
        // Calculate position
        switch(position) {
            case 'topLeft': x = margin; y = height - margin - wmDims.height; break;
            case 'topCenter': x = width / 2 - wmDims.width / 2; y = height - margin - wmDims.height; break;
            case 'topRight': x = width - margin - wmDims.width; y = height - margin - wmDims.height; break;
            case 'midLeft': x = margin; y = height / 2 - wmDims.height / 2; break;
            case 'midCenter': x = width / 2 - wmDims.width / 2; y = height / 2 - wmDims.height / 2; break;
            case 'midRight': x = width - margin - wmDims.width; y = height / 2 - wmDims.height / 2; break;
            case 'botLeft': x = margin; y = margin; break;
            case 'botCenter': x = width / 2 - wmDims.width / 2; y = margin; break;
            case 'botRight': x = width - margin - wmDims.width; y = margin; break;
        }

        if (watermarkType === 'text') {
             page.drawText(text, {
                x, y,
                font: helveticaBold,
                size: fontSize,
                color: hexToRgb(color),
                opacity,
                rotate: degrees(rotation),
             });
        } else if (watermarkElement) {
            page.drawImage(watermarkElement, {
                x, y,
                width: wmDims.width,
                height: wmDims.height,
                opacity,
                rotate: degrees(rotation),
            });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watermarked_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setFile(null);

    } catch (e) {
      console.error(e);
      setError('Failed to add watermark. The file might be corrupted.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const PositionButton: React.FC<{ value: Position }> = ({ value }) => (
    <button
      onClick={() => setPosition(value)}
      className={`w-full h-12 rounded-lg transition-colors ${position === value ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
      aria-label={`Position ${value}`}
     />
  );

  const renderOptions = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Selected File</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{file?.name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Watermark Type</label>
                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <button onClick={() => setWatermarkType('text')} className={`w-full py-2 text-sm font-medium rounded-full ${watermarkType==='text' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm':'text-gray-600 dark:text-gray-300'}`}>Text</button>
                    <button onClick={() => setWatermarkType('image')} className={`w-full py-2 text-sm font-medium rounded-full ${watermarkType==='image' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm':'text-gray-600 dark:text-gray-300'}`}>Image</button>
                </div>
             </div>

            {watermarkType === 'text' ? (
                <div className="space-y-4">
                    <div>
                         <label htmlFor="watermarkText" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Text</label>
                         <input type="text" id="watermarkText" value={text} onChange={e => setText(e.target.value)} className="mt-1 block w-full input px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label htmlFor="fontSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Font Size: <span className="font-bold">{fontSize}pt</span></label>
                             <input type="range" id="fontSize" min="8" max="200" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 mt-2 accent-indigo-600" />
                        </div>
                        <div>
                             <label htmlFor="fontColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
                             <input type="color" id="fontColor" value={color} onChange={e => setColor(e.target.value)} className="mt-1 h-10 w-full p-0 border-0 bg-transparent cursor-pointer" />
                        </div>
                    </div>
                </div>
            ) : (
                <div>
                    {imagePreview ? (
                        <div className="text-center space-y-2">
                            <img src={imagePreview} alt="Watermark preview" className="max-h-40 mx-auto rounded-md border dark:border-gray-700" />
                            <Button variant="secondary" onClick={() => {setImageFile(null); setImagePreview(null)}}>Change Image</Button>
                        </div>
                    ) : (
                       <FileDropzone onFilesSelected={handleImageSelected} accept="image/*" message="Select watermark image" />
                    )}
                </div>
            )}
             <div>
                 <label htmlFor="opacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Opacity: <span className="font-bold">{Math.round(opacity*100)}%</span></label>
                 <input type="range" id="opacity" min="0" max="1" step="0.05" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 mt-2 accent-indigo-600" />
            </div>
             <div>
                 <label htmlFor="rotation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rotation: <span className="font-bold">{rotation}°</span></label>
                 <input type="range" id="rotation" min="-180" max="180" value={rotation} onChange={e => setRotation(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 mt-2 accent-indigo-600" />
            </div>
        </div>
        
        <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Position</label>
             <div className="grid grid-cols-3 gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <PositionButton value="topLeft" />
                <PositionButton value="topCenter" />
                <PositionButton value="topRight" />
                <PositionButton value="midLeft" />
                <PositionButton value="midCenter" />
                <PositionButton value="midRight" />
                <PositionButton value="botLeft" />
                <PositionButton value="botCenter" />
                <PositionButton value="botRight" />
             </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button onClick={() => setFile(null)} variant="secondary">
          Cancel
        </Button>
        <Button onClick={addWatermark} variant="primary">
          Add Watermark
        </Button>
      </div>

    </div>
  );

  return (
    <div className="space-y-8">
      <ToolHeader 
        title="Add Watermark"
        description="Stamp an image or text over your PDF pages with various customization options."
      />

      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message="Adding watermark to PDF..." />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to add a watermark" />
      )}

      {!isLoading && file && renderOptions()}
    </div>
  );
};

export default AddWatermarkView;