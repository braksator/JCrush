declare module 'jcrush' {
  export interface JCrushOptions {
    eval?: boolean;
    let?: boolean;
  }

  export function jcrushCode(code: string, opts?: JCrushOptions): string;
  export function jcrushFile(inputFile: string, outputFile: string, opts?: JCrushOptions): void;
  export function gulp(opts?: JCrushOptions): any;
}