import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store'

interface VideoControlsState {
  mic_on: boolean
  video_on: boolean
}

export const videoControlsSlice = createSlice({
  name: 'videoControls',
  initialState: <VideoControlsState>{
    mic_on: true,
    video_on: true,
  },
  reducers: {
    toggleMicStatus: (state) => {
      state.mic_on = !state.mic_on;
    },
    toggleVideoStatus: (state) => {
      state.video_on = !state.video_on;
    },
  }
})

export const { toggleMicStatus, toggleVideoStatus } = videoControlsSlice.actions;

export const selectMicStatus = (state: RootState) => state.videoControls.mic_on;
export const selectVideoStatus = (state: RootState) => state.videoControls.video_on;


export default videoControlsSlice.reducer;

