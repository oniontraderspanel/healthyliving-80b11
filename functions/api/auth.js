// functions/api/auth.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fullPath = url.pathname;
  const path = fullPath.replace('/api/auth', '');

  console.log('🔥 Auth function called', {
    fullPath,
    path,
    hasCode: !!url.searchParams.get('code')
  });

  // Handle ANY request with 'callback' in the path
  if (fullPath.includes('/callback') || path.includes('callback')) {
    console.log('🎯 CALLBACK DETECTED!');
    console.log('Full URL:', url.toString());
    console.log('Code:', url.searchParams.get('code'));
    console.log('State:', url.searchParams.get('state'));

    const code = url.searchParams.get('code');

    // Return a simple response for now
    return new Response(`
      <html>
        <body style="font-family: sans-serif; padding: 2rem;">
          <h1>✅ Callback Received!</h1>
          <p>Code: ${code || 'none'}</p>
          <p>This confirms the callback is working!</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth-callback',
                provider: 'github',
                token: 'test-token'
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

  // Handle auth redirect for root path
  if (path === '/' || path === '' || fullPath === '/api/auth') {
    console.log('🔑 Auth handler triggered');

    const redirectUri = `${url.origin}/api/auth/callback`;
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubAuthUrl.searchParams.set('scope', 'repo user');
    githubAuthUrl.searchParams.set('state', generateState());

    return Response.redirect(githubAuthUrl.toString(), 302);
  }

  console.log('❌ No handler for:', { fullPath, path });
  return new Response('Not found', { status: 404 });
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}