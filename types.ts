export type ToolType = 
  | 'MERGE_PDF' 
  | 'SPLIT_PDF'
  | 'COMPRESS_PDF'
  | 'ORGANIZE_PDF'
  | 'IMAGE_TO_PDF' 
  | 'PDF_TO_IMAGES'
  | 'PROTECT_PDF'
  | 'UNLOCK_PDF'
  | 'ROTATE_PDF'
  | 'EXTRACT_PAGES'
  | 'ADD_WATERMARK'
  | 'ADD_PAGE_NUMBERS'
  | 'PDF_OCR'
  | 'CAMERA_TO_PDF';

export interface Tool {
  id: ToolType;
  title: string;
  description: string;
  icon: JSX.Element;
}