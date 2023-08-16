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
      console.log('join_message: ', joinMessageResponse.message)
    })
    
    // both user should see this event
    socket.on('new_user_event', (message) => {
      // check if this is the second user
      const newUserEventResponse = JSON.parse(message)
      const { capacity: roomCapacity, message: joinMessage, socketIds } = newUserEventResponse
      console.log('new_user_event: ', { roomCapacity, joinMessage, socketIds })
      if (roomCapacity === 2) {
        setRoomUsers(socketIds)
      }
    })
    return () => {
      socket.emit("leave_custom_room", JSON.stringify({ name: room }));
      console.log('leave (unmount)');
      // console.log('Unregistering Events...');
      // socket.off('connect');
      // socket.off('onMessage');
    };
  }, []);

  window.addEventListener('beforeunload', () => {
    // stream?.getTracks().forEach((track: any) => {
    //   if (track.kind === 'audio') {
    //     track.enabled = false
    //   } else {
    //     track.enabled = false
    //     track.stop()
    //   }
    // })
    socket.emit("leave_custom_room", JSON.stringify({ name: room }));
    console.log('leave (beforeunload)')
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
        console.log({track})
        const sender = peerConnection?.addTrack(track, stream)
        // setTrackSender(sender)
      })
    }
    if (peerConnection) {
      peerConnection.ontrack = (event: any) => {
        console.log({event})
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
    // console.log({track})
    // if (!track) {
    //   const a = control === 'audio' ? true : micStatus;
    //   const v = control === 'video' ? true : videoStatus;
    //   console.log({control, a, v})
    //   createNewStream(v, a)
    //   if (control === 'audio') {
    //     dispatch(toggleMicStatus())
    //   } else {
    //     dispatch(toggleVideoStatus())
    //   }
    //   return;
    // }
    switch(control) {
      case 'audio':
        track.enabled = !micStatus
        dispatch(toggleMicStatus())
        break;
      case 'video':
        track.enabled = !videoStatus
        dispatch(toggleVideoStatus())
        break
        if (videoStatus) {
          track.stop() // <- stopping the track causes the remote stream to freeze frame
          createNewStream(false)
          // replaceTracks(false)
        } else {
          createNewStream(true)
          // replaceTracks(true)
        }
        // dispatch(toggleVideoStatus())
        // break;
      case 'leave':
        stream.getTracks().forEach((track: any) => {
          track.enabled = false
          track.stop()
        })
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
    sendChannel.onmessage = (e:any) =>  console.log("messsage received!!!"  + e.data )
    sendChannel.onopen = (e:any) => console.log("open!!!!");
    sendChannel.onclose = (e:any) => console.log("closed!!!!!!");

    console.log('createOffer')
    let offer = await peerConnection?.createOffer()
    await peerConnection?.setLocalDescription(offer)

    // const payload = JSON.stringify({ name: roomUsers[1], message: { type: 'offer', offer } })
    const payload = { name: roomUsers[1], message: { type: 'offer', offer } }
    socket.emit("send_custom_room", payload)
  }

  const createAnswer = async (offer: any) => {
    await usingPeerConnection(roomUsers[0])
    if (!peerConnection) return
    peerConnection.ondatachannel = (e:any) => {
      const receiveChannel = e.channel;
      receiveChannel.onmessage = (e:any) =>  console.log("messsage received!!!"  + e.data )
      receiveChannel.onopen = (e:any) => console.log("open!!!!");
      receiveChannel.onclose = (e:any) => console.log("closed!!!!!!");
      peerConnection.channel = receiveChannel;
    }

    await peerConnection?.setRemoteDescription(offer)

    let answer = await peerConnection?.createAnswer()
    await peerConnection?.setLocalDescription(answer)

    // client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)
    // const payload = JSON.stringify({ name: roomUsers[0], message: { type: 'answer', answer } })
    const payload = { name: roomUsers[0], message: { type: 'answer', answer } }
    socket.emit("send_custom_room", payload)
  }

  const addAnswer = async (answer: object) => {
    if(!peerConnection?.currentRemoteDescription){
      console.log('adding answer: ', answer)
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
