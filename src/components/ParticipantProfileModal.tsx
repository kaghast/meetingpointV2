import React, { useState } from 'react';
import { X, Dices, Check, User, Sparkles } from 'lucide-react';
import { ParticipantProfile } from '../types';
import { FUN_AVATARS, generateRandomFunName, saveParticipantProfile } from '../utils/anonymous';

interface ParticipantProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ParticipantProfile;
  onSave: (updated: ParticipantProfile) => void;
}

export const ParticipantProfileModal: React.FC<ParticipantProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
}) => {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);

  if (!isOpen) return null;

  const handleRandomize = () => {
    const generated = generateRandomFunName();
    setName(generated.name);
    setAvatar(generated.avatar);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ParticipantProfile = {
      id: profile.id,
      name: name.trim() || profile.name,
      avatar: avatar || profile.avatar,
    };
    saveParticipantProfile(updated);
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Anonim Profilinizi Düzenleyin</h3>
              <p className="text-xs text-slate-500">Kimliğiniz tamamen gizli kalır; eğlenceli adınızı seçin.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Live Preview Card */}
          <div className="bg-linear-to-r from-purple-50 via-blue-50 to-indigo-50 border border-indigo-100/80 rounded-2xl p-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-indigo-200 shadow-sm flex items-center justify-center text-3xl mx-auto mb-2 select-none">
              {avatar}
            </div>
            <h4 className="font-extrabold text-slate-900 text-base">{name || 'İsimsiz Katılımcı'}</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Toplantı boyunca diğer katılımcılara bu şekilde görüneceksiniz</p>
          </div>

          {/* Randomizer Button */}
          <button
            type="button"
            onClick={handleRandomize}
            className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs"
          >
            <Dices className="w-4 h-4" />
            <span>🎲 Rastgele Eğlenceli İsim & Avatar Üret</span>
          </button>

          {/* Name input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Anonim Takma Adınız
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Kozmik Panda"
              maxLength={30}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
            />
            <span className="text-[11px] text-slate-400 block text-right">{name.length}/30</span>
          </div>

          {/* Avatar selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Eğlenceli Avatarınızı Seçin
            </label>
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200">
              {FUN_AVATARS.map((emoji) => {
                const isSelected = avatar === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    className={`h-11 rounded-xl flex items-center justify-center text-xl transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-md scale-105 ring-2 ring-purple-300'
                        : 'hover:bg-white hover:shadow-2xs text-slate-700'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Kaydet & Kullan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
