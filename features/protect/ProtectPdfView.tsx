
import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

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
      const { PDFDocument } = (window as any).PDFLib;
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

  const renderOptions = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Selected File</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{file?.name}</p>
      </div>

      <div className="space-y-4">
        <div>
            {/* FIX: Changed class to className */}
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Set Password</label>
            <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
        </div>
         <div>
            {/* FIX: Changed class to className */}
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
            <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button onClick={() => setFile(null)} variant="secondary">
          Cancel
        </Button>
        <Button onClick={protectPdf} disabled={isButtonDisabled} variant="primary">
          Protect PDF
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <ToolHeader 
        title="Protect PDF"
        description="Add a password to your PDF to restrict access and prevent unauthorized opening."
      />
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message="Encrypting and protecting PDF..." />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a PDF to add a password" />
      )}

      {!isLoading && file && renderOptions()}
    </div>
  );
};

export default ProtectPdfView;
