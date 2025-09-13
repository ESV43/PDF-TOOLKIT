import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';

const ProtectPdfView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleFileSelected = (selectedFiles: File[]) => {
    setError(null);
    setPassword('');
    setConfirmPassword('');
    const pdfFile = selectedFiles.find(f => f.type === 'application/pdf');
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      setError('Please select a single PDF file.');
    }
  };

  const protectPdf = async () => {
    if (!file) {
      setError('No file selected.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { PDFDocument, StandardFonts, rgb } = (window as any).PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      pdfDoc.setProducer('Pocket PDF Toolkit');
      pdfDoc.setCreator('Pocket PDF Toolkit');
      
      const pdfBytes = await pdfDoc.save({
          useObjectStreams: false, // Required for password protection
          encrypt: {
            userPassword: password,
            ownerPassword: password, // For simplicity, use the same password
            permissions: {
                printing: 'highResolution',
                copying: true,
                modifying: false,
                annotating: true,
                fillingForms: true,
                contentAccessibility: true,
                documentAssembly: true,
            },
          }
      });

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `protected_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setFile(null);

    } catch (e) {
      console.error(e);
      setError('Failed to protect the PDF. It might be corrupted.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const isButtonDisabled = password.length < 4 || password !== confirmPassword;

  return (
    <div className="max-w-4xl mx-auto">
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message="Encrypting and protecting PDF..." />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to add a password" />
      )}

      {!isLoading && file && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md space-y-6">
          <div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Selected File</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{file.name}</p>
          </div>

          <div className="space-y-4">
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Set Password</label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
            </div>
             <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
                <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
            </div>
          </div>


          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setFile(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
              Choose Different PDF
            </button>
            <button onClick={protectPdf} className="px-6 py-3 font-semibold text-white bg-sky-600 rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:bg-slate-400 dark:disabled:bg-slate-600" disabled={isButtonDisabled}>
              Protect PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProtectPdfView;
