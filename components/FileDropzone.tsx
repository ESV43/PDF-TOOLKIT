import React, { useState, useCallback } from 'react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  message?: string;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ 
  onFilesSelected, 
  accept, 
  multiple = false,
  message = "Drag & drop files here, or click to select" 
}) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  }, [onFilesSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  const activeClasses = isDragActive 
    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
    : 'border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600';

  return (
    <label 
      htmlFor="dropzone-file" 
      className={`flex flex-col items-center justify-center w-full min-h-[256px] border-2 border-dashed rounded-2xl cursor-pointer bg-white dark:bg-gray-900 transition-colors ${activeClasses}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mb-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M19.5 21a2.25 2.25 0 002.25-2.25v-1.5a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 15v1.5A2.25 2.25 0 004.5 21h15z" />
        </svg>
        <p className="mb-2 text-base font-semibold text-gray-700 dark:text-gray-200">Click to upload or drag and drop</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      </div>
      <input id="dropzone-file" type="file" className="hidden" accept={accept} multiple={multiple} onChange={handleChange} />
    </label>
  );
};

export default FileDropzone;