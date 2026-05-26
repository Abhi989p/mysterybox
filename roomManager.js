// roomManager.js — Room CRUD and player management

const { v4: uuidv4 } = require("uuid");

// Map<roomId, roomState>
const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(hostSocketId, hostName) {
  let code;
  // Ensure unique code
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const hostId = hostSocketId;
  const room = {
    id: code,
    hostId,
    players: [
      {
        id: hostId,
        name: hostName,
        socketId: hostSocketId,
        boxNumber: null,
        connected: true,
        joinOrder: 0,
      },
    ],
    phase: "LOBBY",
    gameState: null, // set by gameEngine when game starts
    gameLog: null,
    disconnectTimers: new Map(),
    lastActive: Date.now(),
  };

  rooms.set(code, room);
  return room;
}

function joinRoom(roomCode, socketId, displayName) {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) return { error: "Room not found" };
  if (room.phase !== "LOBBY") return { error: "Game already in progress" };
  if (room.players.length >= 6) return { error: "Room is full (max 6 players)" };

  // Check duplicate name
  if (room.players.find((p) => p.name.toLowerCase() === displayName.toLowerCase())) {
    return { error: "Name already taken in this room" };
  }

  const player = {
    id: socketId,
    name: displayName,
    socketId,
    boxNumber: null,
    connected: true,
    joinOrder: room.players.length,
  };

  room.players.push(player);
  room.lastActive = Date.now();
  return { room, player };
}

function getRoom(roomCode) {
  return rooms.get(roomCode ? roomCode.toUpperCase() : roomCode) || null;
}

function getRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    if (room.players.find((p) => p.socketId === socketId)) return room;
  }
  return null;
}

function getPlayer(room, socketId) {
  return room.players.find((p) => p.socketId === socketId) || null;
}

function getPlayerById(room, playerId) {
  return room.players.find((p) => p.id === playerId) || null;
}

// Safe public view — never includes prizeBox or gameLog internals
function getPublicRoomState(room) {
  return {
    id: room.id,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      boxNumber: p.boxNumber,
      connected: p.connected,
    })),
  };
}

function removePlayerFromRoom(room, socketId) {
  room.players = room.players.filter((p) => p.socketId !== socketId);
}

// Promote next player in join order as host
function promoteNextHost(room) {
  if (room.players.length === 0) return null;
  const sorted = [...room.players].sort((a, b) => a.joinOrder - b.joinOrder);
  room.hostId = sorted[0].id;
  return sorted[0];
}

function deleteRoom(roomCode) {
  rooms.delete(roomCode);
}

// Reconnect: match by name when socket changes
function reconnectPlayer(room, newSocketId, displayName) {
  const player = room.players.find(
    (p) => p.name.toLowerCase() === displayName.toLowerCase() && !p.connected
  );
  if (!player) return null;
  const oldSocketId = player.socketId;
  // CRITICAL: keep player.id as the original socket ID — all game state (votes, cards, etc) keys on it
  // Only update the transport socket, not the logical player ID
  player.socketId = newSocketId;
  // Do NOT change player.id — it stays as the original value
  player.connected = true;
  // Update host pointer if this player was host
  if (room.hostId === oldSocketId) room.hostId = newSocketId;
  room.lastActive = Date.now();
  return player;
}

function cleanupInactiveRooms(maxAgeMs) {
  const now = Date.now();
  let deletedCount = 0;
  for (const [code, room] of rooms.entries()) {
    // If room is older than maxAgeMs AND has no connected players
    const hasConnectedPlayers = room.players.some((p) => p.connected);
    if (!hasConnectedPlayers && (now - room.lastActive > maxAgeMs)) {
      rooms.delete(code);
      deletedCount++;
    }
  }
  return deletedCount;
}

module.exports = {
  rooms,
  createRoom,
  joinRoom,
  getRoom,
  getRoomBySocketId,
  getPlayer,
  getPlayerById,
  getPublicRoomState,
  removePlayerFromRoom,
  promoteNextHost,
  deleteRoom,
  reconnectPlayer,
  cleanupInactiveRooms,
};
