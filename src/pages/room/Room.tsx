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
import { useEffect } from 'react';
import { io } from "socket.io-client";
import { useContext, useState } from 'react';
import { WebsocketContext } from '../../contexts/WebsocketContext';
import { setStream, selectStream } from '../../features/videoStreamSlice';
import VideoPlayer from '../../components/video-player/VideoPlayer';

const constraints = {
  video: true,
  audio: true,
}

const servers = {
  iceServers:[
      {
          urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
      }
  ]
}

interface StreamType {
  getTracks: Function
  getVideoTracks: Function
}

interface RemoteStreamType {
  addTrack: Function
}

interface PeerConnectionType {
  addTrack: Function
  createOffer: Function
  setLocalDescription: Function
  addIceCandidate: Function
  ontrack: Function
  onicecandidate: Function
}

export default function Room({}) {
  const [searchParams] = useSearchParams();
  const room = searchParams.get('room');
  const today = new Date();
  const date = format(today, 'MMM dd');
  const time = format(today, 'p');
  const [roomUsers, setRoomUsers] = useState({ user1: null, user2: null });
  const [peerConnection, setPeerConnection] = useState<PeerConnectionType>();
  const [remoteStream, setRemoteStream] = useState<RemoteStreamType>();

  // redux
  const micStatus = useAppSelector(selectMicStatus)
  const videoStatus = useAppSelector(selectVideoStatus)
  const stream = useAppSelector(selectStream)
  const dispatch = useAppDispatch()

  
  // handle messaging with socket io
  const socket = useContext(WebsocketContext);
  useEffect(() => {
    console.log({socket})
    socket.on('connect', () => {
      console.log('Connected!');
    });
    socket.emit("join_custom_room", JSON.stringify({ name: room }))

    socket.on("join_message", (message) => {
      const joinMessageResponse = JSON.parse(message)
      console.log('join_message: ', joinMessageResponse.message)
    })
    
    // only first user should see this event
    socket.on('new_user_event', (message) => {
      // check if this is the second user
      const newUserEventResponse = JSON.parse(message)
      const { capacity: roomCapacity, message: joinMessage, socketIds } = newUserEventResponse
      console.log('new_user_event: ', { roomCapacity, joinMessage, socketIds })
      if (roomCapacity === 2) {
        setRoomUsers({ user1: socketIds[0], user2: socketIds[1] })
        // createOffer()
        // socket.emit("send_custom_room", JSON.stringify({ name: room,  }))
      }
    })
    socket.on('custom_message', (message) => {
      console.log({message})
      const customMessageResponse = JSON.parse(message);
      console.log('custom_message: ', {customMessageResponse})
      const { type, candidate, offer, answer } = customMessageResponse

      if(type === 'offer'){
        // createAnswer(MemberId, offer)
      }
  
      if(type === 'answer'){
        // addAnswer(answer)
      }
  
      if(type === 'candidate'){
        // if(peerConnection){
          peerConnection?.addIceCandidate(candidate)
        // }
      }
    })
    return () => {
      console.log('Unregistering Events...');
      socket.off('connect');
      socket.off('onMessage');
    };
  }, []);

  useEffect(() => {
    if (roomUsers.user2) {
      createOffer()
    }
  }, [roomUsers])


  // handle local stream
  useEffect(() => {
    if (!stream) {
      createNewStream()
    } else {
      addStream('main-user', stream)
    }
  }, [])

  const addStream = (videoElementId: string, videoStream: StreamType) => {
    const videoElement = document.getElementById(videoElementId) as any;
    if (videoElement) {
      videoElement.srcObject = videoStream;
    }
    return videoElement
  }

  const createNewStream = async () => {
    await navigator.mediaDevices.getUserMedia(constraints).then((waitingStream) => {
      const videoElement = addStream('main-user', waitingStream)
      if (videoElement) {
        console.log(typeof waitingStream)
        dispatch(setStream(waitingStream));
      }
    }).catch(e => {
      console.log(e)
      // setDeviceNotFound(true)
    })
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
          createNewStream()
        }
        dispatch(toggleVideoStatus())
        break;
    }
  }


  // handle WebRTC connection
  const createPeerConnection = async (MemberId: string|null) => {
    console.log('here')
    const pc = new RTCPeerConnection(servers) as any
    setPeerConnection(pc)

    setRemoteStream(new MediaStream() as any)
    const guestUserVideo = document.getElementById('guest-user') as any
    if (guestUserVideo) {
      guestUserVideo.srcObject = remoteStream
    }
    // document.getElementById('guest-user').style.display = 'block'
    // document.getElementById('main-user').classList.add('smallFrame')


    if(!stream){
      await createNewStream()
    }

    stream?.getTracks().forEach((track: any) => {
        peerConnection?.addTrack(track, stream)
    })
    
    if (!peerConnection) return
    peerConnection.ontrack = (event: any) => {
      event.streams[0].getTracks().forEach((track: any) => {
        remoteStream?.addTrack(track)
      })
    }

    peerConnection.onicecandidate = async (event: any) => {
      if (event.candidate) {
        const payload = JSON.stringify({ name: MemberId, message: { type: 'candidate', candidate: event.candidate } })
        socket.emit("send_custom_room", payload)
      }
    }
}

  const createOffer = async () => {
    console.log('createOffer')
    await createPeerConnection(roomUsers.user2)

    let offer = await peerConnection?.createOffer()
    await peerConnection?.setLocalDescription(offer)

    const payload = JSON.stringify({ name: roomUsers.user2, message: { type: 'offer', offer } })
    socket.emit("send_custom_room", payload)
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
