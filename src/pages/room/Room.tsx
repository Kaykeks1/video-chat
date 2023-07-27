import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import './Room.css';
import mic_off from '../../images/svg-icons/mic_off.svg';
import mic_on from '../../images/svg-icons/mic_on.svg';
import video_off from '../../images/svg-icons/video_off.svg';
import video_on from '../../images/svg-icons/video_on.svg';
import call_end from '../../images/svg-icons/call_end.svg';
import VideoControl from '../../components/video-control/VideoControl';
import { useAppSelector, useAppDispatch } from '../../hooks'
import { toggleMicStatus, toggleVideoStatus, selectMicStatus, selectVideoStatus } from '../../features/videoControlsSlice'


export default function Room({}) {
  const [searchParams] = useSearchParams();
  const room = searchParams.get('room');
  const today = new Date();
  const date = format(today, 'MMM dd');
  const time = format(today, 'p');

  // redux
  const micStatus = useAppSelector(selectMicStatus)
  const videoStatus = useAppSelector(selectVideoStatus)
  const dispatch = useAppDispatch()

  const toggleCameraControls = (control: string) => {
    console.log(control)
    switch(control) {
      case 'audio':
        dispatch(toggleMicStatus())
        break;
      case 'video':
        dispatch(toggleVideoStatus())
        break;
    }
  }

  return (
    <div className='chat-room'>
      <div className='room-header'>
        <h1>{room}</h1>
      </div>
      <div id="videos" className='videos'>
        <video className="video-player" muted id="main-user" autoPlay playsInline></video>
        <video className="video-player" id="guest-user" autoPlay playsInline></video>
      </div>
      <div className='room-footer'>
        <p>{time} | {date}</p>
        <div className='controls'>
          <VideoControl
            handleClick={() => toggleCameraControls('audio')}
            icon={micStatus ? mic_on : mic_off}
            off={!micStatus}
          />
          <VideoControl
            handleClick={() => toggleCameraControls('video')}
            icon={videoStatus ? video_on : video_off}
            off={!videoStatus}
          />
          <VideoControl
            handleClick={() => toggleCameraControls('leave')}
            icon={call_end}
            off
          />
        </div>
        <div>chat</div>
      </div>
    </div>
  )
}
