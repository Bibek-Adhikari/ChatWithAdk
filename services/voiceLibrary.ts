export type VoiceLibraryEntry = {
  id: string;
  name: string;
  lang: string;
};

export const VOICE_LIBRARY: VoiceLibraryEntry[] = [
  // Core
  { id: 'en-US-DarrenNeural', name: 'Darren (Energetic)', lang: 'en-US' },
  { id: 'ne-NP-SagarNeural', name: 'Sagar (Nepali)', lang: 'ne-NP' },
  { id: 'en-US-AndrewNeural', name: 'Andrew (Smooth)', lang: 'en-US' },
  { id: 'en-US-AvaNeural', name: 'Ava (Bright)', lang: 'en-US' },
  // New Options
  { id: 'en-US-JennyNeural', name: 'Jenny (Friendly)', lang: 'en-US' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (Regional)', lang: 'en-IN' },
  { id: 'en-US-AriaNeural', name: 'Aria (Empathetic)', lang: 'en-US' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (British)', lang: 'en-GB' }
];

export const getVoiceById = (id?: string) =>
  VOICE_LIBRARY.find(voice => voice.id === id);
