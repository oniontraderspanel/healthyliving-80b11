// functions/api/auth.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  console.log('🚀 Auth function called for path:', url.pathname);
  console.log('Full URL:', url.toString());
  console.log('Query params:', Object.fromEntries(url.searchParams));

  // Check if this is a callback (has code parameter)
  if (url.searchParams.has('code')) {
    console.log('✅ Callback detected via code parameter');

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    console.log('Code:', code);
    console.log('State:', state);

    // Return a visible success page
    return new Response(`
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .card {
              background: white;
              padding: 2.5rem;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              max-width: 500px;
              text-align: center;
              color: #333;
            }
            .success-icon {
              background: #4CAF50;
              color: white;
              width: 60px;
              height: 60px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 30px;
              margin: 0 auto 20px;
            }
            h1 { color: #333; margin-bottom: 10px; }
            p { color: #666; margin: 10px 0; }
            .info {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 8px;
              text-align: left;
              margin: 20px 0;
              font-family: monospace;
            }
            .info p { margin: 5px 0; color: #333; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✓</div>
            <h1>Authentication Successful!</h1>
            <p>You have successfully authenticated with GitHub.</p>

            <div class="info">
              <p><strong>Code:</strong> ${code.substring(0, 10)}... (truncated)</p>
              <p><strong>Path:</strong> ${url.pathname}</p>
            </div>

            <p>You can close this window and return to the CMS.</p>
          </div>

          <script>
            console.log('Callback page loaded');

            // Send message to opener window (the CMS)
            if (window.opener) {
              console.log('Found opener window, sending authentication message');
              window.opener.postMessage({
                type: 'oauth-callback',
                provider: 'github',
                token: '${code}' // In production, this would be the actual access token
              }, '*');

              // Close this window after a short delay
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

  // Handle auth redirect (no code parameter)
  console.log('🔑 Auth redirect triggered - no code parameter found');

  // Check if environment variables are set
  if (!env.GITHUB_CLIENT_ID) {
    console.error('GITHUB_CLIENT_ID environment variable is not set');
    return new Response('GitHub Client ID not configured. Please set GITHUB_CLIENT_ID environment variable.', { status: 500 });
  }

  if (!env.GITHUB_CLIENT_SECRET) {
    console.error('GITHUB_CLIENT_SECRET environment variable is not set');
    return new Response('GitHub Client Secret not configured. Please set GITHUB_CLIENT_SECRET environment variable.', { status: 500 });
  }

  const redirectUri = `${url.origin}/api/auth/callback`;
  console.log('Redirect URI:', redirectUri);

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'repo user');
  githubAuthUrl.searchParams.set('state', generateState());

  console.log('Redirecting to GitHub authorization URL');
  return Response.redirect(githubAuthUrl.toString(), 302);
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}