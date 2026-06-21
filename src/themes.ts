export type ThemeId = 'neutral' | 'school' | 'quest'

export interface Theme {
  id: ThemeId
  label: string
  appBg: string
  surface: string
  surface2: string
  ink: string
  inkSoft: string
  inkFaint: string
  border: string
  pop: string
  popInk: string
  popSoft: string
  radius: string
  radiusSm: string
  fontHead: string
  fontBody: string
  examLabel: string
  trainTitle: string
  trainLead: string
  startCta: string
}

export const THEMES: Record<ThemeId, Theme> = {
  neutral: {
    id: 'neutral', label: 'Neutral',
    appBg: '#ffffff', surface: '#ffffff', surface2: '#f6f6f3',
    ink: '#15171c', inkSoft: '#565b64', inkFaint: '#9a9ea7',
    border: '#ecebe7', pop: '#2f63ff', popInk: '#ffffff', popSoft: '#edf2ff',
    radius: '12px', radiusSm: '9px',
    fontHead: "'Schibsted Grotesk', sans-serif",
    fontBody: "'Schibsted Grotesk', sans-serif",
    examLabel: 'Exam',
    trainTitle: "Today's session",
    trainLead: 'A quick pass through your words.',
    startCta: 'Start session',
  },
  school: {
    id: 'school', label: 'School',
    appBg: '#f7f2e7', surface: '#fffdf6', surface2: '#f1ead7',
    ink: '#2b2620', inkSoft: '#6e6657', inkFaint: '#a99c84',
    border: '#e7ddc7', pop: '#bd3a20', popInk: '#ffffff', popSoft: '#f6e4df',
    radius: '5px', radiusSm: '4px',
    fontHead: "'Newsreader', serif",
    fontBody: "'Schibsted Grotesk', sans-serif",
    examLabel: 'Lesson Time',
    trainTitle: 'Homework',
    trainLead: 'Clear these before the lesson bell rings.',
    startCta: 'Start homework',
  },
  quest: {
    id: 'quest', label: 'Quest',
    appBg: '#0e1117', surface: '#161b24', surface2: '#1d2330',
    ink: '#eef1f7', inkSoft: '#99a3b4', inkFaint: '#5e6675',
    border: '#272e3d', pop: '#a3e635', popInk: '#121807', popSoft: '#1f2913',
    radius: '11px', radiusSm: '8px',
    fontHead: "'Space Grotesk', sans-serif",
    fontBody: "'Space Grotesk', sans-serif",
    examLabel: 'Boss Trial',
    trainTitle: 'Active quests',
    trainLead: 'Clear the words to push the main quest forward.',
    startCta: 'Start run',
  },
}
