import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store'

interface StreamType {
  getTracks: Function
  getVideoTracks: Function
}

interface VideoStreamState {
  stream: StreamType | null
}

export const videoStreamSlice = createSlice({
  name: 'videoStream',
  initialState: <VideoStreamState>{
    stream: null,
  },
  reducers: {
    setStream: (state, action: PayloadAction<StreamType>) => {
      state.stream = action.payload;
    },
  }
})

export const { setStream } = videoStreamSlice.actions;

export const selectStream = (state: RootState) => state.videoStream.stream;


export default videoStreamSlice.reducer;

