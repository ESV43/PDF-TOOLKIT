import React from 'react';
import Button from './Button';

interface SuccessViewProps {
  title: string;
  message: string;
  onReset: () => void;
  resetText?: string;
  children: React.ReactNode;
}

const SuccessView: React.FC<SuccessViewProps> = ({ title, message, onReset, resetText = "Start Over", children }) => {
  return (
    <div className="text-center p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-sm max-w-lg mx-auto">
        <div className="mb-4 text-green-500 bg-green-100 dark:bg-green-900/50 rounded-full h-16 w-16 mx-auto flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {children}
        </div>
         <button onClick={onReset} className="mt-8 text-sm text-gray-500 hover:underline">
            {resetText}
        </button>
    </div>
  );
};

export default SuccessView;
