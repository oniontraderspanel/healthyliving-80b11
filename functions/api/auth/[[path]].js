// functions/api/auth/[[path]].js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  console.log('🚀 Auth function called for path:', url.pathname);

  // Check if this is a callback (has code parameter)
  if (url.searchParams.has('code')) {
    console.log('✅ Callback detected, exchanging code for token');

    const code = url.searchParams.get('code');

    try {
      // Exchange the code for an access token
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
        console.error('GitHub token error:', tokenData);
        return new Response(`GitHub error: ${tokenData.error}`, { status: 400 });
      }

      console.log('✅ Token obtained successfully');

      // Get user data from GitHub
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      const userData = await userResponse.json();
      console.log('✅ User data obtained:', userData.login);

      // Return HTML that sends complete data to the CMS
      return new Response(`
        <!DOCTYPE html>
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
            }
            .card {
              background: white;
              padding: 2rem;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
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
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✓</div>
            <h1>Authentication Successful!</h1>
            <p>Welcome, ${userData.login}!</p>
            <p>You are being redirected back to the CMS...</p>
          </div>

          <script>
            (function() {
              console.log('Sending authentication data to CMS...');

              // Send complete auth data to the CMS
              if (window.opener) {
                window.opener.postMessage({
                  type: 'oauth-callback',
                  provider: 'github',
                  token: '${tokenData.access_token}',
                  user: {
                    login: '${userData.login}',
                    name: '${userData.name || userData.login}',
                    avatar_url: '${userData.avatar_url || ''}'
                  }
                }, '*');

                // Close this window after a short delay
                setTimeout(() => window.close(), 2000);
              } else {
                console.log('No opener window found');
                document.body.innerHTML += '<p>No opener window found. You can close this window.</p>';
              }
            })();
          </script>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });

    } catch (error) {
      console.error('Token exchange error:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }

  // Handle auth redirect (no code parameter)
  console.log('🔑 Auth redirect triggered');

  if (!env.GITHUB_CLIENT_ID) {
    return new Response('GitHub Client ID not configured', { status: 500 });
  }

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