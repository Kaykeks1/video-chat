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
import { useContext, useState, useRef } from 'react';
import { WebsocketContext } from '../../contexts/WebsocketContext';
import { setStream, selectStream, updateStreamTracks } from '../../features/videoStreamSlice';
import VideoPlayer from '../../components/video-player/VideoPlayer';
import { useNavigate } from 'react-router-dom';

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
  getTracks: Function
}

interface PeerConnectionType {
  addTrack: Function
  createOffer: Function
  setLocalDescription: Function
  addIceCandidate: Function
  ontrack: Function
  onicecandidate: Function
  setRemoteDescription: Function
  createAnswer: Function
  currentRemoteDescription: Function
  createDataChannel: Function
  ondatachannel: Function
  channel: any
  removeTrack: Function
  getSenders: Function
  close: Function
  remoteDescription: any
}

export default function Room({}) {
  const [searchParams] = useSearchParams();
  const room = searchParams.get('room');
  const today = new Date();
  const date = format(today, 'MMM dd');
  const time = format(today, 'p');
  const [roomUsers, setRoomUsers] = useState([]);
  const [peerConnection, setPeerConnection] = useState<PeerConnectionType>();
  const [remoteStream, setRemoteStream] = useState<RemoteStreamType>();
  const [offer, setOffer] = useState();
  let navigate = useNavigate();

  // redux
  const micStatus = useAppSelector(selectMicStatus)
  const videoStatus = useAppSelector(selectVideoStatus)
  const stream = useAppSelector(selectStream)
  const dispatch = useAppDispatch()
  
  // handle messaging with socket io
  const socket = useContext(WebsocketContext);
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected!');
    });
    socket.emit("join_custom_room", JSON.stringify({ name: room }))

    socket.on("join_message", (message) => {
      const joinMessageResponse = JSON.parse(message)
    })
    
    // both user should see this event
    socket.on('new_user_event', (message) => {
      // check if this is the second user
      const newUserEventResponse = JSON.parse(message)
      const { capacity: roomCapacity, message: joinMessage, socketIds } = newUserEventResponse
      if (roomCapacity === 2) {
        setRoomUsers(socketIds)
      }
    })
    socket.on('user_left_event', (message) => {
      setRoomUsers([])
    })
    return () => {
      socket.emit("leave_custom_room", JSON.stringify({ name: room }));
    };
  }, []);

  window.addEventListener('beforeunload', () => {
    socket.emit("leave_custom_room", JSON.stringify({ name: room }));
  })

  // User 1 creates offer
  useEffect(() => {
    // if a user 2 has joined and then only create offer for uesr 1
    if (roomUsers[1] && roomUsers[0] === socket.id) {  // createOffer
      const pc = new RTCPeerConnection(servers) as any
      setPeerConnection(pc)
      setRemoteStream(new MediaStream() as any)
    }
  }, [roomUsers])

  // User 2 creates answer
  useEffect(() => {
    if (offer && roomUsers.length === 2 && roomUsers[1] === socket.id) { // createAnswer
      const pc = new RTCPeerConnection(servers) as any
      setPeerConnection(pc)
      setRemoteStream(new MediaStream() as any)
    }
  }, [roomUsers, offer])

  useEffect(() => {
    socket.on('custom_message', (message) => {
      const customMessageResponse = message;
      const { type, candidate, offer: offer_, answer } = customMessageResponse

      if(type === 'offer'){
        console.log('receive offer')
        setOffer(offer_)
      }
  
      if(type === 'answer'){
        console.log('receive answer')
        addAnswer(answer)
      }
  
      if(type === 'candidate'){
        if(peerConnection){
          peerConnection.addIceCandidate(candidate, onAddIceCandidateSuccess, onAddIceCandidateFailure)
        }
      }
    })
  }, [peerConnection])

  useEffect(() => {
    if (peerConnection?.remoteDescription) return // already finished connection
    if (peerConnection && remoteStream && stream) {
      if (roomUsers[1] && roomUsers[0] === socket.id) {
        createOffer()
      } else if (offer && roomUsers.length === 2 && roomUsers[1] === socket.id) {
        createAnswer(offer)
      }
    }
  }, [peerConnection, remoteStream, stream])


  // handle local stream
  useEffect(() => {
    if (!stream) {
      createNewStream()
    } else {
      addStream('main-user', stream)
    }
  }, [])

  useEffect(() => {
    if (peerConnection?.remoteDescription) return // already finished connection
    if (stream) {
      stream.getTracks().forEach((track: any) => {
        const sender = peerConnection?.addTrack(track, stream)
      })
    }
    if (peerConnection) {
      peerConnection.ontrack = (event: any) => {
        event.streams[0].getTracks().forEach((track: any) => {
          remoteStream?.addTrack(track)
        })
      }
      peerConnection.onicecandidate = async (event: any) => {
        if (event.candidate) {
          // const payload = JSON.stringify({ name: MemberId, message: { type: 'candidate', candidate: event.candidate } })
          const MemberId = (roomUsers[1] && roomUsers[0] === socket.id)
           ? roomUsers[1]
           : roomUsers[0]
          const payload = { name: MemberId, message: { type: 'candidate', candidate: event.candidate } }
          socket.emit("send_custom_room", payload)
        }
      }
    }
  }, [stream, peerConnection])

  const addStream = (videoElementId: string, videoStream: StreamType) => {
    const videoElement = document.getElementById(videoElementId) as any;
    if (videoElement) {
      videoElement.srcObject = videoStream;
    }
    return videoElement
  }

  const createNewStream = async (video = constraints.video, audio = constraints.audio) => {
    await navigator.mediaDevices.getUserMedia({...constraints, video, audio}).then((waitingStream) => {
      const videoElement = addStream('main-user', waitingStream)
      if (videoElement) {
        dispatch(setStream(waitingStream));
      }
    }).catch(e => {
      console.log(e)
      // setDeviceNotFound(true)
    })
  }

  const replaceTracks = async (video = constraints.video, audio = constraints.audio) => {
    // detach media
    let elem = document.getElementById('main-user') as any;
    if (elem) {
      elem.pause();

      if (typeof elem.srcObject === 'object') {
        elem.srcObject = null;
      } else {
        elem.src = '';
      }
    }
    const newStream = await navigator.mediaDevices.getUserMedia({...constraints, video, audio})
    dispatch(updateStreamTracks(newStream));

    // attach media
    if (elem) {
      elem.srcObject = newStream;

      elem.onloadedmetadata = function (e:any) {
        elem.play();
      };
    } else {
      throw new Error('Unable to attach media stream');
    }

    peerConnection?.getSenders().map(function (sender:any) {
      sender.replaceTrack(newStream?.getTracks().find(function (track:any) {
        return track.kind === sender.track.kind;
      }));
    });
  }

  const toggleCameraControls = async (control: string) => {
    if (!stream) return
    let track
    if (control === 'audio' || control === 'video') {
      track = stream.getTracks().find((track: any) => track.kind === control)
      if (!track) return
    }
    switch(control) {
      case 'audio':
        track.enabled = !micStatus
        dispatch(toggleMicStatus())
        break;
      case 'video':
        track.enabled = !videoStatus
        dispatch(toggleVideoStatus())
        break;
      case 'leave':
        peerConnection?.close()
        navigate(`/`)
        break;
    }
  }


  // handle WebRTC connection
  const usingPeerConnection = async (MemberId: string|null) => {
    const guestUserVideo = document.getElementById('guest-user') as any
    if (guestUserVideo) {
      guestUserVideo.srcObject = remoteStream
    }
    if(!stream){
      createNewStream()
    }
}

  const createOffer = async () => {
    await usingPeerConnection(roomUsers[1])
    const sendChannel = peerConnection?.createDataChannel("sendChannel");

    let offer = await peerConnection?.createOffer()
    await peerConnection?.setLocalDescription(offer)

    const payload = { name: roomUsers[1], message: { type: 'offer', offer } }
    socket.emit("send_custom_room", payload)
  }

  const createAnswer = async (offer: any) => {
    await usingPeerConnection(roomUsers[0])
    if (!peerConnection) return
    peerConnection.ondatachannel = (e:any) => {
      const receiveChannel = e.channel;
      peerConnection.channel = receiveChannel;
    }

    await peerConnection?.setRemoteDescription(offer)

    let answer = await peerConnection?.createAnswer()
    await peerConnection?.setLocalDescription(answer)

    const payload = { name: roomUsers[0], message: { type: 'answer', answer } }
    socket.emit("send_custom_room", payload)
  }

  const addAnswer = async (answer: object) => {
    if(!peerConnection?.currentRemoteDescription){
      await peerConnection?.setRemoteDescription(answer)
    }
  }

  const onAddIceCandidateSuccess = () => {
    console.log('Success adding ICE candidate');
  };

  const onAddIceCandidateFailure = () => {
    console.log('Failure adding ICE candidate');
  };

  // const leaveChannel = async () => {
  //   await channel.leave()
  //   await client.logout()
  // }

  return (
    <div className='chat-room'>
      <div className='room-header'>
        <h1>{room}</h1>
      </div>
      <div id="videos" className='videos'>
        <video className="video-player" muted id="main-user" autoPlay playsInline></video>
        {
          roomUsers.length
          ? <video className="video-player" id="guest-user" autoPlay playsInline></video>
          : <div className="no-video">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 18" fill="none">
              <path d="M8 0.75C5.92893 0.75 4.25 2.42893 4.25 4.5C4.25 6.57107 5.92893 8.25 8 8.25C10.0711 8.25 11.75 6.57107 11.75 4.5C11.75 2.42893 10.0711 0.75 8 0.75Z" fill="white"/>
              <path d="M4 10.25C1.92893 10.25 0.25 11.9289 0.25 14V15.1883C0.25 15.9415 0.795884 16.5837 1.53927 16.7051C5.8181 17.4037 10.1819 17.4037 14.4607 16.7051C15.2041 16.5837 15.75 15.9415 15.75 15.1883V14C15.75 11.9289 14.0711 10.25 12 10.25H11.6591C11.4746 10.25 11.2913 10.2792 11.1159 10.3364L10.2504 10.6191C8.78813 11.0965 7.21187 11.0965 5.74959 10.6191L4.88407 10.3364C4.70869 10.2792 4.52536 10.25 4.34087 10.25H4Z" fill="white"/>
            </svg>
            <p>Waiting for a user...</p>
          </div>
        }
      </div>
      <div className='room-footer'>
        <p>{time} <span>|</span> {date}</p>
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
        <div className='open-chat'>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M0.25 10.2145C0.25 6.24636 4.05525 3.25 8.45161 3.25C11.9502 3.25 15.0521 5.13375 16.1918 7.89933C16.243 8.02337 16.154 8.15792 16.0203 8.16898C15.648 8.19978 15.2782 8.25265 14.9138 8.32662C14.8207 8.34551 14.7269 8.29807 14.6853 8.2127C13.7216 6.23442 11.3546 4.75 8.45161 4.75C4.61715 4.75 1.75 7.31827 1.75 10.2145C1.75 11.7791 2.56392 13.224 3.9325 14.2455C4.12216 14.3871 4.23387 14.6099 4.23387 14.8465V15.7873L5.78151 15.357C5.9163 15.3196 6.05888 15.3205 6.19314 15.3598C6.80385 15.5387 7.45668 15.6474 8.13752 15.673C8.24556 15.6771 8.33258 15.764 8.33726 15.8721C8.35581 16.3 8.41311 16.7133 8.50538 17.1107C8.51344 17.1454 8.48728 17.1788 8.45161 17.1789C7.59258 17.1789 6.76262 17.0669 5.98177 16.8582L3.68475 17.4968C3.45891 17.5596 3.21671 17.5132 3.03009 17.3713C2.84346 17.2295 2.73387 17.0086 2.73387 16.7742V15.211C1.22401 13.9648 0.25 12.2016 0.25 10.2145Z" fill="white"/>
            <path d="M6.85486 8.25806C6.85486 8.84597 6.37826 9.32257 5.79035 9.32257C5.20243 9.32257 4.72583 8.84597 4.72583 8.25806C4.72583 7.67014 5.20243 7.19354 5.79035 7.19354C6.37826 7.19354 6.85486 7.67014 6.85486 8.25806Z" fill="white"/>
            <path d="M11.1129 9.32257C11.7008 9.32257 12.1774 8.84597 12.1774 8.25806C12.1774 7.67014 11.7008 7.19354 11.1129 7.19354C10.525 7.19354 10.0484 7.67014 10.0484 8.25806C10.0484 8.84597 10.525 9.32257 11.1129 9.32257Z" fill="white"/>
            <path d="M14.5459 15.1774C15.0604 15.1774 15.4774 14.7604 15.4774 14.246C15.4774 13.7315 15.0604 13.3145 14.5459 13.3145C14.0315 13.3145 13.6145 13.7315 13.6145 14.246C13.6145 14.7604 14.0315 15.1774 14.5459 15.1774Z" fill="white"/>
            <path d="M20.0016 14.246C20.0016 14.7604 19.5846 15.1774 19.0702 15.1774C18.5557 15.1774 18.1387 14.7604 18.1387 14.246C18.1387 13.7315 18.5557 13.3145 19.0702 13.3145C19.5846 13.3145 20.0016 13.7315 20.0016 14.246Z" fill="white"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M16.7856 9.85853C20.496 9.85853 23.7452 12.3912 23.7452 15.7873C23.7452 17.4662 22.9366 18.7319 21.6801 19.7881V21.0322C21.6801 21.2666 21.5705 21.4876 21.3839 21.6294C21.1972 21.7712 20.955 21.8176 20.7292 21.7548L18.8477 21.2318C18.1961 21.4029 17.5049 21.4945 16.7903 21.4945C13.0798 21.4945 9.83063 18.9619 9.83063 15.5658C9.83063 12.1697 13.0751 9.85853 16.7856 9.85853ZM22.25 15.5658C22.25 13.2416 19.9389 11.1371 16.7903 11.1371C13.6417 11.1371 11.3306 13.2416 11.3306 15.5658C11.3306 17.89 13.6417 19.9945 16.7903 19.9945C17.4405 19.9945 18.062 19.9021 18.6372 19.7337C18.7715 19.6943 18.9141 19.6934 19.0489 19.7308L20.1801 20.0453V19.4259C20.1801 19.1892 20.2918 18.9664 20.4815 18.8248C21.596 17.9929 22.25 16.8237 22.25 15.5658Z" fill="white"/>
          </svg>
          <p>Chat</p>
        </div>
      </div>
    </div>
  )
}
