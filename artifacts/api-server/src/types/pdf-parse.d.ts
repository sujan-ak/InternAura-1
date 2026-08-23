declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(dataBuffer: Buffer | ArrayBuffer, options?: any): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }>;
  export default pdfParse;
}
