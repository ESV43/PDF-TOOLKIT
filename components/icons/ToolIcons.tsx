
import React from 'react';

const IconWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4 h-14 w-14 mx-auto flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">{children}</div>
);

const SvgIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {children}
    </svg>
);

export const MergeIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></SvgIcon></IconWrapper>;
export const OrganizeIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2m14 0H5" /></SvgIcon></IconWrapper>;
export const ImageToPdfIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></SvgIcon></IconWrapper>;
export const CompressIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l-2 2 2 2m6-4l2 2-2 2" /></SvgIcon></IconWrapper>;

// New Icons
export const SplitIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 16h14m-7-4l-3 3m0 0l3 3m-3-3h12" /></SvgIcon></IconWrapper>;
export const PdfToImagesIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v11.494m-9-5.747h18" /><path strokeLinecap="round" strokeLinejoin="round" d="M10 20.253H6.5a2.5 2.5 0 01-2.5-2.5V6.253a2.5 2.5 0 012.5-2.5H10m4 0h3.5a2.5 2.5 0 012.5 2.5v11.494a2.5 2.5 0 01-2.5 2.5H14" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12l-3-3m0 0l-3 3m3-3v6" /></SvgIcon></IconWrapper>;
export const ProtectIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" /><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 6.22a.75.75 0 00-1.06-1.06L12 10.94l-3.22-3.22a.75.75 0 00-1.06 1.06L10.94 12l-3.22 3.22a.75.75 0 101.06 1.06L12 13.06l3.22 3.22a.75.75 0 101.06-1.06L13.06 12l3.22-3.22z" clipRule="evenodd" /></SvgIcon></IconWrapper>;
export const UnlockIcon = () => <IconWrapper><SvgIcon><path d="M12.75 15l3-3m0 0l-3-3m3 3h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></SvgIcon></IconWrapper>;
export const RotateIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-6 6m0 0l-6-6m6 6V9a6 6 0 0112 0v3" /></SvgIcon></IconWrapper>;
// FIX: Changed closing tag from </Wrapper> to </IconWrapper>
export const ExtractPagesIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.5-6H19.5" /></SvgIcon></IconWrapper>;
export const AddWatermarkIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></SvgIcon></IconWrapper>;
export const AddPageNumbersIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></SvgIcon></IconWrapper>;
export const OcrIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5h3m-3 3h3m-6-3h-3v3h3v-3z" /></SvgIcon></IconWrapper>;
export const CameraIcon = () => <IconWrapper><SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></SvgIcon></IconWrapper>;
