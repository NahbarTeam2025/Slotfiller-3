import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import twilio from 'twilio';

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
  
  const str2ab = str => {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) bufView[i] = str.charCodeAt(i);
    return buf;
  };

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', str2ab(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsignedToken));
  const signedToken = unsignedToken + '.' + encode(new Uint8Array(signature));
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedToken
    })
  });
  
  const data = await response.json();
  return data.access_token;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://slotfiller.roberterbach.de',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    const { businessId, notifiedClients, businessName } = await request.json();
    const token = await getFirebaseToken(env);
    
    const db = getFirestore(initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
    }));

    const businessDoc = await getDoc(doc(db, 'businesses', businessId));
    const businessData = businessDoc.data();
    
    const client = twilio(businessData.twilioSid, businessData.twilioToken);
    
    const clientsQuery = query(collection(db, `businesses/${businessId}/clients`));
    const clientsSnapshot = await getDocs(clientsQuery);
    const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const message = `Dieser Termin wurde leider anderweitig vergeben. Du bleibst weiterhin auf unserer Warteliste! – ${businessName}`;
    
    for (const clientId of notifiedClients) {
      const clientData = clients.find(c => c.id === clientId || c.name === clientId);
      if (clientData && clientData.phone) {
        await client.messages.create({
          body: message,
          from: businessData.twilioPhone,
          to: clientData.phone
        });
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://slotfiller.roberterbach.de'
      }
    });
  }
};
