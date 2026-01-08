// scripts/check-routes.js
const app = require('../server'); // on va adapter server.js pour exporter app

function listRoutes() {
  const routes = [];

  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Route directe
      const methods = Object.keys(middleware.route.methods)
        .filter(m => middleware.route.methods[m])
        .map(m => m.toUpperCase())
        .join(',');
      routes.push(`${methods} ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      // Sous-router (ex: /api/percepteur)
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods)
            .filter(m => handler.route.methods[m])
            .map(m => m.toUpperCase())
            .join(',');
          routes.push(
            `${methods} ${middleware.regexp}  -> ${handler.route.path}`
          );
        }
      });
    }
  });

  console.log('=== ROUTES EXPRESS ===');
  routes.forEach(r => console.log(r));
  console.log('=== FIN ROUTES ===');
}

listRoutes();
