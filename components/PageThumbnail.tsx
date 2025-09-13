import React, { useRef, useEffect, useState } from 'react';

// Spinner to show while page is loading
const ThumbnailSpinner = () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-lg">
        <svg className="animate-spin h-6 w-6 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

interface PageThumbnailProps {
  pdfDoc: any; // pdf.js document proxy
  pageNumber: number;
  children: (dataUrl: string) => React.ReactNode;
}

const PageThumbnail: React.FC<PageThumbnailProps> = ({ pdfDoc, pageNumber, children }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ref = containerRef.current;
    if (!ref || !pdfDoc || dataUrl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.unobserve(ref); // Render only once
          (async () => {
            try {
              const page = await pdfDoc.getPage(pageNumber);
              // Use a smaller scale for thumbnails to conserve memory
              const viewport = page.getViewport({ scale: 0.5 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
                setDataUrl(canvas.toDataURL('image/jpeg', 0.8)); // Use JPEG for better memory performance
              }
            } catch (e) {
              console.error(`Failed to render page ${pageNumber}`, e);
              // You could set an error state here to show a broken image icon
            }
          })();
        }
      },
      { rootMargin: '300px' } // Pre-load images 300px before they enter viewport
    );

    observer.observe(ref);
    return () => observer.disconnect();
  }, [pdfDoc, pageNumber, dataUrl]);

  return (
    <div ref={containerRef} className="aspect-[7/10] w-full h-full">
      {dataUrl ? children(dataUrl) : <ThumbnailSpinner />}
    </div>
  );
};

export default PageThumbnail;
