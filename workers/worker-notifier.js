/**
 * Cloudflare Worker: Notifier
 * 
 * This worker is designed to be triggered when a new slot is created.
 * It fetches the business, finds matching clients, and sends SMS via Twilio.
 * 
 * Deployment:
 * 1. Create a new Cloudflare Worker
 * 2. Paste this code
 * 3. Set environment variables (FIREBASE_PROJECT_ID, etc.)
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://slotfiller.roberterbach.de',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { 
        status: 405,
        headers: { 'Access-Control-Allow-Origin': 'https://slotfiller.roberterbach.de' }
      });
    }

    try {
      const token = await getFirebaseToken(env);
      const payload = await request.json();
      const { businessId, slotId, date, time, serviceType } = payload;

      if (!businessId || !slotId) {
        return new Response('Missing required fields', { 
          status: 400,
          headers: { 'Access-Control-Allow-Origin': 'https://slotfiller.roberterbach.de' }
        });
      }

      // In a real scenario, you would use the Firebase REST API or Admin SDK 
      // to fetch the business credentials and clients.
      // For this example, we'll simulate the logic.
      
      // 1. Fetch Business (to get Twilio credentials & SMS balance)
      const businessUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/businesses/${businessId}`;
      const businessRes = await fetch(businessUrl, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const businessData = await businessRes.json();
      
      const twilioSid = businessData.fields.twilioSid.stringValue;
      const twilioToken = businessData.fields.twilioToken.stringValue;
      const twilioPhone = businessData.fields.twilioPhone.stringValue;
      const businessName = businessData.fields.name.stringValue;
      let smsBalance = parseInt(businessData.fields.smsBalance.integerValue || "0");

      if (smsBalance <= 0) {
        return new Response('Insufficient SMS balance', { 
          status: 400,
          headers: { 'Access-Control-Allow-Origin': 'https://slotfiller.roberterbach.de' }
        });
      }

      // 2. Fetch Active Clients matching the serviceType
      // (Using REST API structured query or just fetching all and filtering)
      const clientsUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/businesses/${businessId}/clients`;
      const clientsRes = await fetch(clientsUrl, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const clientsData = await clientsRes.json();
      
      const notifiedClients = [];
      
      if (clientsData.documents) {
        for (const doc of clientsData.documents) {
          const client = doc.fields;
          const isActive = client.active?.booleanValue;
          
          // Check if client wants this service
          const wantsService = client.serviceTypes?.arrayValue?.values?.some(
            v => v.stringValue === serviceType
          );

          if (isActive && wantsService && smsBalance > 0) {
            const clientPhone = client.phone.stringValue;
            const clientName = client.name.stringValue;
            const clientId = doc.name.split('/').pop();

            // 3. Send SMS via Twilio
            const message = `Hallo ${clientName}, bei ${businessName} ist heute um ${time} Uhr ein Termin für ${serviceType} freigeworden. Antworte mit JA zum Buchen oder STOP zum Abmelden.`;
            
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            const twilioBody = new URLSearchParams({
              To: clientPhone,
              From: twilioPhone,
              Body: message
            });

            const twilioAuth = btoa(`${twilioSid}:${twilioToken}`);
            
            const smsRes = await fetch(twilioUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${twilioAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: twilioBody
            });

            if (smsRes.ok) {
              notifiedClients.push(clientId);
              smsBalance--;
            }
          }
        }
      }

      // 4. Update Slot with notifiedClients
      // 5. Update Business with new smsBalance
      // (Omitted REST API patch calls for brevity)

      return new Response(JSON.stringify({ success: true, notified: notifiedClients.length }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://slotfiller.roberterbach.de'
        }
      });

    } catch (error) {
      return new Response(error.message, { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': 'https://slotfiller.roberterbach.de' }
      });
    }
  }
};

async function getFirebaseToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore'
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const encode = obj => btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const unsignedToken = encode(header) + '.' + encode(payload);
  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', str2ab(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey, 
    new TextEncoder().encode(unsignedToken)
  );
  const jwt = unsignedToken + '.' + btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const data = await tokenRes.json();
  return data.access_token;
}

function str2ab(str) {
  const b64 = str.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}
