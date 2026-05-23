import type {User} from "../auth";

export interface DecodedRealtimeToken {
  admin?: boolean;
  id?: string;
  isAnonymous?: boolean;
}

export interface SocketWithDecodedToken {
  decodedToken?: DecodedRealtimeToken;
}

export const getSocketUser = (socket: SocketWithDecodedToken): User | undefined => {
  const userId = socket.decodedToken?.id;
  if (!userId) {
    return undefined;
  }

  return {
    _id: userId,
    admin: socket.decodedToken?.admin === true,
    id: userId,
    isAnonymous: socket.decodedToken?.isAnonymous,
  };
};
