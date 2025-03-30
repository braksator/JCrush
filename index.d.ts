declare module 'jcrush' {
  export interface JCrushOptions {
    eval?: boolean;
    let?: boolean;
    semi?: boolean;
    strip?: boolean;
    reps?: number;
    prog?: boolean;
    fin?: boolean;
    maxLen?: number;
    omit?: Array<string>;
    clean?: boolean;
    words?: boolean;
    trim?: boolean;
    break?: Array<string>;
    split?: Array<string>;
    escSafe?: boolean;
  }

  export function code(code: string, opts?: JCrushOptions): string;
  export function file(inputFile: string, outputFile: string, opts?: JCrushOptions): void;
  export function gulp(opts?: JCrushOptions): any;
}