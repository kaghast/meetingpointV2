import { ParticipantProfile } from '../types';

export const FUN_ADJECTIVES = [
  'Kozmik', 'Neşeli', 'Uçan', 'Gizemli', 'Süper', 'Becerikli',
  'Parlak', 'Hızlı', 'Sihirli', 'Dahi', 'Dansçı', 'Şimşek',
  'Çılgın', 'Eğlenceli', 'Meraklı', 'Bilge', 'Atom', 'Turbo',
  'Piksel', 'Cesur', 'Ritmik', 'Gezgin', 'Şakacı', 'Kahraman',
  'Dost Canlısı', 'Maceracı', 'Pozitif'
];

export const FUN_ANIMALS = [
  'Panda', 'Flamingo', 'Kunduz', 'Koala', 'Rakun', 'Penguen',
  'Baykuş', 'Sincap', 'Çita', 'Kedi', 'Su Samuru', 'Tavşan',
  'Dinozor', 'Tilki', 'Yunus', 'Bukalemun', 'Ejderha', 'Kirpi',
  'Ahtapot', 'Kaplumbağa', 'Kanguru', 'Ayı', 'Kurt', 'Papağan'
];

export const FUN_AVATARS = [
  '🦊', '🐼', '🚀', '🦝', '🦉', '🦄', '🐙', '🐨',
  '🦁', '🐯', '🐧', '🦩', '🦦', '🦔', '🐸', '🐱',
  '🐬', '⚡', '⭐', '🎯', '🦖', '🐢', '🦘', '🐻',
  '🐺', '🦜', '🐵', '🐿️', '🐝', '🦚'
];

export function generateRandomFunName(): { name: string; avatar: string } {
  const adj = FUN_ADJECTIVES[Math.floor(Math.random() * FUN_ADJECTIVES.length)];
  const animal = FUN_ANIMALS[Math.floor(Math.random() * FUN_ANIMALS.length)];
  const avatar = FUN_AVATARS[Math.floor(Math.random() * FUN_AVATARS.length)];
  return {
    name: `${adj} ${animal}`,
    avatar,
  };
}

const STORAGE_KEY = 'meeting_participant_profile_v2';

export function getParticipantProfile(existingIdParam?: string): ParticipantProfile {
  if (typeof window === 'undefined') {
    return { id: existingIdParam || 'anon-default', name: 'Kozmik Panda', avatar: '🐼' };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.id && parsed.name && parsed.avatar) {
        if (existingIdParam && parsed.id !== existingIdParam) {
          parsed.id = existingIdParam;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse participant profile', e);
  }

  // Generate new profile
  let existingId = existingIdParam || localStorage.getItem('meeting_participant_id');
  if (!existingId) {
    existingId = 'anon-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('meeting_participant_id', existingId);
  }

  const generated = generateRandomFunName();
  const newProfile: ParticipantProfile = {
    id: existingId,
    name: generated.name,
    avatar: generated.avatar,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
  } catch (e) {
    // Ignore quota errors
  }

  return newProfile;
}

export const getStoredParticipantProfile = getParticipantProfile;

export function saveParticipantProfile(profile: ParticipantProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem('meeting_participant_id', profile.id);
  } catch (e) {
    console.error('Failed to save participant profile', e);
  }
}
