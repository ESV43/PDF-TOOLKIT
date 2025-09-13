import React, { useState, useRef, useEffect, useCallback } from 'react';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';
import SuccessView from '../../components/SuccessView';
import { ToolType } from '../../types';

interface ProcessedImage {
  id: number;
  dataUrl: string;
}

interface CameraToPdfViewProps {
  navigateToTool: (toolId: ToolType, file: File) => void;
}

interface Point { x: number; y: number; }
type ViewState = 'INITIAL' | 'SCANNING' | 'EDITING' | 'FILTERING';
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

  if (generatedPdfInfo) {
     return (
        <SuccessView
            title="Scan PDF Created!"
            message="Your scanned document is ready. You can download it now or compress it to reduce the file size."
            onReset={resetScanner}
            resetText="Scan another document"
        >
            <Button onClick={handleDownload} variant="primary">Download PDF</Button>
            <Button onClick={handleCompress} variant="secondary">Compress PDF</Button>
        </SuccessView>
    );
  }

  const renderInitialView = () => (
    <div className="text-center p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-sm max-w-lg mx-auto">
        <ToolHeader 
            title="Document Scanner"
            description="Use your device's camera to create high-quality, cropped scans of documents."
        />
        {!isCvReady ? (
            <div className="mt-6">
                <Spinner message="Initializing scanner engine..." />
            </div>
        ) : (
            <div className="mt-6">
                <Button onClick={() => setViewState('SCANNING')} variant="primary">Start Scanner</Button>
            </div>
        )}
    </div>
  );

  const renderScannerView = () => (
     <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-grow lg:w-2/3 bg-black rounded-2xl overflow-hidden relative aspect-[9/16] lg:aspect-video">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
            {(isProcessing || !videoRef.current?.srcObject) && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <Spinner message={isProcessing ? processingMessage : "Starting camera..."} />
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center bg-gradient-to-t from-black/60 to-transparent">
                <button onClick={handleCapture} disabled={isProcessing} className="h-20 w-20 bg-white rounded-full border-4 border-gray-400 focus:border-indigo-500 focus:outline-none ring-2 ring-offset-2 ring-offset-black/50 ring-transparent focus:ring-indigo-500 transition-all disabled:bg-gray-300 active:scale-95" aria-label="Capture Image"></button>
            </div>
        </div>
        <div className="flex-shrink-0 lg:w-1/3 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Scanned Pages ({scannedPages.length})</h3>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm min-h-[16rem] max-h-96 overflow-y-auto space-y-3">
            {scannedPages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                <p className="text-sm">Your scanned pages will appear here.</p>
              </div>
            ) : (
              scannedPages.map((img, index) => (
                <div key={img.id} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg group">
                    <div className="flex items-center overflow-hidden">
                        <img src={img.dataUrl} alt={`Scan ${index + 1}`} className="w-16 h-16 object-contain bg-white dark:bg-gray-700 p-1 rounded-md mr-3" />
                        <span className="font-medium text-sm truncate">Page {index + 1}</span>
                    </div>
                    <button onClick={() => removePage(img.id)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={() => setViewState('INITIAL')} variant="secondary" className="flex-1">
                Stop Scanner
            </Button>
            <Button onClick={createPdf} variant="primary" className="flex-1" disabled={scannedPages.length === 0 || isProcessing}>
                Create PDF
            </Button>
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
        <div className="space-y-4 pb-24 md:pb-0">
             <div 
                className="relative w-full max-w-3xl mx-auto bg-black rounded-lg"
                onMouseMove={handlePointerMove}
                onTouchMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchEnd={handlePointerUp}
            >
                <img ref={imageRef} src={capturedImage?.dataUrl} alt="Captured for editing" className="w-full h-auto block rounded-lg" />
                {isProcessing && <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg"><Spinner message={processingMessage} /></div>}
                {scaledCorners && !isProcessing && (
                    <svg className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }}>
                        <polygon points={polygonPoints} fill="rgba(79, 70, 229, 0.2)" stroke="rgb(79, 70, 229)" strokeWidth="2" />
                        {(Object.keys(scaledCorners) as Corner[]).map(key => (
                            <circle
                                key={key}
                                cx={scaledCorners[key].x}
                                cy={scaledCorners[key].y}
                                r="16"
                                fill="rgba(79, 70, 229, 0.5)"
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
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 md:static md:bg-transparent md:dark:bg-transparent md:p-0 md:border-none md:backdrop-blur-none flex justify-center gap-4">
                <Button onClick={() => setViewState('SCANNING')} variant="secondary" disabled={isProcessing}>
                    Retake
                </Button>
                <Button onClick={handleApplyCrop} variant="primary" disabled={!corners || isProcessing}>
                    Apply Crop
                </Button>
            </div>
        </div>
    );
  };
  
  const renderFilteringView = () => (
    <div className="space-y-6 pb-24 md:pb-0">
        <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-200">Apply a Filter</h2>
        <div className="relative w-full max-w-lg mx-auto aspect-[8.5/11] bg-gray-200 dark:bg-gray-800 rounded-xl shadow-lg flex items-center justify-center">
            {previewUrl && <img src={previewUrl} alt="Filtered preview" className="w-full h-full object-contain rounded-xl" />}
            {(isPreviewLoading || !previewUrl) && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                    <Spinner message={isPreviewLoading ? "Applying filter..." : "Loading..."} />
                </div>
            )}
        </div>
        
        <div>
            <div className="flex justify-center gap-2 sm:gap-4 p-1 bg-gray-200 dark:bg-gray-800 rounded-full max-w-sm mx-auto">
                <button onClick={() => applyFilter('normal')} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors w-full ${activeFilter === 'normal' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Normal</button>
                <button onClick={() => applyFilter('bw')} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors w-full ${activeFilter === 'bw' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Scan B&W</button>
                <button onClick={() => applyFilter('enhance')} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors w-full ${activeFilter === 'enhance' ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}>Enhanced</button>
            </div>
        </div>
        
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 md:static md:bg-transparent md:dark:bg-transparent md:p-0 md:border-none md:backdrop-blur-none flex justify-center gap-4">
            <Button onClick={() => { setCroppedImage(null); setPreviewUrl(null); setViewState('SCANNING'); }} variant="secondary" disabled={isPreviewLoading}>
                Discard
            </Button>
            <Button onClick={handleAddFinalPage} variant="primary" disabled={!previewUrl || isPreviewLoading}>
                Add Page
            </Button>
        </div>
    </div>
  );

  let content;
  switch (viewState) {
    case 'SCANNING': content = renderScannerView(); break;
    case 'EDITING': content = renderEditingView(); break;
    case 'FILTERING': content = renderFilteringView(); break;
    case 'INITIAL':
    default:
        content = renderInitialView(); break;
  }

  return (
    <div className="space-y-6">
      {error && <Alert type="error" message={error} />}
      {content}
    </div>
  );
};

export default CameraToPdfView;