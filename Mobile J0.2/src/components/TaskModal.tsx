import React, { useState } from 'react';
import { X, MapPin, Building2, CheckCircle2, Navigation } from 'lucide-react';
import type { Task } from '../types';

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
  onAcceptTask: (task: Task) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  onClose,
  onAcceptTask,
}) => {
  if (!task) return null;

  const [hasAccepted, setHasAccepted] = useState(task.status === 'accepted');

  const handleAction = () => {
    setHasAccepted(true);
    onAcceptTask(task);
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
      (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-[#ff2b5e] px-2 py-0.5 rounded-md">
                {task.category === 'onsite' ? 'On Site' : 'Remote'}
              </span>
              <span className="text-xs text-gray-400">ID: {task.id}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-950">{task.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Payout Banner */}
          <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-500">Reward payout</span>
              <p className="text-2xl font-black text-[#ff2b5e]">€{task.payoutEur}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-gray-500">Deadline</span>
              <p className="text-xs font-bold text-gray-900">{task.deadline}</p>
            </div>
          </div>

          {/* Quick metadata info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
              <Building2 className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-400 text-[10px] block">Client</span>
                <span className="font-semibold text-gray-800">{task.client}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-400 text-[10px] block">Distance</span>
                <span className="font-semibold text-gray-800">
                  {task.distanceKm > 0 ? `${task.distanceKm} km` : 'Worldwide'}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">
                Description
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          {/* Instructions */}
          {task.instructions && task.instructions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1.5">
                Execution Instructions
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-600">
                {task.instructions.map((inst, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#ff2b5e] font-bold">•</span>
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${task.coordinates[0]},${task.coordinates[1]}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-800 text-xs font-semibold py-2.5 px-4 rounded-xl shadow-2xs"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Maps</span>
          </a>
          <button
            type="button"
            onClick={handleAction}
            className={`flex-1 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all ${
              hasAccepted
                ? 'bg-emerald-600 text-white'
                : 'bg-[#ff2b5e] hover:bg-[#e51d4e] active:scale-[0.98] text-white'
            }`}
          >
            {hasAccepted ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Task Accepted</span>
              </>
            ) : (
              <span>Accept & Start Mission</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
