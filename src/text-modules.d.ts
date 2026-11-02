// .txt files are inlined as strings at build time (babel.config.js `inline-import`).
declare module "*.txt" {
  const text: string;
  export default text;
}
