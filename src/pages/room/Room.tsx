import { useSearchParams } from 'react-router-dom';

export default function Room({}) {
  const [searchParams] = useSearchParams();
  const room = searchParams.get('room')
  return (
    <div>Room: {room}</div>
  )
}
