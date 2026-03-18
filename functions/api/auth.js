// functions/api/auth.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');

  console.log('Auth function called', { path, url: url.toString() });

  // Handle different auth endpoints
  if (path === '/callback') {
    console.log('Handling callback with code:', url.searchParams.get('code'));
    return handleCallback(request, env);
  } else if (path === '/' || path === '') {
    console.log('Handling auth redirect');
    return handleAuth(request, env);
  }

  return new Response('Not found', { status: 404 });
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/callback`;

  console.log('Auth redirect URI:', redirectUri);
  console.log('Using client ID:', env.GITHUB_CLIENT_ID ? 'Set' : 'MISSING');

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

  console.log('Callback received', {
    code: code ? 'present' : 'missing',
    state: state ? 'present' : 'missing'
  });

  if (!code) {
    console.error('No code provided in callback');
    return new Response('No code provided', { status: 400 });
  }

  try {
    // Exchange code for token
    console.log('Exchanging code for token...');
    console.log('Client secret:', env.GITHUB_CLIENT_SECRET ? 'Set' : 'MISSING');

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
    console.log('Token response received');

    if (tokenData.error) {
      console.error('GitHub error:', tokenData.error, tokenData.error_description);
      return new Response(`GitHub error: ${tokenData.error} - ${tokenData.error_description || ''}`, { status: 400 });
    }

    if (!tokenData.access_token) {
      console.error('No access token in response:', tokenData);
      return new Response('No access token received', { status: 400 });
    }

    console.log('Successfully obtained access token');

    // Return HTML with token for Decap CMS
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .message {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="message">
    <h2>Authentication Successful!</h2>
    <p>You can close this window and return to the CMS.</p>
  </div>
  <script>
    (function() {
      console.log('Sending token to opener window');
      if (window.opener) {
        window.opener.postMessage({
          type: 'oauth-callback',
          provider: 'github',
          token: '${tokenData.access_token}'
        }, '*');
        setTimeout(() => window.close(), 1000);
      } else {
        console.log('No opener window found');
        document.body.innerHTML = '<div class="message"><h2>Success!</h2><p>You can now return to the CMS.</p></div>';
      }
    })();
  </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Callback error:', error.message, error.stack);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}