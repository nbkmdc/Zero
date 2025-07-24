import { Button } from '@/components/ui/button';
import { useConnections } from '@/hooks/use-connections';
import { authClient } from '@/lib/auth-client';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function IntegrationsPage() {
  const { data, isLoading, refetch } = useConnections();
  const trpc = useTRPC();
  const { mutateAsync: deleteConnection } = useMutation(trpc.connections.delete.mutationOptions());
  
  // Get the default/active connection
  const { data: defaultConnection } = useQuery(trpc.connections.getDefault.queryOptions());
  
  // Find ALL Google connections
  const googleConnections = data?.connections?.filter((c: { providerId: string }) => c.providerId === 'google') || [];
  const googleConn = googleConnections[0]; 
  const hasCalendar = googleConn?.hasCalendar;
  const isConnected = !!googleConn;
  const hasCalendarScope = hasCalendar === true;

  const upcomingQuery = useQuery(
    trpc.calendar.upcoming.queryOptions(
      { max: 5 },
      {
        enabled: hasCalendarScope,
        staleTime: 1000 * 30,
      },
    ),
  );

  const {
    data: upcomingData,
    isLoading: loadingUpcoming,
    error: upcomingError,
  } = upcomingQuery as any;
  const firstEvent = Array.isArray(upcomingData) && upcomingData.length ? upcomingData[0] : null;

  const connect = () => {
    authClient
      .linkSocial({
        provider: 'google',
        callbackURL: `${window.location.origin}/settings/integrations`,
        scopes: [
          'https://www.googleapis.com/auth/calendar',
        ],
      })
      .catch(console.error);
  };

  const disconnect = async () => {
    if (!googleConn) return;

    toast.promise(deleteConnection({ connectionId: googleConn.id }), {
      loading: 'Disconnecting...',
      success: () => {
        refetch();
        return 'Disconnected successfully';
      },
      error: 'Failed to disconnect',
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      
      <div className="border rounded-lg p-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Google Calendar</h2>

          {!isConnected && <p className="text-sm text-gray-600">Connect your Google account.</p>}
          {isConnected && !hasCalendarScope && (
            <p className="text-sm text-yellow-600">
              Calendar access not granted. Please grant access.
            </p>
          )}
          {isConnected && hasCalendarScope && !loadingUpcoming && (
            <p className="text-sm text-gray-600">Your Google Calendar is connected.</p>
          )}

          {hasCalendarScope && !loadingUpcoming && firstEvent && (
            <p className="text-sm mt-2">
              Next event: <strong>{firstEvent.summary ?? 'No title'}</strong>{' '}
              {firstEvent.start ? `at ${new Date(firstEvent.start).toLocaleString()}` : ''}
            </p>
          )}

          {hasCalendarScope && !loadingUpcoming && !firstEvent && (
            <p className="text-sm mt-2">No upcoming events found.</p>
          )}

          {upcomingError && (
            <p className="text-sm text-red-500 mt-2">
              Could not load events. Please try reconnecting.
              <br />
              <strong>Error:</strong> {String(upcomingError)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isConnected && <Button onClick={connect}>Connect</Button>}
          {isConnected && !hasCalendarScope && <Button onClick={connect}>Grant Access</Button>}
          {isConnected && (
            <Button variant="destructive" onClick={disconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 