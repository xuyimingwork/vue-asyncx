import { InternalTrack, Tracker } from "@/core/monitor/types"
import { BaseFunction } from "@/utils/types"

export function createTrackedFunction<Fn extends BaseFunction>(fn: Fn, { tracker, before, after, fulfill, reject }: {
  tracker: Tracker,
  before: (params: { args: Parameters<Fn>, track: InternalTrack }) => any[],
  after: (params: { track: InternalTrack }) => void,
  fulfill: (params: { value: any, track: InternalTrack }) => void,
  reject: (params: { error: any, track: InternalTrack }) => void,
}): Fn {
  function run(...args: Parameters<Fn>): ReturnType<Fn> {
    const track = tracker.track()
    try {
      const _args = before({ args, track })
      const result = fn.apply(this, _args)
      after({ track })
      if (result instanceof Promise) {
        result.then(
          (value) => fulfill({ value, track }),
          (error) => reject({ error, track })
        )
      } else {
        fulfill({ value: result, track })
      }
      return result
    } catch (e) {
      after({ track })
      reject({ error: e, track })
      throw e
    }
  }

  run.prototype = fn.prototype;
  Object.setPrototypeOf(run, fn);

  return run as any
}