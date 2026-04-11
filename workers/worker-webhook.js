/**
 * Cloudflare Worker: Webhook Receiver for Twilio
 * 
 * This worker receives incoming SMS from Twilio.
 * It processes "JA" (booking) and "STOP" (opt-out) messages.
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const formData = await request.formData();
      const fromPhone = formData.get('From');
      const toPhone = formData.get('To');
      const body = formData.get('Body')?.trim().toUpperCase();

      if (!fromPhone || !body) {
        return new Response('Missing fields', { status: 400 });
      }

      // 1. Identify Business by Twilio Phone (toPhone)
      // (Requires a query to find the business where twilioPhone == toPhone)
      // Let's assume we found businessId and twilio credentials
      const businessId = "example_business_id"; 
      const twilioSid = "example_sid";
      const twilioToken = "example_token";
      const businessName = "Hair & Style";

      // 2. Identify Client by Phone (fromPhone)
      const clientId = "example_client_id";

      let responseMessage = "";

      if (body === "JA") {
        // 3. Process Booking (ACID Transaction in Firestore)
        // Check if slot is open
        const slotIsOpen = true; // Simulate check
        
        if (slotIsOpen) {
          // Update slot to booked
          responseMessage = `Dein Termin ist bestätigt. Bis dann! – ${businessName}`;
          
          // Send rejection to others
          // "Leider schon vergeben – du bleibst ganz oben auf unserer Warteliste!"
        } else {
          responseMessage = `Leider war jemand anderes schneller. Du bleibst auf der Warteliste!`;
        }
      } else if (body === "STOP") {
        // 4. Process Opt-out
        // Update client.active = false
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

      // Twilio expects a 200 OK with empty TwiML or just 200 OK
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
