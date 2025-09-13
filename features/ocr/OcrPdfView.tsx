import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

const OcrPdfView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const applyOcr = async () => {
    if (!file) {
      setError('No file selected.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setLoadingMessage('Loading PDF for OCR...');
    
    const { pdfjsLib, PDFLib, Tesseract } = (window as any);
    
    try {
        const { PDFDocument, StandardFonts } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        const numPages = pdf.numPages;

        const newPdfDoc = await PDFDocument.create();
        
        setLoadingMessage('Initializing OCR engine...');
        const ocrWorker = await Tesseract.createWorker();
        await ocrWorker.load();
        await ocrWorker.loadLanguage('eng');
        await ocrWorker.initialize('eng');
        
        for (let i = 1; i <= numPages; i++) {
            setLoadingMessage(`Processing page ${i} of ${numPages}...`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                // Embed the original page as an image
                const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
                const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());
                const jpegImage = await newPdfDoc.embedJpg(jpegBytes);
                
                const newPage = newPdfDoc.addPage([jpegImage.width, jpegImage.height]);
                newPage.drawImage(jpegImage, {
                    x: 0,
                    y: 0,
                    width: newPage.getWidth(),
                    height: newPage.getHeight(),
                });

                setLoadingMessage(`Performing OCR on page ${i}...`);
                const { data } = await ocrWorker.recognize(canvas);
                const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);
              
                data.words.forEach((word: any) => {
                    const { text, bbox } = word;
                    const [x0, y0, x1, y1] = [bbox.x0, bbox.y0, bbox.x1, bbox.y1];
                  
                    const textWidth = font.widthOfTextAtSize(text, 1);
                    const desiredWidth = x1 - x0;
                    const fontSize = (desiredWidth / textWidth);

                    newPage.drawText(text, {
                        x: x0,
                        y: newPage.getHeight() - y1,
                        font,
                        size: fontSize,
                        opacity: 0, // Invisible text layer for searchability
                    });
                });
            }
            // Yield to the main thread to prevent UI freezing on large files
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    
        setLoadingMessage('Finalizing OCR...');
        await ocrWorker.terminate();
        
        setLoadingMessage('Saving searchable PDF...');
        const pdfBytes = await newPdfDoc.save();
        downloadFile(pdfBytes, `ocr_${file.name}`);
        setFile(null);

    } catch (e) {
      console.error(e);
      setError('Failed to process PDF. It may be corrupted or password-protected.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const downloadFile = (bytes: Uint8Array, fileName: string) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  return (
    <div className="space-y-8">
      <ToolHeader 
        title="PDF OCR"
        description="Make a scanned, non-searchable PDF file searchable and selectable by adding an invisible text layer."
      />

      {error && <Alert type="error" message={error} />}
      
      {isLoading && <Spinner message={loadingMessage} />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a scanned PDF to make it searchable" />
      )}

      {!isLoading && file && (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm space-y-6 text-center">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Selected File</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              This tool will process each page to recognize text, creating an invisible layer that makes your PDF searchable. This can take some time for large documents.
            </p>
          
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button onClick={() => setFile(null)} variant="secondary">
                    Cancel
                </Button>
                <Button onClick={applyOcr} variant="primary">
                    Make Searchable
                </Button>
            </div>
        </div>
      )}
    </div>
  );
};

export default OcrPdfView;