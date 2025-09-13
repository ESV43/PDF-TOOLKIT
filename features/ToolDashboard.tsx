import React from 'react';
import type { Tool } from '../types';
import { TOOLS } from '../constants';

interface ToolDashboardProps {
  onSelectTool: (tool: Tool) => void;
}

const ToolCard: React.FC<{ tool: Tool; onSelect: () => void }> = ({ tool, onSelect }) => (
  <button
    onClick={onSelect}
    className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 text-center transform hover:-translate-y-1 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
    aria-label={tool.title}
  >
    {tool.icon}
    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">{tool.title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400">{tool.description}</p>
  </button>
);

const ToolDashboard: React.FC<ToolDashboardProps> = ({ onSelectTool }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {TOOLS.map((tool) => (
        <ToolCard key={tool.id} tool={tool} onSelect={() => onSelectTool(tool)} />
      ))}
    </div>
  );
};

export default ToolDashboard;