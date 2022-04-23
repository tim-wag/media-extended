export const LARGE_CURRENT_TIME = 1e101;

import { is } from "@base/hash-tool";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { isTimestamp, parseTF } from "mx-lib";
import { parse as parseQS } from "query-string";

export type UserSeekSource = "progress-bar" | "drag" | "manual";

export interface ControlsState {
  /**
   * the currentTime of the provider
   * one-way binded to the currentTime of the provider
   * (provider -> store, updated via onTimeUpdate)
   * setting this value won't applied to provider
   */
  currentTime: number;
  paused: boolean;
  fullscreen: boolean;
  /** -1 if not explicitly specified */
  fragment: null | [number, number];
  playbackRate: number;
  volume: number;
  muted: boolean;
  autoplay: boolean;
  duration: number | null;
  /**
   * indicate that provider is trying to set new currentTime
   * set to false when the new currentTime is applied
   * (loaded and can continue to play, aka seeked)
   */
  seeking: boolean;
  /**
   * indicate that user is using the progress bar to seek new currentTime,
   * one-way binding to the currentTime of the provider
   * (store -> provider)
   * changing back to null means user seek end and binding is revoked
   */
  userSeek: {
    initialTime: number;
    currentTime: number;
    pausedBeforeSeek: boolean | null;
    source: UserSeekSource;
  } | null;
  loop: boolean;
  /**
   * buffered range in seconds
   */
  buffered: number;
  waiting: boolean;
  ended: boolean;
  hasStarted: boolean;
  activeTextTrack: null;
  error: string | null;
}
const initialState: ControlsState = {
  currentTime: 0,
  paused: true,
  fullscreen: false,
  fragment: null,
  playbackRate: 1,
  volume: 0.8,
  muted: false,
  autoplay: false,
  seeking: false,
  duration: null,
  userSeek: null,
  loop: false,
  buffered: 0,
  waiting: false,
  ended: false,
  hasStarted: false,
  activeTextTrack: null,
  error: null,
};

