export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const formData = await request.formData();
      const fromPhone = formData.get('From'); // Client phone
      const toPhone = formData.get('To');     // Business Twilio phone
      const body = formData.get('Body')?.trim().toUpperCase();

      if (!fromPhone || !body) {
        return new Response('Missing fields', { status: 400 });
      }

      const token = await getFirebaseToken(env);

      // 1. Identify Business by Twilio Phone (toPhone)
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
      const businessQuery = {
        structuredQuery: {
          from: [{ collectionId: "businesses" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "twilioPhone" },
              op: "EQUAL",
              value: { stringValue: toPhone }
            }
          },
          limit: 1
        }
      };

      const businessRes = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(businessQuery)
      });
      const businessResults = await businessRes.json();
      
      if (!businessResults || businessResults.length === 0 || !businessResults[0].document) {
        return new Response('Business not found', { status: 404 });
      }

      const businessDoc = businessResults[0].document;
      const businessId = businessDoc.name.split('/').pop();
      const businessName = businessDoc.fields.name.stringValue;
      const twilioSid = businessDoc.fields.twilioSid.stringValue;
      const twilioToken = businessDoc.fields.twilioToken.stringValue;

      // 2. Identify Client by Phone (fromPhone)
      const clientQuery = {
        structuredQuery: {
          from: [{ collectionId: "clients" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "phone" },
              op: "EQUAL",
              value: { stringValue: fromPhone }
            }
          },
          limit: 1
        }
      };

      const clientRes = await fetch(`${queryUrl.replace('documents:runQuery', businessDoc.name + ':runQuery')}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(clientQuery)
      });
      const clientResults = await clientRes.json();
      
      if (!clientResults || clientResults.length === 0 || !clientResults[0].document) {
        return new Response('Client not found', { status: 404 });
      }

      const clientDoc = clientResults[0].document;
      const clientId = clientDoc.name.split('/').pop();
      const clientName = clientDoc.fields.name.stringValue;

      let responseMessage = "";

      if (body === "JA") {
        // 3. Find most recent OPEN slot this client was notified about
        const slotQuery = {
          structuredQuery: {
            from: [{ collectionId: "slots" }],
            where: {
              compositeFilter: {
                op: "AND",
                filters: [
                  { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "open" } } },
                  { fieldFilter: { field: { fieldPath: "notifiedClients" }, op: "ARRAY_CONTAINS", value: { stringValue: clientId } } }
                ]
              }
            },
            orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
            limit: 1
          }
        };

        const slotRes = await fetch(`${queryUrl.replace('documents:runQuery', businessDoc.name + ':runQuery')}`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(slotQuery)
        });
        const slotResults = await slotRes.json();

        if (slotResults && slotResults.length > 0 && slotResults[0].document) {
          const slotDoc = slotResults[0].document;
          const slotId = slotDoc.name.split('/').pop();
          const slotData = slotDoc.fields;

          // Update slot to booked
          const updateSlotUrl = `https://firestore.googleapis.com/v1/${slotDoc.name}?updateMask.fieldPaths=status&updateMask.fieldPaths=bookedBy&updateMask.fieldPaths=bookedAt`;
          await fetch(updateSlotUrl, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                status: { stringValue: "booked" },
                bookedBy: { stringValue: clientName },
                bookedAt: { stringValue: new Date().toISOString() }
              }
            })
          });

          // Create Notification
          const notificationUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/businesses/${businessId}/notifications`;
          await fetch(notificationUrl, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                clientName: { stringValue: clientName },
                message: { stringValue: `Termin am ${slotData.date.stringValue} um ${slotData.time.stringValue} Uhr bestätigt.` },
                type: { stringValue: "booking_confirmed" },
                read: { booleanValue: false },
                slotInfo: {
                  mapValue: {
                    fields: {
                      date: { stringValue: slotData.date.stringValue },
                      time: { stringValue: slotData.time.stringValue },
                      serviceType: { stringValue: slotData.serviceType.stringValue }
                    }
                  }
                },
                timestamp: { stringValue: new Date().toISOString() }
              }
            })
          });

          responseMessage = `Dein Termin am ${slotData.date.stringValue} um ${slotData.time.stringValue} Uhr ist bestätigt. Bis dann! – ${businessName}`;
        } else {
          responseMessage = `Leider war jemand anderes schneller oder der Termin ist nicht mehr verfügbar. Du bleibst auf der Warteliste!`;
        }
      } else if (body === "STOP") {
        // Update client.active = false
        const updateClientUrl = `https://firestore.googleapis.com/v1/${clientDoc.name}?updateMask.fieldPaths=active`;
        await fetch(updateClientUrl, {
          method: 'PATCH',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: { active: { booleanValue: false } }
          })
        });
        responseMessage = `Du wurdest von der Warteliste entfernt.`;
      } else {
        responseMessage = `Unbekannter Befehl. Antworte mit JA zum Buchen oder STOP zum Abmelden.`;
      }

      // 5. Send Reply via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const twilioBody = new URLSearchParams({
        To: fromPhone,
        From: toPhone,
        Body: responseMessage
      });

      const twilioAuth = btoa(`${twilioSid}:${twilioToken}`);
      
      await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: twilioBody
      });

      return new Response('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });

    } catch (error) {
      console.error(error);
      return new Response('<Response></Response>', { 
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
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
