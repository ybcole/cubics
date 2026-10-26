import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

interface CursorData {
  x: number;
  y: number;
  userId: string;
  userName: string;
  color: string;
}

const cursors = new Map<string, CursorData>();

io.on("connection", (socket) => {
  console.log("Cursor server: user connected", socket.id);

  // Send existing cursors to newly connected user
  socket.emit("cursors:init", Array.from(cursors.entries()).map(([id, c]) => ({ id, ...c })));

  socket.on("cursor:move", (data: CursorData) => {
    cursors.set(socket.id, {
      ...data,
      userId: socket.id,
    });
    socket.broadcast.emit("cursor:move", {
      id: socket.id,
      ...data,
    });
  });

  socket.on("disconnect", () => {
    cursors.delete(socket.id);
    socket.broadcast.emit("cursor:leave", socket.id);
  });
});

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
httpServer.listen(PORT, () => {
  console.log(`Cursor socket server listening on port ${PORT}`);
});
