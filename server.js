const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
let clients = [];
let gameStarted = false;

wss.on('connection', (ws) => {
  if (clients.length >= 2) {
    ws.send(JSON.stringify({ type: 'full' }));
    ws.close();
    return;
  }
  clients.push(ws);
  console.log('Клиент подключился');

  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    // Передаем сообщение другому клиенту
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    // Можно добавить логику для старта игры при двух подключениях
    if (clients.length === 2 && !gameStarted) {
      // Определяем кто X, кто O
      clients[0].send(JSON.stringify({ type: 'start', symbol: 'X' }));
      clients[1].send(JSON.stringify({ type: 'start', symbol: 'O' }));
      gameStarted = true;
    }
  });

  ws.on('close', () => {
    console.log('Клиент отключился');
    clients = clients.filter(c => c !== ws);
    gameStarted = false;
    // Можно оповестить другого игрока о завершении
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'reset' }));
      }
    });
  });
});