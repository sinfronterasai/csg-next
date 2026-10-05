import type { ReportType } from '@/lib/reportEngine';

export type LandingProductType = 'natalpremium' | 'transit' | 'vocation';

export interface ReportLandingContent {
  type: LandingProductType;
  slug: string;
  name: string;
  eyebrow: string;
  headline: string;
  summary: string;
  audience: string[];
  includes: string[];
  steps: string[];
  birthTimeNote: string;
  limitations: string[];
  faqs: { question: string; answer: string }[];
}

export const REPORT_LANDING_CONTENT: Record<LandingProductType, ReportLandingContent> = {
  natalpremium: {
    type: 'natalpremium',
    slug: 'premium-natal-report',
    name: 'Premium Natal Report',
    eyebrow: 'A written interpretation of your birth chart',
    headline: 'See your whole chart as one connected story.',
    summary: 'The Premium Natal Report turns the chart you calculate on Cosmic Spirit Guide into a deeper written reading: the placements, patterns, and practical reflections that help you work with the chart rather than only view it.',
    audience: [
      'You already have a birth chart and want more than a list of placements.',
      'You prefer a report you can return to instead of a one-time screen view.',
      'You want the foundation report before exploring more specialized timing or relationship work.',
    ],
    includes: [
      'A narrative interpretation built from your saved natal chart.',
      'Verified chart placements and selected chart relationships used by the report.',
      'Plain-language interpretation with practical reflection prompts.',
      'A private report you can read in your profile, with a PDF download when approved and available.',
    ],
    steps: [
      'Sign in or create your Cosmic Spirit Guide account.',
      'Save your birth chart, or confirm the chart already saved to your profile.',
      'Complete the one-time Whop checkout for this report.',
      'Open the finished report from your profile Reports tab and download the PDF when it is ready.',
    ],
    birthTimeNote: 'An accurate birth time matters for the Ascendant, Midheaven, and house placements. If your time is unknown, the saved chart can use solar houses; those time-dependent parts should be treated as limited rather than exact.',
    limitations: [
      'This is an astrological interpretation for reflection, not a diagnosis, guarantee, or fixed prediction.',
      'The report is prepared after purchase and is not shown as finished until the existing approval state is complete.',
    ],
    faqs: [
      { question: 'Do I need to enter my birth data again?', answer: 'No. The purchase flow uses the birth chart saved to your account. If you do not have one yet, the flow sends you to create it before the report is generated.' },
      { question: 'Where do I read the report?', answer: 'Approved reports appear in your account under Profile → Reports. Premium natal reports also have an existing PDF download action when the report is deliverable.' },
      { question: 'What if I do not know my exact birth time?', answer: 'You can save a chart with the unknown-time option, but houses and angles are not exact in that case. The page does not promise the same time-dependent detail as a timed chart.' },
    ],
  },
  transit: {
    type: 'transit',
    slug: 'yearly-transit-forecast',
    name: 'Yearly Transit Forecast',
    eyebrow: 'A twelve-month timing report',
    headline: 'Know which parts of the year deserve your attention.',
    summary: 'The Yearly Transit Forecast follows the moving sky against your saved natal chart and organizes the next twelve months into readable transit themes, windows, and practical points to consider.',
    audience: [
      'You want timing and context, not another description of your natal personality.',
      'You are planning a year and want an astrological calendar beside your practical plans.',
      'You want to understand when a theme may feel more active without treating it as a guaranteed event.',
    ],
    includes: [
      'A twelve-month forecast calculated from your saved natal chart.',
      'Monthly transit highlights and the chart points they contact.',
      'Relative emphasis across themes such as career, love, money, health, and growth.',
      'A readable report delivered through your account after the existing report process completes.',
    ],
    steps: [
      'Sign in or create your account.',
      'Save or confirm the natal chart the forecast will use.',
      'Complete the one-time card checkout for the Yearly Transit Forecast.',
      'Read the approved report from Profile → Reports.',
    ],
    birthTimeNote: 'Planet-to-planet transit timing can still be calculated without an exact birth time, but house-based timing and angles are the parts most affected. Use an unknown-time chart with that limitation in mind.',
    limitations: [
      'A transit marks an astrological period of emphasis; it does not promise that a specific life event will happen.',
      'The forecast is a planning and reflection aid, not financial, medical, legal, or professional advice.',
    ],
    faqs: [
      { question: 'Is this a prediction of what will happen?', answer: 'No. It maps calculated transit activity and interpretive themes. Your choices and circumstances remain yours, and the report does not guarantee an outcome.' },
      { question: 'Can I use it without an exact birth time?', answer: 'Yes, the chart flow supports unknown birth time, but houses and angles are limited. The page does not promise exact house-based timing for an unknown time.' },
      { question: 'Where is the finished forecast delivered?', answer: 'The existing fulfillment path places the approved report in your account under Profile → Reports. The current interface is the source of truth for its available download action.' },
    ],
  },
  vocation: {
    type: 'vocation',
    slug: 'vocation-wealth-map',
    name: 'Vocation & Wealth Map',
    eyebrow: 'Career, work, and resource patterns',
    headline: 'Bring your work decisions into a longer chart-based view.',
    summary: 'The Vocation & Wealth Map reads the career-relevant parts of your saved chart—public direction, daily work patterns, resources, and timing themes—so you can reflect on work choices with more context.',
    audience: [
      'You are weighing a role change, launch, or new professional direction.',
      'You want career and resource themes separated from a general natal reading.',
      'You want a chart-based perspective to use alongside real-world planning and evidence.',
    ],
    includes: [
      'A career-focused interpretation based on your saved natal chart.',
      'Coverage of public direction, daily work, money/resource patterns, and leadership themes.',
      'A calculated timing section that connects career themes to the chart.',
      'A readable report in your account after the existing fulfillment and approval process completes.',
    ],
    steps: [
      'Sign in or create your account.',
      'Save or confirm the natal chart used for the report.',
      'Complete the one-time Whop checkout for this report.',
      'Open the approved report from Profile → Reports.',
    ],
    birthTimeNote: 'Career interpretation leans on the Midheaven and house cusps, which depend on an accurate birth time. With unknown time, planetary themes remain available but time-sensitive house and angle claims are limited.',
    limitations: [
      'The report does not promise a job, promotion, revenue, or investment result.',
      'Astrology is one reflection tool; use practical research and professional advice for career and financial decisions.',
    ],
    faqs: [
      { question: 'Does this report guarantee career or money results?', answer: 'No. It describes chart-based themes and timing for reflection. It cannot establish what you will earn, whether a venture will succeed, or what decision you must make.' },
      { question: 'What birth details are required?', answer: 'The account needs a saved birth date and location, and an exact birth time when available. Unknown-time charts are supported with clear limits around houses and angles.' },
      { question: 'Where do I retrieve it?', answer: 'After fulfillment reaches the existing approved state, the report appears in Profile → Reports. The page does not promise a separate delivery channel.' },
    ],
  },
};

export const REPORT_LANDING_ROUTE_BY_TYPE: Record<LandingProductType, string> = {
  natalpremium: '/reports/premium-natal-report',
  transit: '/reports/yearly-transit-forecast',
  vocation: '/reports/vocation-wealth-map',
};

export function isLandingProductType(value: string): value is LandingProductType {
  return value in REPORT_LANDING_CONTENT;
}

export function reportTypeForLanding(type: LandingProductType): ReportType {
  return type;
}
