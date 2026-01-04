export function info(req, res) {
  res.json({
    message: 'Welcome to the User Service',
    service: process.env.NAME,
    description: 'User management and profile service for xshop.ai platform',
    environment: process.env.NODE_ENV || 'development',
  });
}

export function version(req, res) {
  res.json({
    service: process.env.NAME,
    version: process.env.VERSION,
  });
}
