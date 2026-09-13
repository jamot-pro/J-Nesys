import React, { useState } from 'react';
import { Search, Crosshair } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../context/AppContext';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import type { Task } from '../types';

// Component to handle map centering programmatically
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

// Create custom leaflet marker with payout tag
const createPayoutIcon = (payout: number) => {
  return L.divIcon({
    className: 'custom-payout-wrapper',
    html: `<div class="custom-payout-marker">€${payout}</div>`,
    iconSize: [44, 26],
    iconAnchor: [22, 28],
  });
};

export const DiscoverView: React.FC = () => {
  const { tasks, setTasks } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'my' | 'onsite' | 'remote'>('all');
  const [statusTab, setStatusTab] = useState<'active' | 'offered' | 'review' | 'closed'>('active');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.9100, 4.4450]); // Rotterdam area

  // Filter tasks based on search and category pill
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.client.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'onsite') return t.category === 'onsite';
    if (filterType === 'remote') return t.category === 'remote';
    if (filterType === 'my') return t.status === 'accepted';
    return true;
  });

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          // Fallback to Rotterdam center
          setMapCenter([51.9100, 4.4450]);
        }
      );
    }
  };

  const handleOpenDirections = (task: Task) => {
    setMapCenter(task.coordinates);
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${task.coordinates[0]},${task.coordinates[1]}`,
      '_blank'
    );
  };

  const handleAcceptTask = (task: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: 'accepted' } : t))
    );
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto">
      {/* 1. Map Section with Search & Pin Overlay */}
      <div className="relative w-full h-[320px] sm:h-[360px] bg-slate-200 border-b border-gray-200 shadow-xs overflow-hidden">
        {/* Search Bar Overlay */}
        <div className="absolute top-3 left-3 right-3 z-[1000]">
          <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-gray-200/90 flex items-center px-3.5 py-2.5">
            <Search className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Search tasks near Rotterdam"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Locate Me Floating Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          className="absolute bottom-3 right-3 z-[1000] w-9 h-9 bg-white/95 hover:bg-white text-gray-700 rounded-xl shadow-md border border-gray-200/80 flex items-center justify-center transition-transform active:scale-95"
          title="Locate me"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Leaflet Map */}
        <MapContainer
          center={mapCenter}
          zoom={13}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full"
        >
          <MapController center={mapCenter} zoom={13} />
          {/* Positron CartoDB / OSM tiles */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {/* Payout Pin Markers */}
          {tasks.map((task) => (
            <Marker
              key={task.id}
              position={task.coordinates}
              icon={createPayoutIcon(task.payoutEur)}
              eventHandlers={{
                click: () => {
                  setSelectedTask(task);
                },
              }}
            />
          ))}
        </MapContainer>
      </div>

      {/* 2. Horizontal Filter Segment Chips */}
      <div className="px-3 sm:px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all shrink-0 ${
            filterType === 'all'
              ? 'bg-[#ff2b5e] text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          All near me
        </button>
        <button
          type="button"
          onClick={() => setFilterType('my')}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all shrink-0 ${
            filterType === 'my'
              ? 'bg-[#ff2b5e] text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          My missions
        </button>
        <button
          type="button"
          onClick={() => setFilterType('onsite')}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all shrink-0 ${
            filterType === 'onsite'
              ? 'bg-[#ff2b5e] text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          On site
        </button>
        <button
          type="button"
          onClick={() => setFilterType('remote')}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all shrink-0 ${
            filterType === 'remote'
              ? 'bg-[#ff2b5e] text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Remote
        </button>
      </div>

      {/* 3. Task Cards List */}
      <div className="px-3 sm:px-4 space-y-3">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpenTask={(t) => setSelectedTask(t)}
            onDirections={handleOpenDirections}
          />
        ))}

        {filteredTasks.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 text-gray-500 text-xs">
            No missions found matching your criteria.
          </div>
        )}
      </div>

      {/* 4. Active Missions Drawer / Status Tabs Preview */}
      <div className="px-3 sm:px-4 mt-6">
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusTab('active')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
              statusTab === 'active'
                ? 'bg-white border border-gray-300 text-gray-900 shadow-2xs'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Active 1
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('offered')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
              statusTab === 'offered'
                ? 'bg-white border border-gray-300 text-gray-900 shadow-2xs'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Offered 1
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('review')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
              statusTab === 'review'
                ? 'bg-white border border-gray-300 text-gray-900 shadow-2xs'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            In review 1
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('closed')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
              statusTab === 'closed'
                ? 'bg-white border border-gray-300 text-gray-900 shadow-2xs'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Closed 2
          </button>
        </div>

        {/* Accepted Mission Preview Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-950">
                Photograph the mooring line at pier 3
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-extrabold uppercase bg-rose-50 text-[#ff2b5e] px-1.5 py-0.5 rounded-md">
                  ACCEPTED
                </span>
                <span className="text-[11px] text-gray-500">
                  Tidal Grid · before 18:40
                </span>
              </div>
            </div>
            <span className="text-sm font-black text-[#ff2b5e]">€60</span>
          </div>
        </div>
      </div>

      {/* Task Modal Detail View */}
      <TaskModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onAcceptTask={handleAcceptTask}
      />
    </div>
  );
};
