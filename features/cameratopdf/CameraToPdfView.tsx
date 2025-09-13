import React, { useState, useRef, useEffect, useCallback } from 'react';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import { ToolType } from '../../types';

interface ProcessedImage {
  id: number;
  dataUrl: string;
}

interface CameraToPdfViewProps {
  navigateToTool: (toolId: ToolType, file: File) => void;
}


const CameraToPdfView: React.FC<CameraToPdfViewProps> = ({ navigateToTool }) => {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCvReady, setIsCvReady] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [generatedPdfInfo, setGeneratedPdfInfo] = useState<{ blob: Blob; fileName: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const checkCvReady = () => {
      if ((window as any).cv && document.body.classList.contains('opencv-ready')) {
        setIsCvReady(true);
      } else {
        setTimeout(checkCvReady, 100);
      }
    };
    checkCvReady();
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    const startCameraStream = async () => {
      if (isCameraActive && videoRef.current) {
        setError(null);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          });
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        } catch (err) {
          console.error("Error accessing camera:", err);
          setError("Could not access the camera. Please ensure you have given permission in your browser settings.");
          setIsCameraActive(false);
        }
      } else {
        stopCamera();
      }
    };
    startCameraStream();

    return () => {
      stopCamera();
    };
  }, [isCameraActive, stopCamera]);


  const handleCaptureAndProcess = async () => {
    if (!videoRef.current) return;
    setError(null);
    setIsProcessingImage(true);
    setProcessingMessage('Capturing...');

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        setError("Could not get canvas context.");
        setIsProcessingImage(false);
        return;
    };
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    try {
        setProcessingMessage('Finding document...');
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI update

        const cv = (window as any).cv;
        let src = cv.imread(canvas);
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
        let edges = new cv.Mat();
        cv.Canny(blurred, edges, 75, 200);
        
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        let maxArea = -1;
        let bestContour = null;
        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let area = cv.contourArea(cnt, false);
            if (area > maxArea) {
                let peri = cv.arcLength(cnt, true);
                let approx = new cv.Mat();
                cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
                if (approx.rows === 4) {
                    maxArea = area;
                    bestContour = approx.clone();
                }
                approx.delete();
            }
            cnt.delete();
        }

        if (!bestContour) {
            throw new Error("No document outline found. Try a contrasting background and better lighting.");
        }

        setProcessingMessage('Applying filter...');
        await new Promise(resolve => setTimeout(resolve, 50));

        const corners = [
            {x: bestContour.data32S[0], y: bestContour.data32S[1]},
            {x: bestContour.data32S[2], y: bestContour.data32S[3]},
            {x: bestContour.data32S[4], y: bestContour.data32S[5]},
            {x: bestContour.data32S[6], y: bestContour.data32S[7]},
        ].sort((a,b) => a.y - b.y);

        const top = [corners[0], corners[1]].sort((a,b) => a.x - b.x);
        const bottom = [corners[2], corners[3]].sort((a,b) => a.x - b.x);
        const [tl, tr, bl, br] = [...top, ...bottom];

        const widthA = Math.hypot(br.x - bl.x, br.y - bl.y);
        const widthB = Math.hypot(tr.x - tl.x, tr.y - tl.y);
        const maxWidth = Math.max(widthA, widthB);

        const heightA = Math.hypot(tr.x - br.x, tr.y - br.y);
        const heightB = Math.hypot(tl.x - bl.x, tl.y - bl.y);
        const maxHeight = Math.max(heightA, heightB);

        let warped = new cv.Mat();
        let dsize = new cv.Size(maxWidth, maxHeight);
        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y]);
        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxWidth, 0, 0, maxHeight, maxWidth, maxHeight]);
        let M = cv.getPerspectiveTransform(srcTri, dstTri);
        cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        // Convert to grayscale for contrast adjustment
        cv.cvtColor(warped, warped, cv.COLOR_RGBA2GRAY, 0);
        
        // ** FIX: Replaced adaptiveThreshold with a more stable contrast/brightness adjustment **
        // This enhances the "scanned" look without blowing out the image to pure white.
        const alpha = 1.5; // Contrast control (1.0-3.0)
        const beta = 10;    // Brightness control (0-100)
        warped.convertTo(warped, -1, alpha, beta);


        const outputCanvas = document.createElement('canvas');
        cv.imshow(outputCanvas, warped);
        const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.95);
        setImages(prevImages => [...prevImages, { id: Date.now(), dataUrl }]);

        // Cleanup
        src.delete(); gray.delete(); blurred.delete(); edges.delete(); contours.delete(); hierarchy.delete(); bestContour.delete(); warped.delete(); srcTri.delete(); dstTri.delete(); M.delete();
    } catch (err: any) {
        setError(err.message || "An error occurred during image processing.");
    } finally {
        setIsProcessingImage(false);
        setProcessingMessage('');
    }
  };


  const removeImage = (id: number) => {
    setImages(images.filter(img => img.id !== id));
  };
  
  const convertToPdf = async () => {
    if (images.length === 0) {
      setError('Please capture at least one image.');
      return;
    }
    setIsCreatingPdf(true);
    setError(null);

    try {
      setIsCameraActive(false); // Turn off camera
      const { PDFDocument } = (window as any).PDFLib;
      const pdfDoc = await PDFDocument.create();

      for (const img of images) {
        const jpgImageBytes = await fetch(img.dataUrl).then(res => res.arrayBuffer());
        const jpgImage = await pdfDoc.embedJpg(jpgImageBytes);
        const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
        page.drawImage(jpgImage, {
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: page.getHeight(),
        });
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const fileName = `scan_${new Date().toISOString().slice(0,10)}.pdf`;
      setGeneratedPdfInfo({ blob, fileName });
      
      setImages([]);
    } catch (e) {
      console.error(e);
      setError('An error occurred while creating the PDF.');
    } finally {
      setIsCreatingPdf(false);
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
  
  const resetScanner = () => {
    setGeneratedPdfInfo(null);
    setImages([]);
    setError(null);
    setIsCameraActive(false);
  }

  if (isCreatingPdf) return <Spinner message="Creating PDF..." />;

  const renderInitialView = () => (
    <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md max-w-lg mx-auto">
        <h2 className="text-2xl font-bold mb-4">Document Scanner</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Use your device's camera to create high-quality, cropped scans.</p>
        {!isCvReady ? (
            <Spinner message="Initializing scanner engine..." />
        ) : (
            <button onClick={() => setIsCameraActive(true)} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75">
                Start Scanner
            </button>
        )}
    </div>
  );
  
  const renderSuccessView = () => (
    <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md max-w-lg mx-auto">
        <div className="mb-4 text-green-500 bg-green-100 dark:bg-green-900 rounded-full h-16 w-16 mx-auto flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Scan PDF Created!</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Your scanned document is ready. You can download it now or compress it to reduce the file size.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={handleDownload} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75">
                Download PDF
            </button>
            <button onClick={handleCompress} className="px-6 py-3 font-semibold text-sky-700 bg-sky-100 rounded-lg hover:bg-sky-200 dark:bg-slate-700 dark:text-sky-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75">
                Compress PDF
            </button>
        </div>
        <button onClick={resetScanner} className="mt-6 text-sm text-slate-500 hover:underline">Scan another document</button>
    </div>
  );

  const renderScannerView = () => (
     <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-grow md:w-2/3 bg-black rounded-lg overflow-hidden relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
            {isProcessingImage && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Spinner message={processingMessage} />
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center bg-gradient-to-t from-black/50 to-transparent">
                <button onClick={handleCaptureAndProcess} disabled={isProcessingImage} className="h-16 w-16 bg-white rounded-full border-4 border-slate-400 focus:border-sky-500 focus:outline-none ring-2 ring-offset-2 ring-offset-black/50 ring-transparent focus:ring-sky-500 transition-all disabled:bg-slate-300" aria-label="Capture and Process Image"></button>
            </div>
        </div>
        <div className="flex-shrink-0 md:w-1/3">
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">Scanned Pages ({images.length})</h3>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-inner min-h-[24rem] max-h-96 overflow-y-auto space-y-2">
            {images.length === 0 ? (
              <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-8">Point your camera at a document and press the capture button.</p>
            ) : (
              images.map((img, index) => (
                <div key={img.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md group">
                    <div className="flex items-center">
                        <img src={img.dataUrl} alt={`Scan ${index + 1}`} className="w-16 h-16 object-contain bg-slate-200 dark:bg-slate-600 p-1 rounded-md mr-3" />
                        <span className="font-medium text-sm">Page {index + 1}</span>
                    </div>
                    <button onClick={() => removeImage(img.id)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-800/50 text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <button onClick={() => setIsCameraActive(false)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                Stop Scanner
            </button>
            <button onClick={convertToPdf} className="flex-1 px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400" disabled={images.length === 0}>
                Create PDF
            </button>
          </div>
        </div>
    </div>
  );
  
  let content;
  if (generatedPdfInfo) {
      content = renderSuccessView();
  } else if (isCameraActive) {
      content = renderScannerView();
  } else {
      content = renderInitialView();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {error && <Alert type="error" message={error} />}
      {content}
    </div>
  );
};

export default CameraToPdfView;