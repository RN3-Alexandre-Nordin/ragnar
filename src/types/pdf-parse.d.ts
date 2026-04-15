declare module 'pdf-parse/lib/pdf-parse' {
    function pdf(dataBuffer: Buffer, options?: any): Promise<any>;
    export = pdf;
}
