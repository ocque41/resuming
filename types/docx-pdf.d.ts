declare module 'docx-pdf' {
  function docxPdf(
    input: string,
    output: string,
    callback: (error: Error | null) => void
  ): void;
  
  export = docxPdf;
} 