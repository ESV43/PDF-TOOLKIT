import React from 'react';
import type { Tool } from './types';
import { 
  MergeIcon, 
  SplitIcon,
  CompressIcon, 
  RotateIcon,
  OrganizeIcon, 
  ImageToPdfIcon,
  PdfToImagesIcon,
  ProtectIcon,
  UnlockIcon,
  ExtractPagesIcon,
  AddWatermarkIcon,
  AddPageNumbersIcon,
  OcrIcon,
  CameraIcon,
} from './components/icons/ToolIcons';

export const TOOLS: Tool[] = [
  {
    id: 'MERGE_PDF',
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into one single document.',
    icon: <MergeIcon />,
  },
  {
    id: 'SPLIT_PDF',
    title: 'Split PDF',
    description: 'Extract a page range or split all pages into individual files.',
    icon: <SplitIcon />,
  },
  {
    id: 'COMPRESS_PDF',
    title: 'Compress PDF',
    description: 'Reduce the file size of your PDF while optimizing for quality.',
    icon: <CompressIcon />,
  },
  {
    id: 'PDF_TO_IMAGES',
    title: 'PDF to Images',
    description: 'Convert each page of a PDF into JPG or PNG images.',
    icon: <PdfToImagesIcon />,
  },
  {
    id: 'IMAGE_TO_PDF',
    title: 'Images to PDF',
    description: 'Convert JPG, PNG, and other images into a PDF file.',
    icon: <ImageToPdfIcon />,
  },
  {
    id: 'CAMERA_TO_PDF',
    title: 'Camera to PDF',
    description: 'Use your camera to scan documents and convert to PDF.',
    icon: <CameraIcon />,
  },
  {
    id: 'ORGANIZE_PDF',
    title: 'Rearrange PDF pages',
    description: 'Visually reorder, rotate, or delete pages from a PDF file.',
    icon: <OrganizeIcon />,
  },
  {
    id: 'EXTRACT_PAGES',
    title: 'Extract PDF pages',
    description: 'Create a new PDF containing only your selected pages.',
    icon: <ExtractPagesIcon />,
  },
  {
    id: 'ROTATE_PDF',
    title: 'Rotate PDF pages',
    description: 'Rotate all or selected pages in your PDF document.',
    icon: <RotateIcon />,
  },
  {
    id: 'ADD_PAGE_NUMBERS',
    title: 'Add page numbers',
    description: 'Insert page numbers into your PDF at various positions.',
    icon: <AddPageNumbersIcon />,
  },
  {
    id: 'ADD_WATERMARK',
    title: 'Add watermark',
    description: 'Stamp an image or text over your PDF pages.',
    icon: <AddWatermarkIcon />,
  },
  {
    id: 'PDF_OCR',
    title: 'PDF OCR',
    description: 'Make a scanned, non-searchable PDF file searchable.',
    icon: <OcrIcon />,
  },
  {
    id: 'PROTECT_PDF',
    title: 'Protect PDF',
    description: 'Add a password and restrict permissions for your PDF.',
    icon: <ProtectIcon />,
  },
  {
    id: 'UNLOCK_PDF',
    title: 'Unlock PDF',
    description: 'Remove password and security restrictions from a PDF.',
    icon: <UnlockIcon />,
  },
];