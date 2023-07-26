import './App.css';
import video_chat from './images/video_chat.svg';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mic_off from './images/svg-icons/mic_off.svg';
import mic_on from './images/svg-icons/mic_on.svg';
import video_off from './images/svg-icons/video_off.svg';
import video_on from './images/svg-icons/video_on.svg';

interface StreamType {
  getTracks: Function
  getVideoTracks: Function
}

function App() {
  const today = new Date();
  const date = format(today, 'MMM dd');
  const time = format(today, 'p');
  const [form, setForm] = useState({ name: '' });
  const [cameraControls, setCameraControls] = useState({ audioOn: true, videoOn: true });
  const [stream, setStream] = useState<StreamType>();
  let navigate = useNavigate();


  let constraints = {
      // video: {
      //     width:{min:640, ideal:1920, max:1920},
      //     height:{min:480, ideal:1080, max:1080},
      // },
      video: true,
      audio: true,
  }
  useEffect(() => {
    console.log('render')
    createStream()
  }, [])

  const createStream = () => {
    navigator.mediaDevices.getUserMedia(constraints).then((waitingStream) => {
      const x = document.getElementById('waiting-video') as any;
      if (x) {
        x.srcObject = waitingStream;
        console.log(typeof waitingStream)
        setStream(waitingStream);
      }
    })
  }

  const joinRoom = (e: any) => {
    e.preventDefault();
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
        track.enabled = !cameraControls.audioOn
        setCameraControls({ ...cameraControls, audioOn: !cameraControls.audioOn })
        break;
      case 'video':
        track.enabled = !cameraControls.videoOn
        if (cameraControls.videoOn) {
          track.stop()
        } else {
          createStream()
        }
        setCameraControls({ ...cameraControls, videoOn: !cameraControls.videoOn })
        break;
    }
  }

  return (
    <div className="app">
      <div className='waiting-room'>
        <div className='header'>
          <div className='header-left'>
            <img src={video_chat} className='header-icon' />
            <h1 className='header-title'>CHAT</h1>
          </div>
          <div>{time} | {date}</div>
        </div>
        <div className='waiting-container'>
          {/* create schedule */}
          <div className='schedule'>
            <h1>Upcoming meeting</h1>
          </div>
          {/* camera view */}
          <div className='camera'>
            <video className="waiting-video" id="waiting-video" autoPlay playsInline></video>
            <div className='waiting-video-controls'>
              <div className='control mic' onClick={() => toggleCameraControls('audio')}>
                <div className='control-container'>
                  <div className='fore-ground-hover' />
                  {
                    cameraControls.audioOn
                    ? <img src={mic_on} />
                    : <img src={mic_off} />
                  }
                </div>
              </div>
              <div className='control video' onClick={() => toggleCameraControls('video')}>
                <div className='control-container'>
                  <div className='fore-ground-hover' />
                  {
                    cameraControls.videoOn
                    ? <img src={video_on} />
                    : <img src={video_off} />
                  }
                </div>
              </div>
            </div>
          </div>
          {/* create/join meeting */}
          <div className='join-meeting'>
            <h1>Create or Join a meeting</h1>
            <form className='join-form' onSubmit={joinRoom}>
              <input
                type="text"
                name="invite_link"
                placeholder="E.g chat-room-123?"
                required
                value={form.name}
                onChange={handleNameChange}
              />
              <input type="submit" value="Join" />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
