import React, { useState } from 'react';
import {
  Upload,
  Copy,
  ExternalLink,
  Check,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AURA_BREAKDOWN, MISSIONS_JOINED } from '../data/mockData';

export const ProfileView: React.FC = () => {
  const {
    userProfile,
    setUserProfile,
    completenessItems,
    setCompletenessItems,
  } = useApp();

  const [copied, setCopied] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [askInput, setAskInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Calculate dynamic completeness percentage
  const totalCompletedWeight = completenessItems.reduce((acc, item) => {
    return item.completed ? acc + item.weightPercent : acc;
  }, 0);

  const toggleCompleteness = (id: string) => {
    setCompletenessItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleCopySlug = () => {
    navigator.clipboard.writeText(`https://${userProfile.publicSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!userProfile.skills.includes(skillInput.trim())) {
        setUserProfile((prev) => ({
          ...prev,
          skills: [...prev.skills, skillInput.trim()],
        }));
      }
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setUserProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  const addAsk = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && askInput.trim()) {
      e.preventDefault();
      if (!userProfile.asks.includes(askInput.trim())) {
        setUserProfile((prev) => ({
          ...prev,
          asks: [...prev.asks, askInput.trim()],
        }));
      }
      setAskInput('');
    }
  };

  const removeAsk = (askToRemove: string) => {
    setUserProfile((prev) => ({
      ...prev,
      asks: prev.asks.filter((a) => a !== askToRemove),
    }));
  };

  const handleSaveAndPublish = () => {
    setIsSaved(true);
    // Trigger Telegram Haptic feedback if available
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
      (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="pb-32 max-w-2xl mx-auto px-3 sm:px-4 pt-3 text-gray-900">
      {/* 1. Header Banner & Identity Card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden mb-4">
        {/* Banner with diagonal pattern */}
        <div className="relative h-32 sm:h-36 diagonal-stripes flex items-start justify-between p-3">
          <span className="text-[11px] font-mono text-gray-400">
            banner — 1500 × 500
          </span>
          <button
            type="button"
            className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-xs font-semibold px-3 py-1 rounded-lg shadow-xs border border-gray-200 text-gray-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>

        {/* Profile Details Container */}
        <div className="p-4 sm:p-5 pt-0 relative">
          {/* Avatar and Trusted Badge Row */}
          <div className="flex items-end justify-between -mt-10 sm:-mt-12 mb-3">
            <div className="flex items-end gap-3.5">
              <div className="relative group">
                <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-[#e5e7eb] border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={userProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-400/80" />
                  )}
                </div>
              </div>
              <button
                type="button"
                className="mb-1 text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-md transition-colors"
              >
                Upload portrait
              </button>
            </div>

            {/* Red Circle Trusted Badge */}
            <div className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#7a102b] text-white shadow-md">
              <span className="text-base sm:text-lg font-black leading-none">
                {userProfile.trustedScore}
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold tracking-wider text-rose-200 mt-0.5">
                TRUSTED
              </span>
            </div>
          </div>

          {/* User Name & Headline */}
          <div className="mt-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-950">
              {userProfile.name} {userProfile.surname}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {userProfile.headline}
            </p>
          </div>

          {/* Public Profile Link Slug */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-mono text-xs text-gray-700">
              {userProfile.publicSlug}
            </div>
            <button
              type="button"
              onClick={handleCopySlug}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
            <a
              href={`https://${userProfile.publicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-[#ff2b5e] hover:bg-[#e51d4e] text-white flex items-center justify-center shadow-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Dream Statement */}
          <div className="mt-5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
              DREAM STATEMENT
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs sm:text-sm text-gray-800 leading-relaxed">
              <textarea
                value={userProfile.dreamStatement}
                onChange={(e) =>
                  setUserProfile((prev) => ({
                    ...prev,
                    dreamStatement: e.target.value,
                  }))
                }
                rows={2}
                className="w-full bg-transparent border-0 resize-none focus:outline-hidden text-gray-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Profile Completeness */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            PROFILE COMPLETENESS
          </span>
          <span className="text-sm font-bold text-gray-900">
            {totalCompletedWeight}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[#ff2b5e] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${totalCompletedWeight}%` }}
          />
        </div>

        {/* Completeness Checklist */}
        <div className="space-y-2">
          {completenessItems.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleCompleteness(item.id)}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    item.completed
                      ? 'bg-[#ff2b5e] text-white'
                      : 'border-2 border-gray-300 bg-white'
                  }`}
                >
                  {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium ${
                    item.completed ? 'text-gray-800' : 'text-gray-600'
                  }`}
                >
                  {item.title}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#ff2b5e]">
                +{item.weightPercent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Identity Section */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-3">
          IDENTITY
        </span>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-gray-500 block mb-1">
                Name
              </label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) =>
                  setUserProfile((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#ff2b5e] transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 block mb-1">
                Surname
              </label>
              <input
                type="text"
                value={userProfile.surname}
                onChange={(e) =>
                  setUserProfile((prev) => ({
                    ...prev,
                    surname: e.target.value,
                  }))
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#ff2b5e] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1">
              Nickname — handle
            </label>
            <input
              type="text"
              value={userProfile.handle}
              onChange={(e) =>
                setUserProfile((prev) => ({ ...prev, handle: e.target.value }))
              }
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#ff2b5e] transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1">
              Headline
            </label>
            <input
              type="text"
              value={userProfile.headline}
              onChange={(e) =>
                setUserProfile((prev) => ({
                  ...prev,
                  headline: e.target.value,
                }))
              }
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#ff2b5e] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 4. Skills, Ask and Offer */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
          SKILLS, ASK AND OFFER
        </span>
        <p className="text-xs text-gray-500 mb-4">
          This is the part agents read first. Skills say what you master, Ask says what you want from them, Offer says what they get from working with you.
        </p>

        {/* Skills Sub-Card */}
        <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3.5 mb-3">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-xs font-bold text-gray-900 uppercase">
              SKILLS
            </span>
            <span className="text-[11px] text-gray-400">What you master.</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {userProfile.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 bg-white border border-gray-200/90 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full shadow-2xs"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add a skill and press Enter"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={addSkill}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-[#ff2b5e]"
          />
        </div>

        {/* Ask Sub-Card */}
        <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-xs font-bold text-gray-900 uppercase">ASK</span>
            <span className="text-[11px] text-gray-400">What you want from agents.</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {userProfile.asks.map((ask) => (
              <span
                key={ask}
                className="inline-flex items-center gap-1.5 bg-white border border-gray-200/90 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full shadow-2xs"
              >
                {ask}
                <button
                  type="button"
                  onClick={() => removeAsk(ask)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add an ask and press Enter"
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            onKeyDown={addAsk}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-[#ff2b5e]"
          />
        </div>
      </div>

      {/* 5. Birth Data (Human Design & Gene Keys) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
          BIRTH DATA
        </span>
        <p className="text-xs text-gray-500 mb-3.5">
          Kept separate from your public identity. Used only to generate your Human Design chart and Gene Keys profile, and never shown publicly unless you publish those results.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-gray-500 block mb-1">
                Date of birth
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={userProfile.birthDate}
                  onChange={(e) =>
                    setUserProfile((prev) => ({
                      ...prev,
                      birthDate: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#ff2b5e]"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 block mb-1">
                Time of birth
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={userProfile.birthTime}
                  onChange={(e) =>
                    setUserProfile((prev) => ({
                      ...prev,
                      birthTime: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#ff2b5e]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1">
              Place of birth
            </label>
            <input
              type="text"
              value={userProfile.birthPlace}
              onChange={(e) =>
                setUserProfile((prev) => ({
                  ...prev,
                  birthPlace: e.target.value,
                }))
              }
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#ff2b5e]"
            />
          </div>

          <button
            type="button"
            className="w-full mt-2 bg-[#ff2b5e] hover:bg-[#e51d4e] active:scale-[0.99] text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition-all"
          >
            Generate Human Design and Gene Keys
          </button>
        </div>
      </div>

      {/* 6. Social Links */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-3">
          SOCIAL LINKS
        </span>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="w-20 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              WEBSITE
            </span>
            <input
              type="text"
              value={userProfile.socials.website}
              onChange={(e) =>
                setUserProfile((prev) => ({
                  ...prev,
                  socials: { ...prev.socials, website: e.target.value },
                }))
              }
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:bg-white focus:outline-hidden focus:border-[#ff2b5e]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              LINKEDIN
            </span>
            <input
              type="text"
              value={userProfile.socials.linkedin}
              onChange={(e) =>
                setUserProfile((prev) => ({
                  ...prev,
                  socials: { ...prev.socials, linkedin: e.target.value },
                }))
              }
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:bg-white focus:outline-hidden focus:border-[#ff2b5e]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              X
            </span>
            <input
              type="text"
              value={userProfile.socials.x}
              onChange={(e) =>
                setUserProfile((prev) => ({
                  ...prev,
                  socials: { ...prev.socials, x: e.target.value },
                }))
              }
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:bg-white focus:outline-hidden focus:border-[#ff2b5e]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              GITHUB
            </span>
            <input
              type="text"
              value={userProfile.socials.github}
              onChange={(e) =>
                setUserProfile((prev) => ({
                  ...prev,
                  socials: { ...prev.socials, github: e.target.value },
                }))
              }
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:bg-white focus:outline-hidden focus:border-[#ff2b5e]"
            />
          </div>
        </div>
      </div>

      {/* 7. Personality & Profiling */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
          PERSONALITY AND PROFILING
        </span>
        <p className="text-xs text-gray-500 mb-3.5">
          Each result you add narrows what agents propose to you — what you want, and what you can offer.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* MBTI */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
              MBTI
            </span>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              {userProfile.mbti.type}
            </p>
            <span className="text-[11px] text-gray-400">
              {userProfile.mbti.source}
            </span>
          </div>

          {/* Enneagram */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
              ENNEAGRAM
            </span>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              {userProfile.enneagram.type}
            </p>
            <span className="text-[11px] text-gray-400">
              {userProfile.enneagram.source}
            </span>
          </div>

          {/* Big Five */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
              BIG FIVE
            </span>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              {userProfile.bigFive.stats}
            </p>
            <span className="text-[11px] text-gray-400">
              {userProfile.bigFive.source}
            </span>
          </div>

          {/* Human Design */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
              HUMAN DESIGN
            </span>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              {userProfile.humanDesign.status}
            </p>
            <span className="text-[11px] text-gray-400">
              {userProfile.humanDesign.notes}
            </span>
          </div>
        </div>
      </div>

      {/* 8. How You Earned AURA */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-4">
          HOW YOU EARNED AURA
        </span>

        <div className="space-y-4">
          {AURA_BREAKDOWN.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-gray-900">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-[11px]">
                    {item.valueDescription}
                  </span>
                  <span className="font-bold text-[#ff2b5e]">
                    +{item.points}
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff2b5e] rounded-full"
                  style={{ width: `${item.currentProgress || 30}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 9. Missions Joined */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs mb-6">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-3">
          MISSIONS JOINED
        </span>

        <div className="space-y-2.5">
          {MISSIONS_JOINED.map((mission) => (
            <div
              key={mission.id}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-200/80"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff2b5e] mt-1.5 shrink-0" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-950">
                    {mission.name}
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {mission.role}
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-gray-900">
                €{mission.earningsEur.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 10. Sticky Action Bar */}
      <div className="fixed bottom-14 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-2.5">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAndPublish}
            className="flex-1 bg-[#ff2b5e] hover:bg-[#e51d4e] active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isSaved ? <Check className="w-4 h-4" /> : null}
            <span>{isSaved ? 'Published!' : 'Save and publish'}</span>
          </button>
          <button
            type="button"
            className="text-xs font-bold text-gray-700 hover:text-gray-950 px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Draft
          </button>
        </div>
      </div>
    </div>
  );
};
