declare module 'enquirer' {
  export function prompt<T = any>(questions: any): Promise<T>;
}