export const controlsSlice = createSlice({
  name: "controls",
  initialState,
  reducers: {
    setHash: (
      state,
      action: PayloadAction<{ hash: string; fromLink: boolean }>,
    ) => {
      const { hash, fromLink } = action.payload;
      const timeSpan = parseTF(hash),
        query = parseQS(hash),
        frag: ControlsState["fragment"] = timeSpan
          ? [timeSpan.start, timeSpan.end]
          : null;
      state.fragment = frag;
      state.loop = is(query, "loop");
      state.autoplay = is(query, "autoplay");
      state.muted = is(query, "muted");

      // start playing when timestamp is seeked to
      if (frag && isTimestamp(frag)) {
        if (fromLink) state.paused = false;
        state.currentTime = frag[0];
      }
    },
    handleLoopChange: (state, action: PayloadAction<boolean>) => {
      state.loop = action.payload;
    },
    handleAutoplayChange: (state, action: PayloadAction<boolean>) => {
      state.autoplay = action.payload;
    },
    setFragment: (state, action: PayloadAction<ControlsState["fragment"]>) => {
      const frag = action.payload;
      state.fragment = frag;

      // start playing when timestamp is seeked to
      if (frag && isTimestamp(frag)) state.paused = false;
    },
    reset: (state) => {
      Object.assign(state, initialState);
    },
    play: (state) => {
      state.paused = false;
    },
    pause: (state) => {
      state.paused = true;
    },
    togglePlay: (state) => {
      state.paused = !state.paused;
    },

    setFullscreen: (state, action: PayloadAction<boolean>) => {
      state.fullscreen = action.payload;
    },

    toggleFullscreen: (state) => {
      state.fullscreen = !state.fullscreen;
    },
    setPlaybackRate: (state, action: PayloadAction<number>) => {
      if (action.payload > 0) {
        state.playbackRate = action.payload;
      } else {
        state.playbackRate = 1;
      }
    },
    setMute: (state, action: PayloadAction<boolean>) => {
      state.muted = action.payload;
    },
    toggleMute: (state) => {
      state.muted = !state.muted;
    },
    setVolume: (state, action: PayloadAction<number>) => {
      setVolumeTo(action.payload, state);
    },
    setVolumeUnmute: (state, action: PayloadAction<number>) => {
      setVolumeTo(action.payload, state);
      state.muted = false;
    },
    setVolumeByOffest: (state, action: PayloadAction<number>) => {
      setVolumeTo(state.volume + action.payload / 100, state);
    },
    updateBasicInfo: (
      state,
      action: PayloadAction<{
        seeking: boolean;
        duration: number;
        buffered: number | null;
      }>,
    ) => {
      const { buffered, duration, seeking } = action.payload;
      if (buffered && buffered >= 0) {
        state.buffered = buffered;
      } else if (buffered !== null) {
        console.error("invaild buffered value", action.payload);
      }
      if (checkDuration(duration)) {
        state.duration = duration;
      }
      state.seeking = seeking;
    },
    handleTimeUpdate: (state, action: PayloadAction<number>) => {
      if (action.payload !== LARGE_CURRENT_TIME)
        state.currentTime = action.payload;
      if (state.duration === action.payload) {
        state.ended = true;
      }
    },
    handleFullscreenChange: (state, action: PayloadAction<boolean>) => {
      state.fullscreen = action.payload;
    },
    handleVolumeChange: (
      state,
      action: PayloadAction<{ volume: number; muted: boolean }>,
    ) => {
      setVolumeTo(action.payload.volume, state);
      state.muted = action.payload.muted;
    },
    handleDurationChange: (state, action: PayloadAction<number | null>) => {
      if (checkDuration(action.payload)) {
        state.duration = action.payload;
      } else {
        state.duration === null;
      }
    },
    revertDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload;
    },
    handleSeeking: (state) => {
      state.seeking = true;
    },
    handleSeeked: (state) => {
      state.seeking = false;
    },
    handlePlaying: (state) => {
      state.paused = false;
      state.ended = false;
      state.waiting = false;
      state.hasStarted = true;
    },
    handlePause: (state) => {
      state.paused = true;
    },
    handleRateChange: (state, action: PayloadAction<number>) => {
      state.playbackRate = action.payload;
    },
    handleProgress: (
      state,
      action: PayloadAction<{ buffered: number; duration: number }>,
    ) => {
      const { buffered, duration } = action.payload;
      if (buffered >= 0) {
        state.buffered = buffered;
      } else {
        console.error("invaild buffered value", action.payload);
      }
      if (checkDuration(duration)) {
        state.duration = duration;
      }
    },
    handleEnded: (state) => {
      state.ended = true;
    },
    handleWaiting: (state) => {
      state.waiting = true;
    },
    handleError: (
      state,
      action: PayloadAction<{ message: string; code?: number }>,
    ) => {
      state.error = `${action.payload.message} (${action.payload.code})`;
    },
    progressBarSeek: (state, action: PayloadAction<number>) => {
      if (state.userSeek?.source === "manual") return;
      const source: UserSeekSource = "progress-bar";
      let time = action.payload;
      time = clampTime(time, state.duration);

      if (state.userSeek?.source === source) {
        // only update seek time
        state.userSeek.currentTime = time;
      } else {
        // new seek action or override existing seek action
        state.userSeek = {
          initialTime: time,
          currentTime: time,
          source,
          ...noPause(state, true),
        };
      }
    },
    progressBarSeekEnd: (state) => {
      if (state.userSeek?.source === "manual") return;
      handleUserSeekEnd(state);
    },
    dragSeek: (state, action: PayloadAction<number>) => {
      const source = "drag";
      if (!state.userSeek) {
        // new seek action
        let time = state.currentTime;
        state.userSeek = {
          initialTime: time,
          currentTime: time,
          source,
          ...noPause(state, false),
        };
      } else if (state.userSeek.source === "drag") {
        const forwardSeconds = action.payload;
        const { initialTime } = state.userSeek,
          { duration } = state;
        state.userSeek.currentTime = clampTime(
          forwardSeconds + initialTime,
          duration,
        );
      }
    },
    dragSeekEnd: (state) => {
      if (
        state.userSeek &&
        ["progress-bar", "manual"].includes(state.userSeek.source)
      )
        return;
      handleUserSeekEnd(state);
    },
    requestManualSeek: (state, action: PayloadAction<number>) => {
      const source: UserSeekSource = "manual";
      let time = action.payload;
      time = clampTime(time, state.duration);
      state.userSeek = {
        initialTime: time,
        currentTime: time,
        source,
        ...noPause(state, true),
      };
    },
    requestManualOffsetSeek: (state, action: PayloadAction<number>) => {
      const source: UserSeekSource = "manual";
      const offset = action.payload;
      state.userSeek = {
        initialTime: state.currentTime,
        currentTime: clampTime(offset + state.currentTime, state.duration),
        source,
        ...noPause(state, true),
      };
    },
    manualSeekDone: (state) => {
      // highest priority, no check for source
      handleUserSeekEnd(state);
    },
  },
});

const clampTime = (time: number, duration: number | null) => {
  if (duration && time > duration) {
    time = duration;
  } else if (time < 0) {
    time = 0;
  }
  return time;
};

const noPause = (state: ControlsState, noPause: boolean) => {
  if (!noPause) {
    state.paused = true;
  }
  return { pausedBeforeSeek: noPause ? null : state.paused };
};

const handleUserSeekEnd = (state: ControlsState) => {
  if (!state.userSeek) return;
  if (state.userSeek.pausedBeforeSeek !== null) {
    state.paused = state.userSeek.pausedBeforeSeek;
  }
  // apply currentTime immediately to avoid latency from onTimeUpdate
  state.currentTime = state.userSeek.currentTime;
  state.userSeek = null;
};

const setVolumeTo = (newVolume: number, state: ControlsState) => {
  if (newVolume < 0) {
    state.volume = 0;
  } else if (newVolume > 1) {
    state.volume = 1;
  } else {
    state.volume = newVolume;
  }
};

const checkDuration = (duration: unknown): duration is number =>
  typeof duration === "number" && !!duration && duration > 0;
