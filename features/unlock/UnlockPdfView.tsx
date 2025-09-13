import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';

const UnlockPdfView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);

  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    setPassword('');
    setIsPasswordRequired(false);
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
      checkIfProtected(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const checkIfProtected = async (pdfFile: File) => {
    // A simple check - true protection check happens on unlock attempt.
    // This just prompts the user right away if the file seems protected.
    const fileText = await pdfFile.text();
    if (fileText.includes('/Encrypt')) {
        setIsPasswordRequired(true);
    } else {
        // If not obviously encrypted, try to process without password first
        unlockPdf();
    }
  }

  const unlockPdf = async (userPassword?: string) => {
    if (!file) {
      setError('No file selected.');
      return;
    }
    if (isPasswordRequired && !userPassword) {
      setError('Password is required for this file.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { PDFDocument } = (window as any).PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
          ignoreEncryption: false, // Explicitly try to handle encryption
          password: userPassword,
      });

      // If we loaded successfully, saving without encryption options will remove it.
      const pdfBytes = await pdfDoc.save();

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unlocked_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setFile(null);
      setIsPasswordRequired(false);

    } catch (e: any) {
      console.error(e);
       if (e.message.includes('password')) {
            setError('Incorrect password or the file is corrupted.');
            setIsPasswordRequired(true);
        } else {
            setError('Failed to unlock the PDF. The file might not be password-protected or is corrupted.');
        }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      unlockPdf(password);
  }

  return (
    <div className="max-w-4xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message="Attempting to unlock PDF..." />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a password-protected PDF" />
      )}

      {!isLoading && file && isPasswordRequired && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md space-y-6">
          <div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Unlock Protected File</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{file.name}</p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">PDF Password</label>
            <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter current password"
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                required
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
            <button type="button" onClick={() => setFile(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
              Choose Different PDF
            </button>
            <button type="submit" className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400" disabled={!password}>
              Unlock PDF
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default UnlockPdfView;
