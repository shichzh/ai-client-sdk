/**
 * 共享的 manualChunks 配置
 * 用于 ESM 格式的代码分割
 */
export function manualChunks(id: string) {
  if (id.includes('node_modules')) {
    if (id.includes('react-dom')) {
      return 'vendor-react-dom';
    }
    if (id.includes('unified') || id.includes('remark') || id.includes('rehype')) {
      return 'vendor-markdown';
    }
    if (id.includes('ajv')) {
      return 'vendor-ajv';
    }
    if (id.includes('chrono-node')) {
      return 'vendor-chrono-node';
    }
  }
}
