import './VideoPlayer.css'

type Props = {
  deviceNotFound: boolean
}

export default function VideoPlayer({ deviceNotFound }: Props) {
  return (
    <div className='video-player'>
      <video className="waiting-video" muted id="waiting-video" autoPlay playsInline></video>
      {
        deviceNotFound && <div className='device-not-found'>Device not found</div>
      }
    </div>
  )
}
