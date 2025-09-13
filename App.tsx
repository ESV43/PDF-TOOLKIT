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

const Header = ({ onBack, showBackButton, title }: { onBack: () => void; showBackButton: boolean; title: string; }) => (
  <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-sm p-4 flex items-center sticky top-0 z-40">
    <div className="max-w-7xl mx-auto flex items-center w-full">
      {showBackButton && (
        <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Back to dashboard">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h1>
    </div>
  </header>
);

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [fileForProcessing, setFileForProcessing] = useState<File | null>(null);
  const [activeToolTitle, setActiveToolTitle] = useState('Pocket PDF Toolkit');

  const navigateToTool = (toolId: ToolType | null, file?: File) => {
    setFileForProcessing(file || null);
    setActiveTool(toolId);
  };

  const renderActiveTool = () => {
    let toolComponent;
    switch (activeTool) {
      case 'MERGE_PDF': toolComponent = <MergePdfsView />; break;
      case 'ORGANIZE_PDF': toolComponent = <OrganizePdfView />; break;
      case 'IMAGE_TO_PDF': toolComponent = <ImageToPdfView navigateToTool={navigateToTool} />; break;
      case 'COMPRESS_PDF': toolComponent = <CompressPdfView initialFile={fileForProcessing} />; break;
      case 'SPLIT_PDF': toolComponent = <SplitPdfView />; break;
      case 'PDF_TO_IMAGES': toolComponent = <PdfToImagesView />; break;
      case 'PROTECT_PDF': toolComponent = <ProtectPdfView />; break;
      case 'UNLOCK_PDF': toolComponent = <UnlockPdfView />; break;
      case 'ROTATE_PDF': toolComponent = <RotatePdfView />; break;
      case 'EXTRACT_PAGES': toolComponent = <ExtractPagesView />; break;
      case 'ADD_WATERMARK': toolComponent = <AddWatermarkView />; break;
      case 'ADD_PAGE_NUMBERS': toolComponent = <AddPageNumbersView />; break;
      case 'PDF_OCR': toolComponent = <OcrPdfView />; break;
      case 'CAMERA_TO_PDF': toolComponent = <CameraToPdfView navigateToTool={navigateToTool} />; break;
      default:
        toolComponent = <ToolDashboard onSelectTool={(tool) => {
          setActiveToolTitle(tool.title);
          navigateToTool(tool.id);
        }} />;
    }
    return <div className="py-6 sm:py-8 md:py-10">{toolComponent}</div>;
  };

  return (
    <div className="min-h-screen font-sans text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-950">
      <Header 
        onBack={() => {
          setActiveToolTitle('Pocket PDF Toolkit');
          navigateToTool(null);
        }} 
        showBackButton={!!activeTool} 
        title={activeTool ? activeToolTitle : 'Pocket PDF Toolkit'}
      />
      <main className="px-4 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          {renderActiveTool()}
        </div>
      </main>
      <footer className="text-center p-6 text-xs text-gray-500 dark:text-gray-600">
        <p>Made with love by ESV43</p>
      </footer>
    </div>
  );
};

export default App;