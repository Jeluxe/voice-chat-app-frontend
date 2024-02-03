import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AcceptIcon,
  RestoreIcon,
  TrashIcon
} from '../assets/icons'
import { useSocketIOProvider, useStateProvider } from '../context'
import { Avatar, UserStatus } from './'


const Friend = ({ data: { id, status: friendRequestStatus, user, isSender } }) => {
  const { rooms } = useStateProvider()
  const { emitData } = useSocketIOProvider()
  const [requestStatus, setRequestStatus] = useState(friendRequestStatus)

  const makeDecision = (decision) => {
    emitData('update-friend-request', id, decision, (result) => {
      console.log(result)
      setRequestStatus(result)
    })
  }

  const userInfoElement = (showStatus, { avatar, username, status }) => {
    return <div style={{
      display: "flex",
      columnGap: "10px",
      alignItems: "center",
    }}>
      <div style={{ position: "relative", display: "flex" }}>
        <Avatar
          size={36}
          bgColor={avatar}
        />
        {showStatus ? <UserStatus
          status={status}
          absolute={true}
        /> : ""}
      </div>
      <div>{username}</div>
    </div >
  }

  const getRoomID = useCallback((userID) => {
    const foundRoom = rooms?.find(room => room.recipients?.id === userID);
    if (foundRoom) {
      return foundRoom.id
    }
    return userID
  }, [rooms])


  return (
    <>{
      requestStatus !== 'PENDING' && requestStatus !== 'BLOCKED' ?
        <Link to={`/@me/${getRoomID(user.id)}`} className='friend-wrapper'>
          {userInfoElement(true, user)}
        </Link>
        :
        <div className='friend-wrapper'>
          {userInfoElement(false, user)}
          {requestStatus === 'PENDING' ?
            <div className='friend-actions'>
              {isSender && <div className='friend-action' onClick={() => makeDecision('accept')}><AcceptIcon /></div>}
              <div className='friend-action trash' onClick={() => makeDecision('decline')}><TrashIcon /></div>
            </div>
            :
            <div className='friend-actions'>
              <div className='friend-action' onClick={() => makeDecision('restore')}><RestoreIcon /></div>
            </div>
          }
        </div>
    }</>
  )
}


export default Friend