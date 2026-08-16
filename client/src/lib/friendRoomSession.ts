const CURRENT_ROOM_KEY = "friendRoomCurrentId";
const CURRENT_ROOM_NAME_KEY = "friendRoomCurrentName";
const PENDING_OPEN_KEY = "friendRoomPendingOpen";

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

/** 방 상세로 이동할 때 쿼리 대신 사용 (wouter 검색 파라미터 누락 방지) */
export function setPendingFriendRoomOpen(roomId: string | null): void {
  try {
    if (!roomId) {
      sessionStorage.removeItem(PENDING_OPEN_KEY);
      return;
    }
    sessionStorage.setItem(PENDING_OPEN_KEY, roomId);
  } catch {
    /* ignore */
  }
}

export function peekPendingFriendRoomOpen(): string | null {
  try {
    return sessionStorage.getItem(PENDING_OPEN_KEY);
  } catch {
    return null;
  }
}

export function navigateToFriendRoomDetail(
  roomId: string,
  setLocation: (path: string) => void,
): void {
  setPendingFriendRoomOpen(roomId);
  setLocation("/home/rooms");
}
