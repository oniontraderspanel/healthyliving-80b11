// functions/api/auth.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');

  console.log('🔥 Auth function called', {
    path,
    fullUrl: url.toString(),
    hasCode: !!url.searchParams.get('code')
  });

  // Handle callback - do this FIRST and make it super obvious
  if (path === '/callback') {
    console.log('🎯 CALLBACK HANDLER TRIGGERED!');
    console.log('Code:', url.searchParams.get('code'));
    console.log('State:', url.searchParams.get('state'));

    // Return a visible response immediately
    return new Response(`
      <html>
        <head>
          <title>Authentication Test</title>
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
            .card {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              max-width: 500px;
              text-align: center;
            }
            .success { color: #2ecc71; font-size: 48px; margin-bottom: 1rem; }
            .info { background: #f8f9fa; padding: 1rem; border-radius: 4px; margin: 1rem 0; text-align: left; }
            .info p { margin: 0.5rem 0; }
            .label { font-weight: bold; color: #555; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success">✅</div>
            <h1>Callback Received!</h1>
            <p>Your auth callback endpoint is working correctly.</p>

            <div class="info">
              <p><span class="label">Code:</span> ${url.searchParams.get('code') || 'none'}</p>
              <p><span class="label">State:</span> ${url.searchParams.get('state') || 'none'}</p>
            </div>

            <p>This confirms the callback endpoint is reachable.</p>
            <p><small>You can close this window and return to the CMS.</small></p>
          </div>

          <script>
            console.log('Callback page loaded');
            if (window.opener) {
              console.log('Found opener window, sending message');
              window.opener.postMessage({
                type: 'oauth-callback',
                provider: 'github',
                token: 'test-token-12345'
              }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              console.log('No opener window found');
            }
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Handle auth redirect
  if (path === '/' || path === '') {
    console.log('🔑 Auth handler triggered');

    // Check if environment variables are set
    if (!env.GITHUB_CLIENT_ID) {
      console.error('GITHUB_CLIENT_ID not set');
      return new Response('GitHub Client ID not configured', { status: 500 });
    }

    const redirectUri = `${url.origin}/api/auth/callback`;
    console.log('Redirect URI:', redirectUri);

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubAuthUrl.searchParams.set('scope', 'repo user');
    githubAuthUrl.searchParams.set('state', generateState());

    console.log('Redirecting to GitHub');
    return Response.redirect(githubAuthUrl.toString(), 302);
  }

  console.log('❌ No handler for path:', path);
  return new Response('Not found', { status: 404 });
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}