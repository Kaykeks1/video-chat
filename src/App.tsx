import './App.css';
import video_chat from './images/video_chat.svg';
import { format } from 'date-fns';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mic_off from './images/svg-icons/mic_off.svg';
import mic_on from './images/svg-icons/mic_on.svg';
import video_off from './images/svg-icons/video_off.svg';
import video_on from './images/svg-icons/video_on.svg';
import VideoControl from './components/video-control/VideoControl';
import { useAppSelector, useAppDispatch } from './hooks'
import { toggleMicStatus, toggleVideoStatus, selectMicStatus, selectVideoStatus } from './features/videoControlsSlice'
import { setStream, selectStream } from './features/videoStreamSlice'
import VideoPlayer from './components/video-player/VideoPlayer';

interface StreamType {
  getTracks: Function
  getVideoTracks: Function
}

function App() {
  const today = new Date();
  const date = format(today, 'MMM dd');
  const time = format(today, 'p');
  const [form, setForm] = useState({ name: '' });
  const [showWarning, setShowWarning] = useState(false);
  const [deviceNotFound, setDeviceNotFound] = useState(false);
  let navigate = useNavigate();

  // redux
  const micStatus = useAppSelector(selectMicStatus)
  const videoStatus = useAppSelector(selectVideoStatus)
  const stream = useAppSelector(selectStream)
  const dispatch = useAppDispatch()

  let constraints = {
    // video: {
    //     width:{min:640, ideal:1920, max:1920},
    //     height:{min:480, ideal:1080, max:1080},
    // },
    video: true,
    audio: true,
  }
  useEffect(() => {
    if (!stream) {
      createStream()
    } else {
      addStream('waiting-video', stream)
    }
  }, [])

  const createStream = () => {
    navigator.mediaDevices.getUserMedia(constraints).then((waitingStream) => {
      const videoElement = addStream('waiting-video', waitingStream)
      if (videoElement) {
        dispatch(setStream(waitingStream));
      }
    }).catch(e => {
      console.log(e)
      setDeviceNotFound(true)
    })
  }

  const addStream = (videoElementId: string, videoStream: StreamType) => {
    const videoElement = document.getElementById(videoElementId) as any;
    if (videoElement) {
      videoElement.srcObject = videoStream;
    }
    return videoElement
  }

  const joinRoom = (e: any) => {
    e.preventDefault();
    if (!videoStatus) {
      setShowWarning(true)
      return
    }
    const roomName = form.name;
    navigate(`/chat-room?room=${roomName}`)
  }

  const handleNameChange = (event: any) => {
    setForm({ name: event.target.value})
  }

  const toggleCameraControls = (control: string) => {
    if (!stream) return
    let track = stream.getTracks().find((track: any) => track.kind === control)
    if (!track) return
    switch(control) {
      case 'audio':
        track.enabled = !micStatus
        dispatch(toggleMicStatus())
        break;
      case 'video':
        track.enabled = !videoStatus
        if (videoStatus) {
          track.stop()
        } else {
          setShowWarning(false)
          createStream()
        }
        dispatch(toggleVideoStatus())
        break;
    }
  }

  return (
    <div className="app">
      <div className='waiting-room'>
        <div className="overlay"></div>
        <div className='header'>
          <div className='header-left'>
            <img src={video_chat} className='header-icon' />
            <h1 className='header-title'>Peer Chat</h1>
          </div>
          <p className='app-date'>{time} <span>|</span> {date}</p>
        </div>
        <div className='waiting-container'>
          {/* side content */}
          <div className='side-content'>
            <div>
              <h1>Join a friend & chat</h1>
              <p>Peer chat is a real time peer-to-peer communication software that lets you connect and chat with anyone from anywhere.</p>
            </div>
          </div>

          {/* camera view */}
          <div className='camera'>
            <VideoPlayer deviceNotFound={deviceNotFound} />
            <div className='waiting-video-controls'>
              <VideoControl
                handleClick={() => toggleCameraControls('audio')}
                icon={micStatus ? mic_on : mic_off}
                hasHover
              />
              <VideoControl
                handleClick={() => toggleCameraControls('video')}
                icon={videoStatus ? video_on : video_off}
                hasHover
              />
            </div>
          </div>

          {/* create/join meeting */}
          <div className='join-meeting'>
            <h1>Enter room name :</h1>
            <form className='join-form' onSubmit={joinRoom}>
              <input
                type="text"
                name="invite_link"
                placeholder="E.g chat-room-123?"
                required
                value={form.name}
                onChange={handleNameChange}
              />
              {
                showWarning && <p className='warning'>Turn on camera</p>
              }
              <input type="submit" value="Join" />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
