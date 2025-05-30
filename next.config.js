module.exports = {
  // 移除 trailingSlash 和 exportPathMap
  
  async rewrites() {
    console.log('Rewriting /api/* to http://localhost:8000/api/*')
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*' // Use 127.0.0.1 instead of localhost
      }
    ]
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' }
        ]
      }
    ]
  },
  // 添加这个配置来处理客户端路由
  distDir: 'build',
  output: 'export'
  
}