import { createServer } from './server.js';

console.log('Starting block-editor wiki server...');

createServer();

console.log('Server ready. WebSocket endpoint: ws://localhost:1234/:pageName');
console.log('REST API: http://localhost:1234/api/pages');
