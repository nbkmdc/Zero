import { fetchPricingTable } from 'autumn-js';
import type { HonoContext } from '../ctx';
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { getZeroDB } from '../lib/server-utils';

const sanitizeCustomerBody = (body: any) => {
  let bodyCopy = { ...body };
  delete bodyCopy.id;
  delete bodyCopy.name;
  delete bodyCopy.email;
  return bodyCopy;
};

type AutumnContext = {
  Variables: {
    customerData: {
      customerId: string;
      customerData: {
        name: string;
        email: string;
      };
    } | null;
    orgData: {
      organizationId: string;
    } | null;
  };
} & HonoContext;

export const autumnApi = new Hono<AutumnContext>()
  .use('*', async (c, next) => {
    const { sessionUser } = c.var;
    c.set(
      'customerData',
      !sessionUser
        ? null
        : {
            customerId: sessionUser.id,
            customerData: {
              name: sessionUser.name,
              email: sessionUser.email,
            },
          },
    );
    await next();
  })
  .use('*', async (c, next) => {
    const { sessionUser } = c.var;
    if (!sessionUser) {
      c.set('orgData', null);
      return await next();
    }
    const db = getZeroDB(sessionUser.id);
    const org = await db.findFirstOrganization();
    if (org) {
      c.set('orgData', { organizationId: org.id });
    } else {
      c.set('orgData', null);
    }
    await next();
  })
  .post('/customers', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    const body = await c.req.json();
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn.customers
        .create({
          id: orgData?.organizationId ?? customerData.customerId,
          ...customerData.customerData,
          ...sanitizeCustomerBody(body),
        })
        .then((data) => data.data),
    );
  })
  .post('/attach', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    const body = await c.req.json();
    const sanitizedBody = sanitizeCustomerBody(body);
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn
        .attach({
          ...sanitizedBody,
          customer_id: orgData?.organizationId ?? customerData.customerId,
          customer_data: customerData.customerData,
        })
        .then((data) => data.data),
    );
  })
  .post('/cancel', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    const body = await c.req.json();
    const sanitizedBody = sanitizeCustomerBody(body);
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn
        .cancel({
          ...sanitizedBody,
          customer_id: orgData?.organizationId ?? customerData.customerId,
        })
        .then((data) => data.data),
    );
  })
  .post('/check', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    const body = await c.req.json();
    const sanitizedBody = sanitizeCustomerBody(body);
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    const customerIdForCheck = orgData?.organizationId ?? customerData.customerId;
    console.log('Checking subscription for customer_id:', customerIdForCheck); // dis is for testing

    return c.json(
      await autumn
        .check({
          ...sanitizedBody,
          customer_id: orgData?.organizationId ?? customerData.customerId,
          customer_data: customerData.customerData,
        })
        .then((data) => data.data),
    );
  })
  .post('/track', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    const body = await c.req.json();
    const sanitizedBody = sanitizeCustomerBody(body);
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn
        .track({
          ...sanitizedBody,
          customer_id: orgData?.organizationId ?? customerData.customerId,
          customer_data: customerData.customerData,
        })
        .then((data) => data.data),
    );
  })
  .post('/billing_portal', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    const body = await c.req.json();
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn.customers
        .billingPortal(orgData?.organizationId ?? customerData.customerId, body)
        .then((data) => data.data),
    );
  })
  .post('/openBillingPortal', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    const body = await c.req.json();
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn.customers
        .billingPortal(orgData?.organizationId ?? customerData.customerId, {
          ...body,
          return_url: `${env.VITE_PUBLIC_APP_URL}`,
        })
        .then((data) => data.data),
    );
  })
  .post('/entities', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    const body = await c.req.json();
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn.entities
        .create(orgData?.organizationId ?? customerData.customerId, body)
        .then((data) => data.data),
    );
  })
  .get('/entities/:entityId', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    const entityId = c.req.param('entityId');
    const expand = c.req.query('expand')?.split(',') as 'invoices'[] | undefined;

    if (!entityId) {
      return c.json(
        {
          error: 'no_entity_id',
          message: 'Entity ID is required',
        },
        400,
      );
    }

    return c.json(
      await autumn.entities
        .get(orgData?.organizationId ?? customerData.customerId, entityId, { expand })
        .then((data) => data.data),
    );
  })
  .delete('/entities/:entityId', async (c) => {
    const { autumn, customerData, orgData } = c.var;
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    const entityId = c.req.param('entityId');

    if (!entityId) {
      return c.json(
        {
          error: 'no_entity_id',
          message: 'Entity ID is required',
        },
        400,
      );
    }

    return c.json(
      await autumn.entities
        .delete(orgData?.organizationId ?? customerData.customerId, entityId)
        .then((data) => data.data),
    );
  })
  .get('/components/pricing_table', async (c) => {
    const { autumn, customerData, orgData } = c.var;

    return c.json(
      await fetchPricingTable({
        instance: autumn,
        params: {
          customer_id: orgData?.organizationId ?? customerData?.customerId,
        },
      }).then((data) => data.data),
    );
  });
