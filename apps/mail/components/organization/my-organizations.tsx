import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import { Users } from 'lucide-react';

export default function MyOrganizations({
  organizations,
  activeOrg,
  handleSetActiveOrg,
}: {
  organizations: any[];
  activeOrg: any;
  handleSetActiveOrg: (org: any) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Your Organizations
        </CardTitle>
        <CardDescription>Select an organization to manage members</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {organizations.map((org) => (
            <div
              key={org.id}
              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                activeOrg?.id === org.id ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                {org.logo && (
                  <img
                    src={org.logo}
                    alt={`${org.name} logo`}
                    className="h-6 w-6 rounded"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div>
                  <p className="font-medium">{org.name}</p>
                  <p className="text-muted-foreground text-sm">@{org.slug}</p>
                  <p className="text-muted-foreground text-sm">{org.id}</p>
                </div>

                <div className="flex items-center gap-2">
                  {activeOrg?.id !== org.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetActiveOrg(org);
                      }}
                    >
                      Set as Active
                    </Button>
                  )}
                </div>
              </div>
              <div>{activeOrg?.id === org.id && <Badge variant="secondary">Active</Badge>}</div>
              {/* <Badge variant="outline">{org.member?.role || 'Unknown'}</Badge> */}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
