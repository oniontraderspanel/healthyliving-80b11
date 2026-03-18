// functions/api/auth.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');

  // Handle different auth endpoints
  if (path === '/callback') {
    return handleCallback(request, env);
  } else if (path === '/' || path === '') {  // Fixed: match both '/' and empty string
    return handleAuth(request, env);
  }

  return new Response('Not found', { status: 404 });
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/callback`;

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'repo user');
  githubAuthUrl.searchParams.set('state', generateState());

  return Response.redirect(githubAuthUrl.toString(), 302);
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return new Response(`GitHub error: ${tokenData.error}`, { status: 400 });
    }

    // Return HTML with token for Decap CMS
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
</head>
<body>
  <script>
    (function() {
      window.opener.postMessage({
        type: 'oauth-callback',
        provider: 'github',
        token: '${tokenData.access_token}'
      }, '*');
      window.close();
    })();
  </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}