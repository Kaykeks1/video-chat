import { createContext } from 'react';
import { io, Socket } from 'socket.io-client';

const url: string = process.env.REACT_APP_BASE_API_URL || '';

export const socket = io(url);
export const WebsocketContext = createContext<Socket>(socket);
export const WebsocketProvider = WebsocketContext.Provider;
