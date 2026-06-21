const { createServer } = require('vite');

(async () => {
  console.log("Starting Vite SSR to test module loading...");
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });
  try {
    const module = await server.ssrLoadModule('/src/main.jsx');
    console.log("Module loaded successfully without throwing top-level errors!");
  } catch (e) {
    console.error("SSR Evaluation Error Caught:");
    console.error(e);
  }
  await server.close();
})();
