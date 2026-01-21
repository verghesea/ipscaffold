import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { getStoredToken } from '@/lib/api';

interface DebugData {
  userId: string;
  totalPatentsInDB: number;
  userPatentsCount: number;
  allPatents: Array<{
    id: string;
    user_id: string | null;
    title: string | null;
    friendly_title: string | null;
    status: string;
    created_at: string;
  }>;
  userPatents: Array<{
    id: string;
    user_id: string | null;
    title: string | null;
    friendly_title: string | null;
    status: string;
    created_at: string;
  }>;
}

export function DebugPage() {
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getStoredToken();
      if (!token) {
        throw new Error('Not authenticated - please log in first');
      }

      const response = await fetch('/api/debug/patents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const debugData = await response.json();
      setData(debugData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, []);

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Debug Information</h1>
          <Button onClick={fetchDebugData} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading && !data && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Your User ID:</strong> {data.userId}</p>
                <p><strong>Total Patents in Database:</strong> {data.totalPatentsInDB}</p>
                <p><strong>Your Patents:</strong> {data.userPatentsCount}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Patents (First 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">ID</th>
                        <th className="text-left p-2">User ID</th>
                        <th className="text-left p-2">Title</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.allPatents.map((patent) => (
                        <tr key={patent.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-mono text-xs">{patent.id.substring(0, 8)}...</td>
                          <td className="p-2 font-mono text-xs">
                            {patent.user_id ? patent.user_id.substring(0, 8) + '...' : 'null'}
                          </td>
                          <td className="p-2">
                            {patent.friendly_title || patent.title || 'Untitled'}
                          </td>
                          <td className="p-2">{patent.status}</td>
                          <td className="p-2">{new Date(patent.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Patents</CardTitle>
              </CardHeader>
              <CardContent>
                {data.userPatents.length === 0 ? (
                  <p className="text-gray-500">No patents found for your user ID</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">ID</th>
                          <th className="text-left p-2">Title</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.userPatents.map((patent) => (
                          <tr key={patent.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-mono text-xs">{patent.id.substring(0, 8)}...</td>
                            <td className="p-2">
                              {patent.friendly_title || patent.title || 'Untitled'}
                            </td>
                            <td className="p-2">{patent.status}</td>
                            <td className="p-2">{new Date(patent.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
