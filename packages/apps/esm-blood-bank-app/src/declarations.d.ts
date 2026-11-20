declare module '*.scss' {
  const styles: Record<string, string>;
  export default styles;
}
declare module '*.css';

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.png?inline' {
  const dataUrl: string;
  export default dataUrl;
}

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp, mode?: string): unknown;
  }
}
