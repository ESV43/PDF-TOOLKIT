import React, { useState } from 'react';
import { Tool, ToolType } from './types';
import ToolDashboard from './features/ToolDashboard';
import MergePdfsView from './features/merger/MergePdfsView';
import OrganizePdfView from './features/organizer/OrganizePdfView';
import ImageToPdfView from './features/image-to-pdf/ImageToPdfView';
import CompressPdfView from './features/compressor/CompressPdfView';
import SplitPdfView from './features/split/SplitPdfView';
import PdfToImagesView from './features/pdftoimages/PdfToImagesView';
import ProtectPdfView from './features/protect/ProtectPdfView';
import UnlockPdfView from './features/unlock/UnlockPdfView';
import RotatePdfView from './features/rotate/RotatePdfView';
import ExtractPagesView from './features/extract/ExtractPagesView';
import AddWatermarkView from './features/watermark/AddWatermarkView';
import AddPageNumbersView from './features/pagenumbers/AddPageNumbersView';
import OcrPdfView from './features/ocr/OcrPdfView';
import CameraToPdfView from './features/cameratopdf/CameraToPdfView';

const Header = ({ onBack, showBackButton }: { onBack: () => void; showBackButton: boolean }) => (
  <header className="bg-white dark:bg-slate-800 shadow-md p-4 flex items-center sticky top-0 z-10">
    {showBackButton && (
      <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Back to dashboard">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    )}
    <div>
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Pocket PDF Toolkit</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">Your All-in-One PDF Swiss Army Knife</p>
    </div>
  </header>
);

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [fileForProcessing, setFileForProcessing] = useState<File | null>(null);

  const navigateToTool = (toolId: ToolType | null, file?: File) => {
    setFileForProcessing(file || null);
    setActiveTool(toolId);
  };

  const renderActiveTool = () => {
    switch (activeTool) {
      case 'MERGE_PDF': return <MergePdfsView />;
      case 'ORGANIZE_PDF': return <OrganizePdfView />;
      case 'IMAGE_TO_PDF': return <ImageToPdfView navigateToTool={navigateToTool} />;
      case 'COMPRESS_PDF': return <CompressPdfView initialFile={fileForProcessing} />;
      case 'SPLIT_PDF': return <SplitPdfView />;
      case 'PDF_TO_IMAGES': return <PdfToImagesView />;
      case 'PROTECT_PDF': return <ProtectPdfView />;
      case 'UNLOCK_PDF': return <UnlockPdfView />;
      case 'ROTATE_PDF': return <RotatePdfView />;
      case 'EXTRACT_PAGES': return <ExtractPagesView />;
      case 'ADD_WATERMARK': return <AddWatermarkView />;
      case 'ADD_PAGE_NUMBERS': return <AddPageNumbersView />;
      case 'PDF_OCR': return <OcrPdfView />;
      case 'CAMERA_TO_PDF': return <CameraToPdfView navigateToTool={navigateToTool} />;
      default:
        return <ToolDashboard onSelectTool={(tool) => navigateToTool(tool.id)} />;
    }
  };

  return (
    <div className="min-h-screen font-sans text-slate-800 dark:text-slate-200">
      <Header onBack={() => navigateToTool(null)} showBackButton={!!activeTool} />
      <main className="p-4 sm:p-6 md:p-8">
        {renderActiveTool()}
      </main>
      <footer className="text-center p-4 text-xs text-slate-400 dark:text-slate-500">
        <p>Made with love by ESV43</p>
      </footer>
    </div>
  );
};

export default App;