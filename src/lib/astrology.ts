// Single source of truth for astrological reference data, explanations, and helpers.
// Both the computed chart (birth-chart) and the saved chart (my-chart) consume this.

export type SignKey =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export type Element = 'Fire' | 'Earth' | 'Air' | 'Water';
export type Modality = 'Cardinal' | 'Fixed' | 'Mutable';
export type Dignity = 'domicile' | 'exaltation' | 'detriment' | 'fall' | null;

export interface SignInfo {
  key: SignKey;
  label: string;
  glyph: string;
  element: Element;
  modality: Modality;
  ruler: string;
  dates: string;
  love: string;
  number: string;
  power: string;
  traits: string[];
  explanation: string;
}

export const SIGNS: SignInfo[] = [
  { key: 'aries', label: 'Aries', glyph: '♈', element: 'Fire', modality: 'Cardinal', ruler: 'Mars', dates: 'March 21 - April 19', love: 'Leo, Sagittarius', number: '9', power: 'Courage', traits: ['Pioneering', 'Assertive', 'Impulsive'], explanation: 'Aries is the first sign of the zodiac: a cardinal fire sign ruled by Mars. It carries the initiating spark of the self, direct action, and fearless beginnings.' },
  { key: 'taurus', label: 'Taurus', glyph: '♉', element: 'Earth', modality: 'Fixed', ruler: 'Venus', dates: 'April 20 - May 20', love: 'Virgo, Capricorn', number: '6', power: 'Patience', traits: ['Steadfast', 'Sensual', 'Loyal'], explanation: 'Taurus is a fixed earth sign ruled by Venus. It grounds energy into the physical world, valuing stability, beauty, and measured, lasting growth.' },
  { key: 'gemini', label: 'Gemini', glyph: '♊', element: 'Air', modality: 'Mutable', ruler: 'Mercury', dates: 'May 21 - June 20', love: 'Libra, Aquarius', number: '5', power: 'Intellect', traits: ['Curious', 'Communicative', 'Adaptable'], explanation: 'Gemini is a mutable air sign ruled by Mercury. It governs the mind, language, and the restless exchange of ideas across many interests at once.' },
  { key: 'cancer', label: 'Cancer', glyph: '♋', element: 'Water', modality: 'Cardinal', ruler: 'Moon', dates: 'June 21 - July 22', love: 'Scorpio, Pisces', number: '2', power: 'Intuition', traits: ['Nurturing', 'Protective', 'Emotional'], explanation: 'Cancer is a cardinal water sign ruled by the Moon. It holds memory, home, and emotional security as the foundation of the self.' },
  { key: 'leo', label: 'Leo', glyph: '♌', element: 'Fire', modality: 'Fixed', ruler: 'Sun', dates: 'July 23 - August 22', love: 'Aries, Sagittarius', number: '1', power: 'Vitality', traits: ['Charismatic', 'Generous', 'Proud'], explanation: 'Leo is a fixed fire sign ruled by the Sun. It expresses identity through creative self-radiance, warmth, and a natural center of gravity.' },
  { key: 'virgo', label: 'Virgo', glyph: '♍', element: 'Earth', modality: 'Mutable', ruler: 'Mercury', dates: 'August 23 - September 22', love: 'Taurus, Capricorn', number: '3', power: 'Precision', traits: ['Analytical', 'Service-oriented', 'Precise'], explanation: 'Virgo is a mutable earth sign ruled by Mercury. It refines, organizes, and improves through careful discernment and devoted service.' },
  { key: 'libra', label: 'Libra', glyph: '♎', element: 'Air', modality: 'Cardinal', ruler: 'Venus', dates: 'September 23 - October 22', love: 'Gemini, Aquarius', number: '7', power: 'Harmony', traits: ['Diplomatic', 'Balanced', 'Aesthetic'], explanation: 'Libra is a cardinal air sign ruled by Venus. It seeks equilibrium, relationship, and beauty through conscious weighing of opposites.' },
  { key: 'scorpio', label: 'Scorpio', glyph: '♏', element: 'Water', modality: 'Fixed', ruler: 'Mars', dates: 'October 23 - November 21', love: 'Cancer, Pisces', number: '8', power: 'Alchemy', traits: ['Intense', 'Penetrating', 'Transformative'], explanation: 'Scorpio is a fixed water sign ruled by Mars (traditionally) and Pluto (modernly). It works through depth, compulsion, and total transformation.' },
  { key: 'sagittarius', label: 'Sagittarius', glyph: '♐', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter', dates: 'November 22 - December 21', love: 'Aries, Leo', number: '4', power: 'Freedom', traits: ['Expansive', 'Philosophical', 'Adventurous'], explanation: 'Sagittarius is a mutable fire sign ruled by Jupiter. It reaches outward for meaning, exploration, and the broad horizon of belief.' },
  { key: 'capricorn', label: 'Capricorn', glyph: '♑', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn', dates: 'December 22 - January 19', love: 'Taurus, Virgo', number: '10', power: 'Legacy', traits: ['Ambitious', 'Disciplined', 'Structural'], explanation: 'Capricorn is a cardinal earth sign ruled by Saturn. It builds lasting structure through patience, responsibility, and long horizons.' },
  { key: 'aquarius', label: 'Aquarius', glyph: '♒', element: 'Air', modality: 'Fixed', ruler: 'Saturn', dates: 'January 20 - February 18', love: 'Gemini, Libra', number: '11', power: 'Vision', traits: ['Original', 'Independent', 'Humanitarian'], explanation: 'Aquarius is a fixed air sign ruled by Saturn (traditionally) and Uranus (modernly). It breaks pattern in service of the collective and the future.' },
  { key: 'pisces', label: 'Pisces', glyph: '♓', element: 'Water', modality: 'Mutable', ruler: 'Jupiter', dates: 'February 19 - March 20', love: 'Cancer, Scorpio', number: '12', power: 'Mysticism', traits: ['Receptive', 'Compassionate', 'Imaginative'], explanation: 'Pisces is a mutable water sign ruled by Jupiter (traditionally) and Neptune (modernly). It dissolves boundaries and opens to feeling, dream, and unity.' },
];

export interface PlanetInfo {
  key: string;
  label: string;
  glyph: string;
  description: string;
}

export const PLANETS: PlanetInfo[] = [
  { key: 'sun', label: 'Sun', glyph: '☉', description: 'Core identity and conscious will — the central organizing light of the chart.' },
  { key: 'moon', label: 'Moon', glyph: '☽', description: 'Instinct, emotion, and the needs of the inner self — how you feel safe.' },
  { key: 'mercury', label: 'Mercury', glyph: '☿', description: 'Mind, communication, and how thought moves between you and the world.' },
  { key: 'venus', label: 'Venus', glyph: '♀', description: 'Love, attraction, values, and what you draw toward you.' },
  { key: 'mars', label: 'Mars', glyph: '♂', description: 'Drive, assertion, and the energy with which you act and defend.' },
  { key: 'jupiter', label: 'Jupiter', glyph: '♃', description: 'Expansion, belief, and where life grows and seeks meaning.' },
  { key: 'saturn', label: 'Saturn', glyph: '♄', description: 'Structure, discipline, and the boundaries that give form to life.' },
  { key: 'uranus', label: 'Uranus', glyph: '♅', description: 'Change, originality, and the sudden break from the expected.' },
  { key: 'neptune', label: 'Neptune', glyph: '♆', description: 'Imagination, dissolution, and the pull toward the transcendent.' },
  { key: 'pluto', label: 'Pluto', glyph: '♇', description: 'Power, endings, and deep regeneration through transformation.' },
  { key: 'northnode', label: 'North Node', glyph: '☊', description: 'The lunar node of growth — the direction your path is learning toward.' },
  { key: 'southnode', label: 'South Node', glyph: '☋', description: 'The lunar node of release — inherited patterns you are moving beyond.' },
  { key: 'chiron', label: 'Chiron', glyph: '⚷', description: 'The wound and the healing capacity carried within it.' },
];

export interface HouseInfo {
  num: number;
  label: string;
  area: string;
  description: string;
}

export const HOUSES: HouseInfo[] = [
  { num: 1, label: 'First', area: 'Identity', description: 'The Ascendant and mask: how you meet the world and appear to others.' },
  { num: 2, label: 'Second', area: 'Resources', description: 'Personal worth, possessions, and what you value as yours.' },
  { num: 3, label: 'Third', area: 'Communication', description: 'Mind, speech, siblings, and the immediate local environment.' },
  { num: 4, label: 'Fourth', area: 'Home', description: 'Roots, family, and the private foundation beneath your life.' },
  { num: 5, label: 'Fifth', area: 'Creativity', description: 'Self-expression, romance, play, and what you create for joy.' },
  { num: 6, label: 'Sixth', area: 'Service', description: 'Work, health, and the daily rhythms that sustain the body.' },
  { num: 7, label: 'Seventh', area: 'Partnership', description: 'One-to-one relationships, marriage, and open enemies.' },
  { num: 8, label: 'Eighth', area: 'Transformation', description: 'Shared resources, depth, intimacy, and regeneration.' },
  { num: 9, label: 'Ninth', area: 'Belief', description: 'Meaning, higher learning, travel, and the expansive horizon.' },
  { num: 10, label: 'Tenth', area: 'Vocation', description: 'The Midheaven: public life, career, and standing in the world.' },
  { num: 11, label: 'Eleventh', area: 'Community', description: 'Friends, groups, and the future you envision with others.' },
  { num: 12, label: 'Twelfth', area: 'Interior', description: 'The hidden, the subconscious, and what dissolves behind the scenes.' },
];

const RULERS: Record<SignKey, string> = {
  aries: 'mars', taurus: 'venus', gemini: 'mercury', cancer: 'moon', leo: 'sun', virgo: 'mercury',
  libra: 'venus', scorpio: 'mars', sagittarius: 'jupiter', capricorn: 'saturn', aquarius: 'saturn', pisces: 'jupiter',
};
const EXALTATIONS: Partial<Record<SignKey, string>> = {
  aries: 'sun', taurus: 'moon', cancer: 'jupiter', virgo: 'mercury', libra: 'saturn', capricorn: 'mars', pisces: 'venus',
};
const OPPOSITE: Record<SignKey, SignKey> = {
  aries: 'libra', libra: 'aries', taurus: 'scorpio', scorpio: 'taurus', gemini: 'sagittarius', sagittarius: 'gemini',
  cancer: 'capricorn', capricorn: 'cancer', leo: 'aquarius', aquarius: 'leo', virgo: 'pisces', pisces: 'virgo',
};

export function getSign(key: string): SignInfo | undefined { return SIGNS.find((s) => s.key === key.toLowerCase()); }
export function getPlanet(key: string): PlanetInfo | undefined { return PLANETS.find((p) => p.key === key.toLowerCase()); }
export function getHouse(num: number): HouseInfo | undefined { return HOUSES.find((h) => h.num === num); }

export function signFromLongitude(longitude: number): { sign: SignInfo; degreeInSign: number } {
  const norm = ((longitude % 360) + 360) % 360;
  const index = Math.floor(norm / 30) % 12;
  return { sign: SIGNS[index], degreeInSign: norm - index * 30 };
}

export function dignityFor(planetKey: string, signKey: string): Dignity {
  const p = planetKey.toLowerCase();
  const s = signKey.toLowerCase() as SignKey;
  if (RULERS[s] === p) return 'domicile';
  if (EXALTATIONS[s] === p) return 'exaltation';
  if (RULERS[OPPOSITE[s]] === p) return 'detriment';
  if (EXALTATIONS[OPPOSITE[s]] === p) return 'fall';
  return null;
}

export function formatDegree(degree: number): string {
  const norm = ((degree % 360) + 360) % 360;
  const deg = Math.floor(norm);
  const minutesFloat = (norm - deg) * 60;
  const min = Math.floor(minutesFloat);
  const sec = Math.round((minutesFloat - min) * 60);
  return `${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}`;
}
