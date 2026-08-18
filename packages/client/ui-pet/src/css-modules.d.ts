declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.webp' {
  const dataUrl: string
  export default dataUrl
}
