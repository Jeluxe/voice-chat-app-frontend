import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const useSocketIO = (url) => {
  const [socket, setSocket] = useState(null);
  const [socketEvents, setSocketEvents] = useState({});

  useEffect(() => {
    const newSocket = io.connect(url, { autoConnect: false });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [url]);

  useEffect(() => {
    if (socket) {
      for (const [eventName, callback] of Object.entries(socketEvents)) {
        socket.on(eventName, callback);
      }
    }

    return () => {
      if (socket) {
        for (const [eventName, callback] of Object.entries(socketEvents)) {
          socket.off(eventName, callback);
        }
      }
    };
  }, [socket, socketEvents])

  const socketConnect = (user) => {
    if (user && socket) {
      socket.auth = user
      socket.connect()
    }
  }

  const socketDisconnect = () => {
    if (socket) {
      socket.disconnect()
    }
  }

  const emitData = (event, ...args) => {
    if (socket)
      socket.emit(event, ...args)
  }

  const addSocketEvent = (eventName, callback) => {
    setSocketEvents((prevSocketEvents) => ({
      ...prevSocketEvents,
      [eventName]: callback,
    }));
  };

  const removeSocketEvent = (eventName) => {
    if (socket && socketEvents[eventName]) {
      socket.off(eventName, socketEvents[eventName]);

      setSocketEvents((prevSocketEvents) => {
        const { [eventName]: removedEvent, ...rest } = prevSocketEvents;
        return rest;
      });
    }
  };

  return {
    socketConnect,
    socketDisconnect,
    emitData,
    addSocketEvent,
    removeSocketEvent,
  };
}