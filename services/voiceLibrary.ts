export type VoiceLibraryEntry = {
  id: string;
  name: string;
  lang: string;
  gender: 'male' | 'female';
};

export const VOICE_LIBRARY: VoiceLibraryEntry[] = [
  // Core
  { id: 'en-US-DarrenNeural', name: 'Darren (Energetic)', lang: 'en-US', gender: 'male' },
  { id: 'ne-NP-SagarNeural', name: 'Sagar (Nepali)', lang: 'ne-NP', gender: 'male' },
  { id: 'en-US-AndrewNeural', name: 'Andrew (Smooth)', lang: 'en-US', gender: 'male' },
  { id: 'en-GB-NoahNeural', name: 'Noah (Bright)', lang: 'en-UN', gender: 'male' },
  // New Options
  { id: 'en-US-AvaNeural', name: 'Ava (Bright)', lang: 'en-US', gender: 'female' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (Regional)', lang: 'en-IN', gender: 'female' },
  { id: 'en-US-AriaNeural', name: 'Aria (Empathetic)', lang: 'en-US', gender: 'female' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (British)', lang: 'en-GB', gender: 'female' },
];

export const getVoiceById = (id?: string) =>
  VOICE_LIBRARY.find(voice => voice.id === id);
