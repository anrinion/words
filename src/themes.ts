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
  // Semantic colours
  danger: string        // destructive action (delete)
  dangerSoft: string    // danger icon background tint
  statusNew: string     // unseen word indicator
  statusWeak: string    // problematic word indicator
  statusMastered: string // learned word indicator
  toastBg: string       // toast notification background
  toastAction: string   // toast undo/action button colour
  toastInk: string      // toast text colour
  overlay: string       // modal/dialog backdrop colour
  dangerInk: string     // text on danger-coloured backgrounds
  panelBg: string       // theme-flavour decorative panel background
  panelText: string     // theme-flavour decorative panel text
  panelMeta: string     // theme-flavour decorative panel metadata/label text
  sessionName: string   // what a normal training session is called ("Practice" / "Lesson" / "Quest")
}

export const THEMES: Record<ThemeId, Theme> = {
  neutral: {
    id: 'neutral', label: 'Neutral',
    appBg: '#f4f4f6', surface: '#ffffff', surface2: '#f8f8fb',
    ink: '#15171c', inkSoft: '#565b64', inkFaint: '#9a9ea7',
    border: '#ecebe7', pop: '#548de8', popInk: '#ffffff', popSoft: '#eef4fd',
    radius: '12px', radiusSm: '9px',
    fontHead: "'Schibsted Grotesk', sans-serif",
    fontBody: "'Schibsted Grotesk', sans-serif",
    examLabel: 'Exam',
    trainTitle: "Today's session",
    trainLead: 'A calm pass through your words. No grades — just what you remember and what\'s worth another look.',
    startCta: 'Start session',
    danger: '#dc5360', dangerSoft: 'rgba(220,83,96,.12)',
    statusNew: '#9aa0ac', statusWeak: '#e0a23a', statusMastered: '#3fae86',
    toastBg: '#23232b', toastAction: '#a8a2ff',
    toastInk: '#ffffff', overlay: 'rgba(0,0,0,.45)', dangerInk: '#ffffff',
    panelBg: '#f8f8fb', panelText: '#15171c', panelMeta: '#565b64',
    sessionName: 'Practice',
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
    trainLead: 'Work through every word before the lesson starts.',
    startCta: 'Start homework',
    danger: '#b91c1c', dangerSoft: 'rgba(185,28,28,.12)',
    statusNew: '#a8a29e', statusWeak: '#d97706', statusMastered: '#16a34a',
    toastBg: '#292524', toastAction: '#c4b5fd',
    toastInk: '#ffffff', overlay: 'rgba(20,20,28,.45)', dangerInk: '#ffffff',
    panelBg: '#2b382f', panelText: '#f2ead6', panelMeta: '#cdbf9c',
    sessionName: 'Lesson',
  },
  quest: {
    id: 'quest', label: 'Quest',
    appBg: '#0e1117', surface: '#161b24', surface2: '#1d2330',
    ink: '#eef1f7', inkSoft: '#99a3b4', inkFaint: '#7a8799',
    border: '#272e3d', pop: '#a3e635', popInk: '#121807', popSoft: '#1f2913',
    radius: '11px', radiusSm: '8px',
    fontHead: "'Space Grotesk', sans-serif",
    fontBody: "'Space Grotesk', sans-serif",
    examLabel: 'Boss Trial',
    trainTitle: 'Active quests',
    trainLead: 'Clear the words to push the main quest forward.',
    startCta: 'Start run',
    danger: '#f87171', dangerSoft: 'rgba(248,113,113,.14)',
    statusNew: '#6b7280', statusWeak: '#f59e0b', statusMastered: '#22c55e',
    toastBg: '#1d2330', toastAction: '#818cf8',
    toastInk: '#eef1f7', overlay: 'rgba(0,0,0,.45)', dangerInk: '#ffffff',
    panelBg: '#161b24', panelText: '#eef1f7', panelMeta: '#99a3b4',
    sessionName: 'Quest',
  },
}
