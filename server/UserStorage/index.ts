import {UserStorage} from "./userStorage";
import {PostStorage} from "./postStorage";
import {PointStorage} from "./pointStorage";
import {MatchStorage} from "./matchStorage";
import {StadiumStorage} from "./stadiumStorage";
import {AttendanceStorage} from "./attendanceStorage";

// 각 도메인 Storage 클래스 초기화
export const storage = {
  users: new UserStorage(),
  posts: new PostStorage(),
  points: new PointStorage(),
  matches: new MatchStorage(),
  stadiums: new StadiumStorage(),
  attendance: new AttendanceStorage(),
};

export type Storage = typeof storage;
