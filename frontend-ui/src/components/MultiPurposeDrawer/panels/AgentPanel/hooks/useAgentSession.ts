import { useCallback, useEffect, useRef } from 'react';
import {
  useListSessionsQuery,
  useGetSessionQuery,
  useCreateSessionMutation,
  useSendMessageMutation,
} from '@/store/agentSlice';
import type { CreateSessionBody, SendMessageBody } from '../types';

const POLL_INTERVAL_MS = 3000;

interface UseAgentSessionOptions {
  activeSessionId: string | null;
}

const useAgentSession = ({ activeSessionId }: UseAgentSessionOptions) => {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useListSessionsQuery(undefined, { pollingInterval: 10_000 });

  const {
    data: activeSession,
    isLoading: sessionLoading,
    error: sessionError,
    refetch: refetchSession,
  } = useGetSessionQuery(activeSessionId ?? '', {
    skip: !activeSessionId,
  });

  const [createSession, { isLoading: creating }] = useCreateSessionMutation();
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();

  // Poll active session when running
  useEffect(() => {
    if (activeSession?.status === 'running' && activeSessionId) {
      pollRef.current = setInterval(() => {
        refetchSession();
      }, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeSession?.status, activeSessionId, refetchSession]);

  const handleCreateSession = useCallback(
    async (body: CreateSessionBody) => {
      const result = await createSession(body).unwrap();
      return result;
    },
    [createSession],
  );

  const handleSendMessage = useCallback(
    async (body: SendMessageBody) => {
      if (!activeSessionId) return;
      await sendMessage({ sessionId: activeSessionId, body }).unwrap();
    },
    [activeSessionId, sendMessage],
  );

  return {
    sessions: sessions?.results ?? [],
    sessionsLoading,
    sessionsError,
    activeSession: activeSession ?? null,
    sessionLoading,
    sessionError,
    creating,
    sending,
    createSession: handleCreateSession,
    sendMessage: handleSendMessage,
  };
};

export default useAgentSession;
