import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store'

interface StreamType {
  getTracks: Function
  getVideoTracks: Function
  addTrack: Function
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
    updateStreamTracks: (state, action: PayloadAction<StreamType>) => {
      action.payload.getTracks().forEach(function (track: any) {
        state.stream?.addTrack(track);
      });
    },
  }
})

export const { setStream, updateStreamTracks } = videoStreamSlice.actions;

export const selectStream = (state: RootState) => state.videoStream.stream;


export default videoStreamSlice.reducer;

