declare module 'jcrush' {
  export interface JCrushOptions {
    eval?: boolean;
    let?: boolean;
    semi?: boolean;
  }

  export function code(code: string, opts?: JCrushOptions): string;
  export function file(inputFile: string, outputFile: string, opts?: JCrushOptions): void;
  export function gulp(opts?: JCrushOptions): any;
}