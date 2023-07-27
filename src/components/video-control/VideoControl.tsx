import './VideoControl.css';

type Prop = {
  hasHover?: boolean
  handleClick: Function
  icon: string
  off?: boolean
}

export default function VideoControl({ hasHover, handleClick, icon, off }: Prop) {
  return (
    <div className='control' onClick={() => handleClick()} style={off ? { border: 'unset' } : {}}>
      <div className='control-container'>
        {
          hasHover && <div className='fore-ground-hover' />
        }
        {
          off && <div className='fore-ground-off' />
        }
        <img src={icon} style={off ? { zIndex: 1 } : {}}/>
      </div>
    </div>
  )
}
