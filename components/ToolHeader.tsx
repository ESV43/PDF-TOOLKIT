import React from 'react';

interface ToolHeaderProps {
  title: string;
  description: string;
}

const ToolHeader: React.FC<ToolHeaderProps> = ({ title, description }) => {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
};

export default ToolHeader;
