export default {
  base: process.env.VITE_BASE || '/',
  server:{proxy:{'/api':'http://127.0.0.1:8788'}},
};
