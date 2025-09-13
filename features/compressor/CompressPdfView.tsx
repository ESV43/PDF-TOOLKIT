import React, { useState, useEffect } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

type Quality = 'high' | 'medium' | 'basic';

interface CompressPdfViewProps {
  initialFile?: File | null;
}

const qualitySettings = {
  high: { jpegQuality: 0.85, label: "High Quality", description: "(Good compression, best visuals)" },
  medium: { jpegQuality: 0.65, label: "Medium Quality", description: "(Recommended balance)" },
  basic: { jpegQuality: 0.40, label: "Basic Quality", description: "(Highest compression, lowest size)" },
};

const CompressPdfView: React.FC<CompressPdfViewProps> = ({ initialFile }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [quality, setQuality] = useState<Quality>('medium');
  const [isAggressive, setIsAggressive] = useState(false);
  const [addOcr, setAddOcr] = useState(true);
  
  useEffect(() => {
    if (initialFile) {
        setFile(initialFile);
        setError(null);
        setInfo(null);
    }
  }, [initialFile]);


  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    setInfo(null);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const compressPdf = async () => {
    if (!file) {
      setError('No file selected.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Initializing compression...');
    setError(null);
    setInfo(null);

    try {
      if (isAggressive) {
        await runAggressiveCompression();
      } else {
        await runSmartCompression();
      }
      
      setFile(null); // Reset after success

    } catch (e) {
      console.error(e);
      setError('Failed to compress PDF. It may be corrupted, password-protected, or in an unsupported format.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const runSmartCompression = async () => {
      const { PDFDocument, PDFName, PDFDict, PDFStream } = (window as any).PDFLib;
      if (!file) return;

      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const { jpegQuality } = qualitySettings[quality];
      let processedCount = 0;
      const imageRefs = new Set();
      const pages = pdfDoc.getPages();

      for (const page of pages) {
        const xObjects = page.node.Resources()?.get(PDFName.of('XObject'));
        if (!(xObjects instanceof PDFDict)) continue;

        for (const ref of xObjects.values()) {
          if (imageRefs.has(ref.toString())) continue;
          
          const xObject = pdfDoc.context.lookup(ref);
          if (!(xObject instanceof PDFStream)) continue;

          const subtype = xObject.dict.get(PDFName.of('Subtype'));
          if (subtype !== PDFName.of('Image')) continue;

          imageRefs.add(ref.toString());

          const filter = xObject.dict.get(PDFName.of('Filter'));
          const isJpeg = filter === PDFName.of('DCTDecode') || (Array.isArray(filter) && filter.includes(PDFName.of('DCTDecode')));

          if (!isJpeg) continue;

          processedCount++;
          setLoadingMessage(`Compressing image ${processedCount}...`);

          try {
            const imageBytes = xObject.contents;
            const blob = new Blob([imageBytes], { type: 'image/jpeg' });
            const imageUrl = URL.createObjectURL(blob);

            const loadedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error('Could not load embedded image.'));
              img.src = imageUrl;
            });

            URL.revokeObjectURL(imageUrl);

            const canvas = document.createElement('canvas');
            canvas.width = loadedImg.width;
            canvas.height = loadedImg.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');
            
            ctx.drawImage(loadedImg, 0, 0);
            const newJpegDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
            const newJpegBytes = await fetch(newJpegDataUrl).then(res => res.arrayBuffer());

            xObject.contents = new Uint8Array(newJpegBytes);
            xObject.dict.set(PDFName.of('Length'), newJpegBytes.byteLength);

          } catch (imgError) {
              console.warn(`Skipping an image that could not be processed: ${imgError}`);
          }
        }
      }

      if (processedCount === 0) {
        setInfo("No compressible (JPEG) images were found. For a smaller file, try 'Aggressive Mode'.");
        setIsLoading(false);
        return; // Important: return to prevent file download
      }

      setLoadingMessage('Saving compressed PDF...');
      const pdfBytes = await pdfDoc.save();
      downloadFile(pdfBytes, `compressed_${file.name}`);
  }
  
  const runAggressiveCompression = async () => {
    setLoadingMessage('Loading PDF for aggressive compression...');
    const { pdfjsLib, PDFLib, Tesseract } = (window as any);
    if (!file) return;

    const { PDFDocument, StandardFonts } = PDFLib;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    const numPages = pdf.numPages;

    const newPdfDoc = await PDFDocument.create();
    const { jpegQuality } = qualitySettings[quality];

    let ocrWorker: any = null;
    if (addOcr) {
      setLoadingMessage('Initializing OCR engine...');
      ocrWorker = await Tesseract.createWorker();
      await ocrWorker.load();
      await ocrWorker.loadLanguage('eng');
      await ocrWorker.initialize('eng');
    }

    for (let i = 1; i <= numPages; i++) {
        setLoadingMessage(`Processing page ${i} of ${numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
            const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());
            const jpegImage = await newPdfDoc.embedJpg(jpegBytes);
            
            const newPage = newPdfDoc.addPage([jpegImage.width, jpegImage.height]);
            newPage.drawImage(jpegImage, {
                x: 0,
                y: 0,
                width: newPage.getWidth(),
                height: newPage.getHeight(),
            });

            if (addOcr && ocrWorker) {
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
                      y: newPage.getHeight() - y1, // convert coordinates
                      font,
                      size: fontSize,
                      opacity: 0, // Make text invisible
                  });
              });
            }
        }
        // Yield to the main thread to prevent UI freezing on large files
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    if (ocrWorker) {
      setLoadingMessage('Finalizing OCR...');
      await ocrWorker.terminate();
    }

    setLoadingMessage('Saving compressed PDF...');
    const pdfBytes = await newPdfDoc.save();
    const fileName = addOcr ? `searchable_${file.name}` : `compressed_${file.name}`;
    downloadFile(pdfBytes, fileName);
  }

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
  
  const handleReset = () => {
    setFile(null);
    if(initialFile) {
        window.location.reload();
    }
  }
  
  if (isLoading) return <Spinner message={loadingMessage} />;

  if (!file) {
    return (
        <div className="space-y-8">
            <ToolHeader 
                title="Compress PDF"
                description="Reduce the file size of your PDF while optimizing for visual quality."
            />
            {error && <Alert type="error" message={error} />}
            {info && <Alert type="info" message={info} />}
            <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to compress" />
        </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <ToolHeader 
          title="Compress PDF"
          description="Choose your compression level and mode below."
      />
      {error && <Alert type="error" message={error} />}
      {info && <Alert type="info" message={info} />}
      
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Selected File</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        
        <fieldset>
          <legend className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Compression Level
          </legend>
          <div className="space-y-3">
            {(Object.keys(qualitySettings) as Quality[]).map((key) => (
              <label key={key} htmlFor={key} className="flex items-center p-4 rounded-xl has-[:checked]:bg-indigo-50 has-[:checked]:ring-2 has-[:checked]:ring-indigo-500 dark:has-[:checked]:bg-indigo-900/30 cursor-pointer transition-all bg-gray-100 dark:bg-gray-800">
                <input
                  type="radio"
                  id={key}
                  name="quality"
                  value={key}
                  checked={quality === key}
                  onChange={() => setQuality(key)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="ml-3 text-sm font-medium text-gray-800 dark:text-gray-200">{qualitySettings[key].label} <span className="text-gray-500 dark:text-gray-400 text-xs">{qualitySettings[key].description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        
        <fieldset className="p-4 border border-amber-400 dark:border-amber-700 rounded-xl space-y-4 bg-amber-50/50 dark:bg-amber-900/10">
           <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100 px-2 -mx-2">Advanced Mode</legend>
            <div className="flex items-start">
                <div className="flex items-center h-5">
                    <input 
                        id="aggressive-mode" 
                        type="checkbox"
                        checked={isAggressive}
                        onChange={(e) => setIsAggressive(e.target.checked)}
                        className="focus:ring-amber-500 h-4 w-4 text-amber-600 border-gray-300 rounded" />
                </div>
                <div className="ml-3 text-sm">
                    <label htmlFor="aggressive-mode" className="font-medium text-gray-800 dark:text-gray-200">Enable Aggressive Mode</label>
                    <p className="text-gray-500 dark:text-gray-400">Guarantees size reduction by converting pages to images. <strong className="text-amber-700 dark:text-amber-500">Warning:</strong> text will become unsearchable unless OCR is enabled.</p>
                </div>
            </div>

            {isAggressive && (
              <div className="pl-7 flex items-start">
                  <div className="flex items-center h-5">
                      <input 
                          id="ocr-mode" 
                          type="checkbox"
                          checked={addOcr}
                          onChange={(e) => setAddOcr(e.target.checked)}
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                  </div>
                  <div className="ml-3 text-sm">
                      <label htmlFor="ocr-mode" className="font-medium text-gray-800 dark:text-gray-200">Make PDF searchable (OCR)</label>
                      <p className="text-gray-500 dark:text-gray-400">Recognizes text on the page images, making the final PDF searchable. This increases processing time.</p>
                  </div>
              </div>
            )}
        </fieldset>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 md:static md:bg-transparent md:dark:bg-transparent md:p-0 md:border-none md:backdrop-blur-none flex justify-between items-center">
        <Button onClick={handleReset} variant="secondary">
          {initialFile ? 'Back' : 'Cancel'}
        </Button>
        <Button onClick={compressPdf} variant="primary">
          Compress PDF
        </Button>
      </div>
    </div>
  );
};

export default CompressPdfView;