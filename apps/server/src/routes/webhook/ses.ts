import { Hono } from 'hono';
import { domain, domainAccount } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

const app = new Hono();

app.post('/webhook/ses', async (c) => {
  try {
    const body = await c.req.json();
    
    if (body.Type === 'SubscriptionConfirmation') {
      return c.json({ message: 'Subscription confirmed' });
    }
    
    if (body.Type === 'Notification') {
      const message = JSON.parse(body.Message);
      
      if (message.eventType === 'send' || message.eventType === 'receive') {
        const db = c.get('db') as any;
        const recipientDomain = message.mail.destination[0].split('@')[1];
        
        const domainRecord = await db
          .select()
          .from(domain)
          .where(and(eq(domain.domain, recipientDomain), eq(domain.verified, true)))
          .limit(1);
          
        if (domainRecord.length > 0) {
          const accounts = await db
            .select()
            .from(domainAccount)
            .where(and(
              eq(domainAccount.domainId, domainRecord[0].id),
              eq(domainAccount.active, true)
            ));
            
          for (const account of accounts) {
            if (message.mail.destination.includes(account.email)) {
              console.log(`Processing email for ${account.email}`);
            }
          }
        }
      }
    }
    
    return c.json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('SES webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

export default app;
