export interface Widget {
  id: string;
  title: string;
  url: string;
  type?: "iframe" | "tab-share";
  streamId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number | null;
  maxH?: number | null;
  createdAt: string;
  updatedAt: string;
  roomId: string;
  createdBy?: string | null;
}

export interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface Room {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  memberCount: number;
  widgetCount: number;
}

export interface RoomMember {
  id: string;
  userId: string;
  roomId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
  user?: User;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
}

export interface Cursor {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  x: number;
  y: number;
  roomId: string;
}

export interface WebSocketMessage {
  type: "WIDGET_ACTION" | "WIDGET_UPDATE" | "CURSOR_MOVE" | "CHAT_MESSAGE" | "ROOM_UPDATE";
  payload: Record<string, unknown>;
  roomId?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  content: string;
  createdAt: string;
}