// Ported from legacy sinfronterasai/csg :: scripts/content-briefs-month-1.json
// Static content briefs for the content pipeline cron. Keep in sync with the editorial calendar.

export interface ContentBrief {
  post_number: number;
  target_keyword: string;
  title_options: string[];
  meta_description?: string;
  h2_headings: string[];
  target_word_count?: number;
  search_intent?: string;
  cta?: string;
}

export const CONTENT_BRIEFS: ContentBrief[] = [
  {
    "post_number": 1,
    "target_keyword": "zodiac compatibility calculator",
    "title_options": [
      "Free Zodiac Compatibility Calculator: Find Your Cosmic Match",
      "Zodiac Compatibility Calculator: Love, Friendship & More"
    ],
    "meta_description": "Discover your cosmic compatibility with our free zodiac calculator. Compare sun, moon & rising signs for love, friendship & career relationships.",
    "h2_headings": [
      "How Zodiac Compatibility Works",
      "Sun Sign Compatibility Chart",
      "Moon Sign Emotional Connection",
      "Rising Sign First Impressions",
      "Free Compatibility Calculator",
      "What Your Results Mean"
    ],
    "target_word_count": 2500,
    "search_intent": "Transactional",
    "cta": "Try the compatibility calculator + sign up for personalized daily horoscope"
  },
  {
    "post_number": 2,
    "target_keyword": "love compatibility by birth date",
    "title_options": [
      "Love Compatibility by Birth Date: The Complete Guide",
      "How to Calculate Love Compatibility Using Birth Dates"
    ],
    "meta_description": "Learn how birth dates reveal love compatibility. Calculate your cosmic connection using numerology, astrology & birth chart analysis.",
    "h2_headings": [
      "Why Birth Dates Matter in Compatibility",
      "Numerology Love Compatibility Method",
      "Astrological Birth Date Analysis",
      "Life Path Number Compatibility",
      "Birth Date Compatibility Calculator",
      "Real Compatibility Examples"
    ],
    "target_word_count": 2000,
    "search_intent": "Informational",
    "cta": "Calculate your compatibility now + download birth date compatibility guide"
  },
  {
    "post_number": 3,
    "target_keyword": "twin flame compatibility test",
    "title_options": [
      "Twin Flame Compatibility Test: Are They Your Other Half?",
      "Free Twin Flame Test: Signs You've Found Your Mirror Soul"
    ],
    "meta_description": "Take our free twin flame compatibility test to discover if you've met your mirror soul. Learn the 7 signs of a true twin flame connection.",
    "h2_headings": [
      "What Is a Twin Flame?",
      "Twin Flame vs Soulmate: Key Differences",
      "The 7 Signs You've Met Your Twin Flame",
      "Free Twin Flame Compatibility Quiz",
      "Understanding Your Quiz Results",
      "Twin Flame Stages Explained"
    ],
    "target_word_count": 2200,
    "search_intent": "Transactional",
    "cta": "Take the twin flame quiz + get personalized guidance"
  },
  {
    "post_number": 4,
    "target_keyword": "numerology compatibility calculator",
    "title_options": [
      "Numerology Compatibility Calculator: Life Path Numbers",
      "Free Numerology Compatibility Test: Find Your Match"
    ],
    "meta_description": "Calculate your numerology compatibility using life path numbers. Discover relationship strengths, challenges & cosmic connections.",
    "h2_headings": [
      "What Is Numerology Compatibility?",
      "How to Calculate Life Path Numbers",
      "Life Path Number 1-9 Compatibility Chart",
      "Master Numbers 11, 22, 33 in Relationships",
      "Free Numerology Compatibility Calculator",
      "Interpreting Your Compatibility Results"
    ],
    "target_word_count": 2800,
    "search_intent": "Transactional",
    "cta": "Use the numerology calculator + get free personalized report"
  },
  {
    "post_number": 5,
    "target_keyword": "how to read your birth chart",
    "title_options": [
      "How to Read Your Birth Chart: A Beginner's Visual Guide",
      "Birth Chart Reading 101: Decode Your Cosmic Blueprint"
    ],
    "meta_description": "Learn how to read your birth chart step-by-step. Understand planets, houses & aspects with our visual beginner's guide to astrology.",
    "h2_headings": [
      "What Is a Birth Chart?",
      "How to Generate Your Birth Chart",
      "The Big Three: Sun, Moon & Rising",
      "Understanding the 12 Houses",
      "Planetary Placements Explained",
      "Reading Aspects in Your Chart",
      "Free Birth Chart Analysis Tool"
    ],
    "target_word_count": 3000,
    "search_intent": "Informational",
    "cta": "Generate your free birth chart + get personalized interpretation"
  },
  {
    "post_number": 6,
    "target_keyword": "mercury retrograde meaning",
    "title_options": [
      "Mercury Retrograde Meaning: Complete Survival Guide",
      "What Mercury Retrograde Really Means for You"
    ],
    "meta_description": "Discover what mercury retrograde actually means. Get the survival guide with do's, don'ts & how to thrive during retrograde periods.",
    "h2_headings": [
      "What Is Mercury Retrograde?",
      "Mercury Retrograde Dates 2026",
      "How Retrograde Affects Each Zodiac Sign",
      "Mercury Retrograde Do's and Don'ts",
      "Survival Checklist",
      "Why Retrograde Can Be Good"
    ],
    "target_word_count": 2500,
    "search_intent": "Informational",
    "cta": "Download mercury retrograde survival checklist + sign up for alerts"
  },
  {
    "post_number": 7,
    "target_keyword": "moon sign calculator free",
    "title_options": [
      "Free Moon Sign Calculator: Discover Your Emotional Core",
      "Moon Sign Calculator: What the Moon Reveals About You"
    ],
    "meta_description": "Calculate your moon sign free. Discover what the moon reveals about your emotions, instincts & inner world with detailed sign meanings.",
    "h2_headings": [
      "What Is Your Moon Sign?",
      "Why Moon Signs Matter",
      "Free Moon Sign Calculator",
      "Moon Sign Meanings A-Z",
      "Moon Sign Compatibility",
      "How to Use Your Moon Sign"
    ],
    "target_word_count": 2200,
    "search_intent": "Transactional",
    "cta": "Calculate your moon sign + get personalized moon phase alerts"
  },
  {
    "post_number": 8,
    "target_keyword": "rising sign calculator",
    "title_options": [
      "Rising Sign Calculator: Find Your Ascendant Sign Free",
      "What's My Rising Sign? Free Ascendant Calculator"
    ],
    "meta_description": "Calculate your rising sign (ascendant) free. Discover how your rising sign shapes first impressions, appearance & approach to life.",
    "h2_headings": [
      "What Is a Rising Sign?",
      "How Rising Signs Affect Personality",
      "Free Rising Sign Calculator",
      "Rising Sign Meanings by Zodiac",
      "Rising Sign vs Sun Sign",
      "Using Rising Sign for Compatibility"
    ],
    "target_word_count": 2000,
    "search_intent": "Transactional",
    "cta": "Calculate your rising sign + discover your full birth chart"
  }
] as ContentBrief[];
