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

export type SectionKind = "xox" | "melody" | "synth" | "kick" | "hihat" | "snare" | "conga" | "clap" | "euclidean" | "m185" | "stochastic" | "delay" | "reverb" | "none";
export type InputKind = SectionKind | "lane";

export interface SectionData {
  name: string;
  kind: SectionKind;
  slides: SlideData[];
}
