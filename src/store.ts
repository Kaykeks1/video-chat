import { configureStore } from '@reduxjs/toolkit'
import videoControlsReducer from './features/videoControlsSlice'

const store = configureStore({
  reducer: {
    videoControls: videoControlsReducer,
  },
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch

export default store