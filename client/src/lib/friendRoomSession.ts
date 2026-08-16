const CURRENT_ROOM_KEY = "friendRoomCurrentId";
const CURRENT_ROOM_NAME_KEY = "friendRoomCurrentName";

export function getCurrentFriendRoomId(): string | null {
  try {
    return localStorage.getItem(CURRENT_ROOM_KEY);
  } catch {
    return null;
  }
}

export function getCurrentFriendRoomName(): string | null {
  try {
    return localStorage.getItem(CURRENT_ROOM_NAME_KEY);
  } catch {
    return null;
  }
}

export function setCurrentFriendRoom(room: { id: string; name: string } | null): void {
  try {
    if (!room) {
      localStorage.removeItem(CURRENT_ROOM_KEY);
      localStorage.removeItem(CURRENT_ROOM_NAME_KEY);
      return;
    }
    localStorage.setItem(CURRENT_ROOM_KEY, room.id);
    localStorage.setItem(CURRENT_ROOM_NAME_KEY, room.name);
  } catch {
    /* ignore */
  }
}
