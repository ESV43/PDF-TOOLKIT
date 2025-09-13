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

interface Point { x: number; y: number; }
type ViewState = 'INITIAL' | 'SCANNING' | 'EDITING' | 'FILTERING' | 'SUCCESS';
type Corner = 'tl' | 'tr' | 'bl' | 'br';
type FilterType = 'normal' | 'bw' | 'enhance';


const CameraToPdfView: React.FC<CameraToPdfViewProps> = ({ navigateToTool }) => {
  const [scannedPages, setScannedPages] = useState<ProcessedImage[]>([]);
  const [viewState, setViewState] = useState<ViewState>('INITIAL');
  const [error, setError] = useState<string | null>(null);
  const [isCvReady, setIsCvReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [generatedPdfInfo, setGeneratedPdfInfo] = useState<{ blob: Blob; fileName: string } | null>(null);

  // States for the editing & filtering flow
  const [capturedImage, setCapturedImage] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [corners, setCorners] = useState<{ tl: Point; tr: Point; bl: Point; br: Point } | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<Corner | null>(null);
  const [croppedImage, setCroppedImage] = useState<{ dataUrl: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('normal');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

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
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, []);
  
  const startCamera = useCallback(async () => {
    if (videoRef.current && !streamRef.current) {
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
        setViewState('INITIAL');
      }
    }
  }, []);

  useEffect(() => {
    if (viewState === 'SCANNING') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [viewState, startCamera, stopCamera]);
    
  useEffect(() => {
    if (viewState === 'FILTERING' && croppedImage) {
        setPreviewUrl(croppedImage.dataUrl);
        setActiveFilter('normal');
    }
  }, [viewState, croppedImage]);

  useEffect(() => {
    return () => {
      stopCamera(); // Cleanup on component unmount
    };
  }, [stopCamera]);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setError(null);
    setProcessingMessage('Capturing...');
    setIsProcessing(true);

    const video = videoRef.current;
    const tempCanvas = document.createElement('canvas');
    
    const MAX_DIMENSION = 1280;
    let newWidth, newHeight;

    if (video.videoWidth > video.videoHeight) {
      newWidth = MAX_DIMENSION;
      newHeight = (video.videoHeight / video.videoWidth) * MAX_DIMENSION;
    } else {
      newHeight = MAX_DIMENSION;
      newWidth = (video.videoWidth / video.videoHeight) * MAX_DIMENSION;
    }

    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    const context = tempCanvas.getContext('2d');
    context?.drawImage(video, 0, 0, newWidth, newHeight);

    const dataUrl = tempCanvas.toDataURL('image/jpeg');
    setCapturedImage({ dataUrl, width: newWidth, height: newHeight });
    setIsProcessing(false);
    setProcessingMessage('');
    setViewState('EDITING');
  };

  const findInitialCorners = useCallback(async (imageUrl: string) => {
    setProcessingMessage('Finding document...');
    setIsProcessing(true);
    
    const cv = (window as any).cv;
    if (!cv) {
        setError("Scanner engine is not ready.");
        setIsProcessing(false);
        return;
    }

    let src, gray, blurred, thresh, morphed, contours, hierarchy, bestContourMat;
    src = gray = blurred = thresh = morphed = contours = hierarchy = bestContourMat = null;

    try {
        const img = document.createElement('img');
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        src = cv.imread(img);
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

        blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

        thresh = new cv.Mat();
        cv.adaptiveThreshold(blurred, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
        
        morphed = new cv.Mat();
        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel);
        kernel.delete();

        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let maxArea = -1;
        const minArea = src.rows * src.cols * 0.1;

        for (let i = 0; i < contours.size(); ++i) {
            const cnt = contours.get(i);
            const area = cv.contourArea(cnt);

            if (area > minArea) {
                const peri = cv.arcLength(cnt, true);
                const approx = new cv.Mat();
                cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

                if (approx.rows === 4 && cv.isContourConvex(approx)) {
                    if (area > maxArea) {
                        bestContourMat?.delete();
                        maxArea = area;
                        bestContourMat = approx.clone();
                    }
                }
                approx.delete();
            }
            cnt.delete();
        }

        if (bestContourMat) {
            const points = [
                {x: bestContourMat.data32S[0], y: bestContourMat.data32S[1]},
                {x: bestContourMat.data32S[2], y: bestContourMat.data32S[3]},
                {x: bestContourMat.data32S[4], y: bestContourMat.data32S[5]},
                {x: bestContourMat.data32S[6], y: bestContourMat.data32S[7]},
            ];

            const cornersBySum = [...points].sort((a, b) => (a.x + a.y) - (b.x + b.y));
            const cornersByDiff = [...points].sort((a, b) => (a.y - a.x) - (b.y - b.x));

            setCorners({ tl: cornersBySum[0], br: cornersBySum[3], tr: cornersByDiff[0], bl: cornersByDiff[3] });
        } else {
            const margin = capturedImage!.width * 0.05;
            setCorners({
                tl: { x: margin, y: margin },
                tr: { x: capturedImage!.width - margin, y: margin },
                bl: { x: margin, y: capturedImage!.height - margin },
                br: { x: capturedImage!.width - margin, y: capturedImage!.height - margin },
            });
        }
    } catch (err) {
        console.error("OpenCV error:", err);
        setError("Could not auto-detect corners. Please adjust them manually.");
        const margin = capturedImage!.width * 0.05;
        setCorners({
            tl: { x: margin, y: margin },
            tr: { x: capturedImage!.width - margin, y: margin },
            bl: { x: margin, y: capturedImage!.height - margin },
            br: { x: capturedImage!.width - margin, y: capturedImage!.height - margin },
        });
    } finally {
        src?.delete();
        gray?.delete();
        blurred?.delete();
        thresh?.delete();
        morphed?.delete();
        contours?.delete();
        hierarchy?.delete();
        bestContourMat?.delete();
        setIsProcessing(false);
        setProcessingMessage('');
    }
  }, [capturedImage]);

  useEffect(() => {
    if (capturedImage && viewState === 'EDITING') {
      findInitialCorners(capturedImage.dataUrl);
    }
  }, [capturedImage, viewState, findInitialCorners]);


  const handleApplyCrop = async () => {
    if (!capturedImage || !corners) return;
    setProcessingMessage('Applying crop...');
    setIsProcessing(true);

    let src, warped, M, srcTri, dstTri;
    src = warped = M = srcTri = dstTri = null;

    try {
        const img = document.createElement('img');
        img.src = capturedImage.dataUrl;
        await new Promise(resolve => { img.onload = resolve; });

        const { tl, tr, bl, br } = corners;
        const widthA = Math.hypot(br.x - bl.x, br.y - bl.y);
        const widthB = Math.hypot(tr.x - tl.x, tr.y - tl.y);
        const maxWidth = Math.max(widthA, widthB);
        const heightA = Math.hypot(tr.x - br.x, tr.y - br.y);
        const heightB = Math.hypot(tl.x - bl.x, tl.y - bl.y);
        const maxHeight = Math.max(heightA, heightB);

        const cv = (window as any).cv;
        src = cv.imread(img);
        warped = new cv.Mat();
        const dsize = new cv.Size(maxWidth, maxHeight);
        srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y]);
        dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxWidth, 0, 0, maxHeight, maxWidth, maxHeight]);
        M = cv.getPerspectiveTransform(srcTri, dstTri);

        // Perform the perspective warp on the color image. No filters are applied here.
        cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        
        const outputCanvas = document.createElement('canvas');
        cv.imshow(outputCanvas, warped);
        const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.95);
        
        setCroppedImage({ dataUrl });
        setActiveFilter('normal');
        setViewState('FILTERING');
        
        setCapturedImage(null);
        setCorners(null);

    } catch (err: any) {
        setError(err.message || "An error occurred during image processing.");
    } finally {
        src?.delete(); 
        warped?.delete(); 
        srcTri?.delete(); 
        dstTri?.delete(); 
        M?.delete();
        setIsProcessing(false);
        setProcessingMessage('');
    }
  };

  const getPointerPosition = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : e;
    const scaleX = capturedImage!.width / rect.width;
    const scaleY = capturedImage!.height / rect.height;
    return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (corner: Corner) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDraggingCorner(corner);
  };
  
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingCorner) return;
    e.preventDefault();
    const pos = getPointerPosition(e);
    if (pos) {
        setCorners(prev => prev ? { ...prev, [draggingCorner]: pos } : null);
    }
  };

  const handlePointerUp = () => {
    setDraggingCorner(null);
  };

  const applyFilter = useCallback(async (filter: FilterType) => {
    if (!croppedImage) return;
    setActiveFilter(filter);
    
    if (filter === 'normal') {
        setPreviewUrl(croppedImage.dataUrl);
        return;
    }
    
    setIsPreviewLoading(true);

    try {
        const img = document.createElement('img');
        img.src = croppedImage.dataUrl;
        await new Promise(resolve => { img.onload = resolve; });

        const cv = (window as any).cv;
        let src = cv.imread(img);
        let finalMat = new cv.Mat();

        if (filter === 'bw') {
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            cv.adaptiveThreshold(gray, finalMat, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15, 4);
            gray.delete();
        } else if (filter === 'enhance') {
            const alpha = 1.2; // Contrast
            const beta = 5;    // Brightness
            src.convertTo(finalMat, -1, alpha, beta);
        }
        
        const outputCanvas = document.createElement('canvas');
        cv.imshow(outputCanvas, finalMat);
        const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.95);
        setPreviewUrl(dataUrl);
        
        src.delete();
        finalMat.delete();
    } catch (err) {
        console.error(err);
        setError("Failed to apply filter preview.");
    } finally {
        setIsPreviewLoading(false);
    }
  }, [croppedImage]);
  
  const handleAddFinalPage = () => {
    if (!previewUrl) return;
    setScannedPages(prev => [...prev, { id: Date.now(), dataUrl: previewUrl }]);
    setCroppedImage(null);
    setPreviewUrl(null);
    setViewState('SCANNING');
  };

  const removePage = (id: number) => {
    setScannedPages(scannedPages.filter(img => img.id !== id));
  };
  
  const createPdf = async () => {
    if (scannedPages.length === 0) {
      setError('Please capture at least one image.');
      return;
    }
    setProcessingMessage('Creating PDF...');
    setIsProcessing(true);
    setError(null);

    try {
      const { PDFDocument } = (window as any).PDFLib;
      const pdfDoc = await PDFDocument.create();

      for (const img of scannedPages) {
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
      
      setScannedPages([]);
      setViewState('SUCCESS');
    } catch (e) {
      console.error(e);
      setError('An error occurred while creating the PDF.');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
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
    setScannedPages([]);
    setCapturedImage(null);
    setCorners(null);
    setError(null);
    setViewState('INITIAL');
  }

  const renderInitialView = () => (
    <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md max-w-lg mx-auto">
        <h2 className="text-2xl font-bold mb-4">Document Scanner</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Use your device's camera to create high-quality, cropped scans.</p>
        {!isCvReady ? (
            <Spinner message="Initializing scanner engine..." />
        ) : (
            <button onClick={() => setViewState('SCANNING')} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75">
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
            {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Spinner message={processingMessage} />
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center bg-gradient-to-t from-black/50 to-transparent">
                <button onClick={handleCapture} disabled={isProcessing} className="h-16 w-16 bg-white rounded-full border-4 border-slate-400 focus:border-sky-500 focus:outline-none ring-2 ring-offset-2 ring-offset-black/50 ring-transparent focus:ring-sky-500 transition-all disabled:bg-slate-300" aria-label="Capture Image"></button>
            </div>
        </div>
        <div className="flex-shrink-0 md:w-1/3">
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">Scanned Pages ({scannedPages.length})</h3>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-inner min-h-[24rem] max-h-96 overflow-y-auto space-y-2">
            {scannedPages.length === 0 ? (
              <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-8">Point your camera at a document and press the capture button.</p>
            ) : (
              scannedPages.map((img, index) => (
                <div key={img.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md group">
                    <div className="flex items-center">
                        <img src={img.dataUrl} alt={`Scan ${index + 1}`} className="w-16 h-16 object-contain bg-slate-200 dark:bg-slate-600 p-1 rounded-md mr-3" />
                        <span className="font-medium text-sm">Page {index + 1}</span>
                    </div>
                    <button onClick={() => removePage(img.id)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-800/50 text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <button onClick={() => setViewState('INITIAL')} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                Stop Scanner
            </button>
            <button onClick={createPdf} className="flex-1 px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400" disabled={scannedPages.length === 0 || isProcessing}>
                Create PDF
            </button>
          </div>
        </div>
    </div>
  );

  const renderEditingView = () => {
    const getScaledCorners = () => {
        if (!corners || !imageRef.current || !capturedImage) return null;
        const rect = imageRef.current.getBoundingClientRect();
        const scaleX = rect.width / capturedImage.width;
        const scaleY = rect.height / capturedImage.height;
        return {
            tl: { x: corners.tl.x * scaleX, y: corners.tl.y * scaleY },
            tr: { x: corners.tr.x * scaleX, y: corners.tr.y * scaleY },
            bl: { x: corners.bl.x * scaleX, y: corners.bl.y * scaleY },
            br: { x: corners.br.x * scaleX, y: corners.br.y * scaleY },
        };
    };
    const scaledCorners = getScaledCorners();
    const polygonPoints = scaledCorners ? `${scaledCorners.tl.x},${scaledCorners.tl.y} ${scaledCorners.tr.x},${scaledCorners.tr.y} ${scaledCorners.br.x},${scaledCorners.br.y} ${scaledCorners.bl.x},${scaledCorners.bl.y}` : '';

    return (
        <div className="space-y-4">
             <div 
                className="relative w-full max-w-3xl mx-auto bg-black"
                onMouseMove={handlePointerMove}
                onTouchMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchEnd={handlePointerUp}
            >
                <img ref={imageRef} src={capturedImage?.dataUrl} alt="Captured for editing" className="w-full h-auto block" />
                {isProcessing && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Spinner message={processingMessage} /></div>}
                {scaledCorners && !isProcessing && (
                    <svg className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }}>
                        <polygon points={polygonPoints} fill="rgba(30, 144, 255, 0.2)" stroke="rgb(30, 144, 255)" strokeWidth="2" />
                        {(Object.keys(scaledCorners) as Corner[]).map(key => (
                            <circle
                                key={key}
                                cx={scaledCorners[key].x}
                                cy={scaledCorners[key].y}
                                r="12"
                                fill="rgba(30, 144, 255, 0.5)"
                                stroke="white"
                                strokeWidth="2"
                                className="cursor-grab active:cursor-grabbing"
                                onMouseDown={handlePointerDown(key)}
                                onTouchStart={handlePointerDown(key)}
                            />
                        ))}
                    </svg>
                )}
            </div>
            <div className="flex justify-center gap-4">
                <button onClick={() => setViewState('SCANNING')} className="px-6 py-3 font-semibold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50" disabled={isProcessing}>
                    Retake
                </button>
                <button onClick={handleApplyCrop} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 disabled:bg-slate-400" disabled={!corners || isProcessing}>
                    Apply Crop
                </button>
            </div>
        </div>
    );
  };
  
  const renderFilteringView = () => (
    <div className="space-y-4">
        <h2 className="text-xl font-bold text-center text-slate-800 dark:text-slate-200">Apply a Filter</h2>
        <div className="relative w-full max-w-lg mx-auto aspect-[8.5/11] bg-slate-200 dark:bg-slate-700 rounded-lg shadow-md flex items-center justify-center">
            {previewUrl && <img src={previewUrl} alt="Filtered preview" className="w-full h-full object-contain rounded-lg" />}
            {(isPreviewLoading || !previewUrl) && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                    <Spinner message={isPreviewLoading ? "Applying filter..." : "Loading..."} />
                </div>
            )}
        </div>
        
        <div>
            <label className="block text-sm text-center font-medium text-slate-700 dark:text-slate-300 mb-3">Filter Options</label>
            <div className="flex justify-center gap-2 sm:gap-4">
                <button onClick={() => applyFilter('normal')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-28 ${activeFilter === 'normal' ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>Normal</button>
                <button onClick={() => applyFilter('bw')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-28 ${activeFilter === 'bw' ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>Scan B&W</button>
                <button onClick={() => applyFilter('enhance')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-28 ${activeFilter === 'enhance' ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>Enhanced</button>
            </div>
        </div>
        
        <div className="flex justify-center gap-4 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => { setCroppedImage(null); setPreviewUrl(null); setViewState('SCANNING'); }} className="px-6 py-3 font-semibold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50" disabled={isPreviewLoading}>
                Discard
            </button>
            <button onClick={handleAddFinalPage} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 disabled:bg-slate-400" disabled={!previewUrl || isPreviewLoading}>
                Add Page
            </button>
        </div>
    </div>
  );

  let content;
  switch (viewState) {
    case 'SCANNING': content = renderScannerView(); break;
    case 'EDITING': content = renderEditingView(); break;
    case 'FILTERING': content = renderFilteringView(); break;
    case 'SUCCESS': content = renderSuccessView(); break;
    case 'INITIAL':
    default:
        content = renderInitialView(); break;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {error && <Alert type="error" message={error} />}
      {isProcessing && !capturedImage && viewState !== 'FILTERING' && <Spinner message={processingMessage} />}
      {content}
    </div>
  );
};

export default CameraToPdfView;
