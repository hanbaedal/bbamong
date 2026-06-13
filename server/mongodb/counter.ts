import { CounterModel } from "./models";

/** PostgreSQL serial 대체 — 컬렉션별 자동 증가 ID */
export async function getNextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  );
  return counter.value;
}
