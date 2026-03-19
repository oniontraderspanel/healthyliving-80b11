// functions/api/auth/[[path]].js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle callback (when GitHub redirects back with code)
  if (url.searchParams.has('code')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    // CRITICAL: This must match the redirect_uri used in the auth request
    const redirectUri = `${url.origin}/api/auth/callback`;

    console.log('=== TOKEN EXCHANGE ===');
    console.log('Code:', code);
    console.log('Redirect URI:', redirectUri);
    console.log('Client ID present:', !!env.GITHUB_CLIENT_ID);
    console.log('Client Secret present:', !!env.GITHUB_CLIENT_SECRET);

    try {
      // Exchange code for token - INCLUDING redirect_uri
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
          redirect_uri: redirectUri // ← THIS WAS MISSING
        }),
      });

      const responseText = await tokenResponse.text();
      console.log('Response status:', tokenResponse.status);
      console.log('Response text:', responseText);

      // Try to parse JSON
      let tokenData;
      try {
        tokenData = JSON.parse(responseText);
      } catch (e) {
        // Show the raw response for debugging
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Debug Response</title>
            <style>
              body { font-family: monospace; padding: 2rem; background: #f5f5f5; }
              .container { max-width: 800px; margin: 0 auto; }
              .error { background: #fee; color: #c00; padding: 1rem; border-radius: 4px; }
              pre { background: #fff; padding: 1rem; border-radius: 4px; overflow: auto; }
              .info { background: #e7f3ff; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔍 GitHub Response Debug</h1>

              <div class="info">
                <h3>Request Sent to GitHub:</h3>
                <pre>${JSON.stringify({
                  client_id: env.GITHUB_CLIENT_ID ? '✓ Set (hidden)' : '✗ MISSING',
                  client_secret: env.GITHUB_CLIENT_SECRET ? '✓ Set (hidden)' : '✗ MISSING',
                  code: code.substring(0, 5) + '...',
                  redirect_uri: redirectUri
                }, null, 2)}</pre>
              </div>

              <div class="error">
                <h3>❌ Failed to parse GitHub Response as JSON</h3>
                <p><strong>Status Code:</strong> ${tokenResponse.status}</p>
              </div>

              <h3>Raw Response Text:</h3>
              <pre>${responseText}</pre>

              <h3>Response Headers:</h3>
              <pre>${JSON.stringify(Object.fromEntries(tokenResponse.headers), null, 2)}</pre>

              <button onclick="window.close()" style="padding: 10px 20px; margin-top: 20px;">Close Window</button>
            </div>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      // Check for GitHub error
      if (tokenData.error) {
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head><title>GitHub Error</title></head>
          <body style="font-family: sans-serif; padding: 2rem;">
            <h1>❌ GitHub Error</h1>
            <p><strong>Error:</strong> ${tokenData.error}</p>
            <p><strong>Description:</strong> ${tokenData.error_description || 'No description'}</p>
            <button onclick="window.close()">Close Window</button>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      // Success! Get user data
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      const userData = await userResponse.json();
      console.log('✅ User data obtained:', userData.login);

      // Send token back to CMS
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
              console.log('🔑 Auth callback page loaded');

              if (window.opener) {
                const message = {
                  type: 'oauth-callback',
                  provider: 'github',
                  token: '${tokenData.access_token}',
                  user: {
                    login: '${userData.login}',
                    name: '${userData.name || userData.login}',
                    avatar_url: '${userData.avatar_url || ''}'
                  }
                };

                console.log('📤 Sending message to opener');
                window.opener.postMessage(message, '*');

                // Close after a short delay
                setTimeout(() => window.close(), 2000);
              } else {
                console.log('❌ No opener window found');
              }
            })();
          </script>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });

    } catch (error) {
      console.error('❌ Error:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }

  // Handle auth redirect (no code parameter)
  console.log('🔑 Auth redirect triggered');

  if (!env.GITHUB_CLIENT_ID) {
    return new Response('GitHub Client ID not configured', { status: 500 });
  }

  const redirectUri = `${url.origin}/api/auth/callback`;
  console.log('Redirect URI:', redirectUri);

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