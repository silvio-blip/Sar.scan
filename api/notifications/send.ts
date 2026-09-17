import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import serviceAccount from "../../serviceAccountKey.json" assert { type: "json" };

// Função para gerar token OAuth2 usando a Service Account do Firebase V1
async function getAccessToken(sa: any) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: exp
  };

  const enc = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${enc(header)}.${enc(payload)}`;

  // Assinatura RSA com a chave privada do JSON
  const pemHeader = "-----BEGIN PRIVATE KEY-----\n";
  const pemFooter = "\n-----END PRIVATE KEY-----";
  const pemContents = sa.private_key.replace(pemHeader, "").replace(pemFooter, "").replace(/\n/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const encSig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsignedToken}.${encSig}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  try {
    const { token, title, body, data } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: "Token ausente" }), { status: 400 });

    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const fcmPayload = {
      message: {
        token: token,
        notification: { title, body },
        data: data || {},
        android: { priority: "high" }
      }
    };

    const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(fcmPayload)
    });

    const result = await fcmRes.json();
    return new Response(JSON.stringify({ success: true, result }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
