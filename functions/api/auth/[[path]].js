// functions/api/auth/[[path]].js
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

    return new Response(`
      <html>
        <head><title>Authentication Successful</title></head>
        <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh;">
          <div style="text-align: center; padding: 2rem; background: #f0f0f0; border-radius: 8px;">
            <h1>✅ Authentication Successful!</h1>
            <p>Code received: ${code.substring(0, 10)}...</p>
            <p>Path: ${url.pathname}</p>
            <p>You can close this window.</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth-callback',
                provider: 'github',
                token: '${code}'
              }, '*');
              setTimeout(() => window.close(), 1000);
            }
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Handle auth redirect (no code parameter)
  console.log('🔑 Auth redirect triggered');

  const redirectUri = `${url.origin}/api/auth/callback`;
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'repo user');
  githubAuthUrl.searchParams.set('state', generateState());

  return Response.redirect(githubAuthUrl.toString(), 302);
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}