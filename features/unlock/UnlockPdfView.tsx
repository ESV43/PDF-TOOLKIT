
import React, { useState } from 'react';
import FileDropzone from '../../components/FileDropzone';
import Spinner from '../../components/Spinner';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ToolHeader from '../../components/ToolHeader';

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

  const renderPasswordForm = () => (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Unlock Protected File</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{file?.name}</p>
      </div>

      <div>
        {/* FIX: Changed class to className */}
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">PDF Password</label>
        <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter current password"
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            required
            autoFocus
        />
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" onClick={() => setFile(null)} variant="secondary">
          Cancel
        </Button>
        <Button type="submit" disabled={!password} variant="primary">
          Unlock PDF
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-8">
      <ToolHeader 
        title="Unlock PDF"
        description="Remove password and security restrictions from a protected PDF file."
      />
      {error && <Alert type="error" message={error} />}
      {isLoading && <Spinner message="Attempting to unlock PDF..." />}

      {!isLoading && !file && (
        <FileDropzone onFilesSelected={handleFileSelected} accept="application/pdf" multiple={false} message="Select a password-protected PDF" />
      )}

      {!isLoading && file && isPasswordRequired && renderPasswordForm()}
    </div>
  );
};

export default UnlockPdfView;
