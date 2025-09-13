import React from 'react';
import type { Tool } from '../types';
import { TOOLS } from '../constants';

interface ToolDashboardProps {
  onSelectTool: (tool: Tool) => void;
}

const ToolCard: React.FC<{ tool: Tool; onSelect: () => void }> = ({ tool, onSelect }) => (
  <button
    onClick={onSelect}
    className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-6 text-left group transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-gray-950"
    aria-label={tool.title}
  >
    {tool.icon}
    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{tool.title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{tool.description}</p>
  </button>
);

const ToolDashboard: React.FC<ToolDashboardProps> = ({ onSelectTool }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {TOOLS.map((tool) => (
        <ToolCard key={tool.id} tool={tool} onSelect={() => onSelectTool(tool)} />
      ))}
    </div>
  );
};

export default ToolDashboard;