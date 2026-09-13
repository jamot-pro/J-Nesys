import React from 'react';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onOpenTask: (task: Task) => void;
  onDirections: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onOpenTask,
  onDirections,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs hover:border-gray-300 transition-all">
      {/* Top Row: Title & Payout */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm sm:text-base font-bold text-gray-950 leading-snug">
          {task.title}
        </h3>
        <span className="text-base font-extrabold text-[#ff2b5e] shrink-0">
          €{task.payoutEur}
        </span>
      </div>

      {/* Meta Row: Client, Distance, Deadline */}
      <p className="text-xs text-gray-500 font-medium mb-3.5">
        {task.client} · {task.distanceKm > 0 ? `${task.distanceKm} km · ` : ''}
        {task.deadline}
      </p>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onDirections(task)}
          className="w-full bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold py-2 px-3 rounded-xl border border-gray-200 shadow-2xs transition-colors"
        >
          Directions
        </button>
        <button
          type="button"
          onClick={() => onOpenTask(task)}
          className="w-full bg-[#ff2b5e] hover:bg-[#e51d4e] active:scale-[0.98] text-white text-xs font-bold py-2 px-3 rounded-xl shadow-xs transition-all"
        >
          Open task
        </button>
      </div>
    </div>
  );
};
