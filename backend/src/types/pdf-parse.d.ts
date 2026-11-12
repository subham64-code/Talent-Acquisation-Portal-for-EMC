declare module "pdf-parse" {
  function pdfParse(buffer: Buffer, options?: any): Promise<{
    text: string;
    pages: number;
    info: any;
    metadata: any;
    versions: any;
  }>;
  export = pdfParse;
}
