interface TutorialEntry {
  id: string;
  icon: string;
  bullets: number;
  targets: string[];
}

export { TutorialEntry };
declare const entries: TutorialEntry[];
export default entries;
