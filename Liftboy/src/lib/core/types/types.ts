export interface SlideInput {
  key: string;
  value: number | string;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  options?: string[];
}

export interface SlideData {
  title: string;
  description?: string;
  inputs: SlideInput[];
}

export type SectionKind = "xox" | "melody" | "synth";
export type InputKind = SectionKind | "lane";

export interface SectionData {
  name: string;
  kind: SectionKind;
  slides: SlideData[];
}
